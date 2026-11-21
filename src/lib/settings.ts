/**
 * Preferencias de Inkline (ODD T6 / S4 · S6).
 *
 * Almacén observable diminuto sobre `useSyncExternalStore`, con la misma forma
 * que `lib/documents.ts`: sin dependencias nuevas y sin React por medio salvo
 * el hook de lectura.
 *
 * Dónde vive cada cosa (decisión deliberada):
 * - Carpeta raíz y recientes son estado del espacio de trabajo y viven en la
 *   configuración del sistema que escribe Rust (`lib/workspace.ts`).
 * - Las preferencias personales (tema, tipografía, editor, exportación) viven
 *   en `localStorage`, porque son de esta persona y de este equipo: se aplican
 *   antes de que Tauri esté disponible y sobreviven sin tocar el backend.
 *
 * Validación: cada campo tiene su propio guardián. Un blob con campos
 * inválidos conserva lo válido y cae a los valores por defecto campo a campo;
 * un blob corrupto cae entero a los valores por defecto. La instantánea se
 * relee cuando cambia el texto crudo guardado (otra pestaña, un test con otro
 * `Storage`), de forma que el almacén nunca sirve datos rancios.
 */

import { useSyncExternalStore } from "react";

export type ThemeMode = "system" | "dark" | "light";
export type PreviewFont = "sans" | "serif";
export type DefaultView = "editor" | "split" | "preview";
export type EditorFontSize = 12 | 13 | 14 | 15 | 16;
export type TabWidth = 2 | 4;
export type PageSize = "A4" | "letter";

export interface Settings {
  /** Tema de la interfaz: sigue al sistema por defecto (S4). */
  themeMode: ThemeMode;
  /** Tipografía de la vista previa: sans del mockup o serif editorial. */
  previewFont: PreviewFont;
  /** Vista con la que se abre un documento. */
  defaultView: DefaultView;
  /** Escala del texto fuente del editor, en píxeles. */
  editorFontSize: EditorFontSize;
  /** Espacios de la indentación con Tab. */
  tabWidth: TabWidth;
  /** Gutter de numeración del editor. */
  lineNumbers: boolean;
  /** Ajuste de línea: evita el desplazamiento horizontal. */
  wordWrap: boolean;
  /** Corrección ortográfica del sistema en el editor. */
  spellcheck: boolean;
  /** Advertir al cerrar un documento con cambios sin guardar. */
  confirmClose: boolean;
  /** Tamaño de página del bloque `@page` de la exportación. */
  pageSize: PageSize;
}

/** Preferencias de fábrica: las del mockup. */
export const DEFAULT_SETTINGS: Settings = Object.freeze({
  themeMode: "system",
  previewFont: "sans",
  defaultView: "split",
  editorFontSize: 12,
  tabWidth: 2,
  lineNumbers: true,
  wordWrap: false,
  spellcheck: false,
  confirmClose: true,
  pageSize: "A4",
});

/** Clave de persistencia de las preferencias personales. */
export const SETTINGS_STORAGE_KEY = "inkline-settings";

/**
 * Clave heredada del tema (T2). Hoy sólo siembra `themeMode` la primera vez que
 * faltan los ajustes, para no perder la elección de quien ya usaba Inkline.
 */
export const LEGACY_THEME_STORAGE_KEY = "inkline-theme";

/** Tamaños de letra ofrecidos por la ventana de preferencias. */
export const EDITOR_FONT_SIZES: readonly EditorFontSize[] = [12, 13, 14, 15, 16];

/** Indentaciones ofrecidas por la ventana de preferencias. */
export const TAB_WIDTHS: readonly TabWidth[] = [2, 4];

/** Tamaños de página del bloque `@page`. */
export const PAGE_SIZES: readonly PageSize[] = ["A4", "letter"];

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === "system" || value === "dark" || value === "light";
}

export function isPreviewFont(value: unknown): value is PreviewFont {
  return value === "sans" || value === "serif";
}

export function isDefaultView(value: unknown): value is DefaultView {
  return value === "editor" || value === "split" || value === "preview";
}

export function isEditorFontSize(value: unknown): value is EditorFontSize {
  return EDITOR_FONT_SIZES.some((size) => value === size);
}

export function isTabWidth(value: unknown): value is TabWidth {
  return TAB_WIDTHS.some((width) => value === width);
}

export function isPageSize(value: unknown): value is PageSize {
  return PAGE_SIZES.some((size) => value === size);
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

/** Campos conocidos, en el orden de la ventana de preferencias. */
const SETTINGS_KEYS = [
  "themeMode",
  "previewFont",
  "defaultView",
  "editorFontSize",
  "tabWidth",
  "lineNumbers",
  "wordWrap",
  "spellcheck",
  "confirmClose",
  "pageSize",
] as const satisfies readonly (keyof Settings)[];

const VALIDATORS: { [K in keyof Settings]: (value: unknown) => value is Settings[K] } = {
  themeMode: isThemeMode,
  previewFont: isPreviewFont,
  defaultView: isDefaultView,
  editorFontSize: isEditorFontSize,
  tabWidth: isTabWidth,
  lineNumbers: isBoolean,
  wordWrap: isBoolean,
  spellcheck: isBoolean,
  confirmClose: isBoolean,
  pageSize: isPageSize,
};

/**
 * Huella del almacenamiento: blob de ajustes + tema heredado. Cambiar cualquiera
 * de los dos invalida la instantánea cacheada.
 */
function readRaw(): string {
  try {
    const stored = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    const legacy = window.localStorage.getItem(LEGACY_THEME_STORAGE_KEY);
    return `${stored ?? ""}\u0000${legacy ?? ""}`;
  } catch {
    // localStorage bloqueado (modo privado): se usan los valores por defecto.
    return "\u0000";
  }
}

function applyStored(settings: Settings, stored: Partial<Record<keyof Settings, unknown>>): void {
  for (const key of SETTINGS_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(stored, key)) continue;
    const value = stored[key];
    const isValid = VALIDATORS[key] as (candidate: unknown) => boolean;
    if (!isValid(value)) continue;
    (settings as Record<keyof Settings, unknown>)[key] = value;
  }
}

/** Interpreta el texto crudo guardado; los valores inválidos no pasan. */
function parseSettings(raw: string): Settings {
  const [storedRaw = "", legacyRaw = ""] = raw.split("\u0000");
  const settings: Settings = { ...DEFAULT_SETTINGS };
  const absent = storedRaw === "";

  if (!absent) {
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(storedRaw);
    } catch {
      // Blob corrupto: se cae entero a los valores por defecto.
      parsed = null;
    }
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      applyStored(settings, parsed as Partial<Record<keyof Settings, unknown>>);
    }
    return settings;
  }

  // Primera vez sin ajustes: se hereda el tema de T2 si era válido.
  if (isThemeMode(legacyRaw)) settings.themeMode = legacyRaw;
  return settings;
}

interface SettingsCache {
  raw: string;
  settings: Settings;
}

let cache: SettingsCache | null = null;
const listeners = new Set<() => void>();

function publish(): void {
  for (const listener of listeners) listener();
}

/** Instantánea actual; identidad estable mientras no cambie lo guardado. */
export function getSettingsSnapshot(): Settings {
  const raw = readRaw();
  if (cache !== null && cache.raw === raw) return cache.settings;
  const settings = parseSettings(raw);
  cache = { raw, settings };
  return settings;
}

export function subscribeSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Preferencias para componentes React. */
export function useSettings(): Settings {
  return useSyncExternalStore(subscribeSettings, getSettingsSnapshot, getSettingsSnapshot);
}

function writeSettings(settings: Settings): void {
  try {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Persistencia no disponible: las preferencias siguen vigentes en memoria.
  }
}

/**
 * Aplica un cambio parcial. Sólo se aceptan claves conocidas con valores
 * válidos; lo inválido se descarta sin tocar el valor que ya había, y el
 * cambio sólo se publica (y se guarda) si algo cambió de verdad.
 */
export function updateSettings(partial: Partial<Settings>): void {
  const current = getSettingsSnapshot();
  const next: Settings = { ...current };
  let changed = false;

  for (const key of SETTINGS_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(partial, key)) continue;
    const value: unknown = partial[key];
    const isValid = VALIDATORS[key] as (candidate: unknown) => boolean;
    if (!isValid(value) || value === current[key]) continue;
    (next as Record<keyof Settings, unknown>)[key] = value;
    changed = true;
  }

  if (!changed) return;

  writeSettings(next);
  // La huella se lee después de escribir: si el almacenamiento está bloqueado,
  // la instantánea en memoria sigue siendo la recién aplicada.
  cache = { raw: readRaw(), settings: next };
  publish();
}

/**
 * Vuelve a las preferencias de fábrica y olvida el blob guardado; pensado para
 * tests y para «restablecer preferencias». El tema heredado de T2, si existe,
 * vuelve a sembrar `themeMode`.
 */
export function resetSettings(): void {
  try {
    window.localStorage.removeItem(SETTINGS_STORAGE_KEY);
  } catch {
    // Sin persistencia disponible no hay nada que borrar.
  }
  cache = null;
  publish();
}
