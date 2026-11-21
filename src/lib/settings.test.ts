import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
  getSettingsSnapshot,
  resetSettings,
  subscribeSettings,
  updateSettings,
  type Settings,
} from "./settings";

/** Clave heredada del tema (antes de existir los ajustes). */
const LEGACY_THEME_KEY = "inkline-theme";

/**
 * Doble de `Storage` en memoria, como en `useTheme.test.ts`: el entorno de test
 * de Node no expone `localStorage`.
 */
function memoryStorage(): Storage {
  const entries = new Map<string, string>();
  return {
    get length() {
      return entries.size;
    },
    clear: () => entries.clear(),
    getItem: (key) => entries.get(key) ?? null,
    key: (index) => Array.from(entries.keys())[index] ?? null,
    removeItem: (key) => {
      entries.delete(key);
    },
    setItem: (key, value) => {
      entries.set(key, String(value));
    },
  } satisfies Storage;
}

let storage: Storage;

beforeEach(() => {
  storage = memoryStorage();
  vi.stubGlobal("localStorage", storage);
  resetSettings();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("settings", () => {
  it("arranca con las preferencias por defecto del mockup", () => {
    expect(getSettingsSnapshot()).toEqual({
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
  });

  it("aplica una actualización parcial y avisa a quien escucha", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeSettings(listener);

    updateSettings({ editorFontSize: 14, wordWrap: true });

    const snapshot = getSettingsSnapshot();
    expect(snapshot.editorFontSize).toBe(14);
    expect(snapshot.wordWrap).toBe(true);
    expect(snapshot.tabWidth).toBe(2);
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  it("ignora las claves desconocidas sin publicar ni escribir", () => {
    updateSettings({ unknown: "x" } as unknown as Partial<Settings>);

    expect(getSettingsSnapshot()).toEqual(DEFAULT_SETTINGS);
    expect(storage.getItem(SETTINGS_STORAGE_KEY)).toBeNull();
  });

  it("valida cada campo y conserva el último valor válido", () => {
    updateSettings({ editorFontSize: 16, tabWidth: 4 });

    updateSettings({
      themeMode: "violeta",
      previewFont: "mono",
      defaultView: "write",
      editorFontSize: 99,
      tabWidth: 3,
      lineNumbers: "sí",
      wordWrap: "no",
      spellcheck: 1,
      confirmClose: null,
      pageSize: "A5",
    } as unknown as Partial<Settings>);

    expect(getSettingsSnapshot()).toEqual({
      ...DEFAULT_SETTINGS,
      editorFontSize: 16,
      tabWidth: 4,
    });
  });

  it("acepta los valores válidos de cada campo", () => {
    updateSettings({
      themeMode: "light",
      previewFont: "serif",
      defaultView: "preview",
      editorFontSize: 15,
      tabWidth: 2,
      lineNumbers: false,
      wordWrap: true,
      spellcheck: true,
      confirmClose: false,
      pageSize: "letter",
    });

    expect(getSettingsSnapshot()).toEqual({
      themeMode: "light",
      previewFont: "serif",
      defaultView: "preview",
      editorFontSize: 15,
      tabWidth: 2,
      lineNumbers: false,
      wordWrap: true,
      spellcheck: true,
      confirmClose: false,
      pageSize: "letter",
    });
  });

  it("persiste en localStorage y vuelve a leer lo guardado", () => {
    updateSettings({ themeMode: "light", pageSize: "letter", defaultView: "preview" });

    expect(JSON.parse(storage.getItem(SETTINGS_STORAGE_KEY) ?? "null")).toMatchObject({
      themeMode: "light",
      pageSize: "letter",
      defaultView: "preview",
    });

    storage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ ...DEFAULT_SETTINGS, editorFontSize: 15 }),
    );

    expect(getSettingsSnapshot().editorFontSize).toBe(15);
  });

  it("cae a los valores por defecto con un JSON corrupto", () => {
    storage.setItem(SETTINGS_STORAGE_KEY, "{ esto no es json");

    expect(getSettingsSnapshot()).toEqual(DEFAULT_SETTINGS);
  });

  it("valida campo a campo lo que trae el blob guardado", () => {
    storage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ themeMode: "violeta", tabWidth: 4, lineNumbers: "sí" }),
    );

    expect(getSettingsSnapshot()).toEqual({ ...DEFAULT_SETTINGS, tabWidth: 4 });
  });

  it("usa el tema heredado como semilla sólo si no hay ajustes guardados", () => {
    storage.setItem(LEGACY_THEME_KEY, "light");

    expect(getSettingsSnapshot().themeMode).toBe("light");

    storage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ ...DEFAULT_SETTINGS, themeMode: "dark" }),
    );

    expect(getSettingsSnapshot().themeMode).toBe("dark");
  });

  it("no usa un valor heredado inválido como semilla", () => {
    storage.setItem(LEGACY_THEME_KEY, "violeta");

    expect(getSettingsSnapshot().themeMode).toBe("system");
  });

  it("resetSettings vuelve a los valores por defecto", () => {
    updateSettings({ wordWrap: true });

    resetSettings();

    expect(getSettingsSnapshot()).toEqual(DEFAULT_SETTINGS);
    expect(storage.getItem(SETTINGS_STORAGE_KEY)).toBeNull();
  });
});
