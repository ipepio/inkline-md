/**
 * Tema de Inkline (ODD T2 / S4 · S6, extendido en T6).
 *
 * El tema vive en la clase `dark` de `document.documentElement` (index.html ya
 * trae `class="dark"`, y `src/index.css` define `.dark` / `:root`).
 *
 * Desde T6 la fuente de verdad es la preferencia `themeMode` del almacén de
 * ajustes, con tres estados como pide S4: «Automático» sigue al sistema por
 * `prefers-color-scheme` (con escucha de cambios mientras el hook está montado)
 * y «Oscuro» / «Claro» son el override manual. La API anterior se conserva:
 * `setTheme`, `toggleTheme`, `isTheme`, `applyTheme`, `THEME_STORAGE_KEY` y
 * `DEFAULT_THEME` siguen exportándose con el mismo significado, y la clave
 * heredada de T2 actúa como semilla la primera vez que faltan los ajustes.
 *
 * `toggleTheme` mantiene la intención de T2: cambiar a lo contrario de lo que se
 * ve ahora (nunca «lo contrario del sistema»), y deja la elección explícita.
 */

import { useCallback, useEffect, useState } from "react";
import {
  LEGACY_THEME_STORAGE_KEY,
  isThemeMode,
  updateSettings,
  useSettings,
  type ThemeMode,
} from "@/lib/settings";

export type Theme = "dark" | "light";

/** Clave de persistencia heredada del tema elegido (T2). */
export const THEME_STORAGE_KEY = LEGACY_THEME_STORAGE_KEY;

/** Inkline es oscuro por defecto (y lo sigue siendo sin `matchMedia`). */
export const DEFAULT_THEME: Theme = "dark";

/** Consulta del sistema que decide el tema en modo «Automático». */
export const SYSTEM_THEME_QUERY = "(prefers-color-scheme: dark)";

export function isTheme(value: unknown): value is Theme {
  return value === "dark" || value === "light";
}

/** Aplica el tema al elemento raíz: `dark` presente u ausente. */
export function applyTheme(theme: Theme, element: HTMLElement = document.documentElement): void {
  element.classList.toggle("dark", theme === "dark");
}

/**
 * Tema del sistema. Sin `matchMedia` (jsdom, entornos sin ventana) se usa el
 * tema por defecto de Inkline, que es lo que hacía T2.
 */
function readSystemTheme(): Theme {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return DEFAULT_THEME;
  }
  try {
    return window.matchMedia(SYSTEM_THEME_QUERY).matches ? "dark" : "light";
  } catch {
    return DEFAULT_THEME;
  }
}

export interface UseThemeResult {
  /** Preferencia elegida: 'system' | 'dark' | 'light'. */
  themeMode: ThemeMode;
  /** Tema resuelto que está aplicado al documento. */
  theme: Theme;
  setThemeMode: (mode: ThemeMode) => void;
  /** Compatibilidad T2: equivale a `setThemeMode(theme)`. */
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

export function useTheme(): UseThemeResult {
  const { themeMode } = useSettings();
  const [systemTheme, setSystemTheme] = useState<Theme>(readSystemTheme);

  // «Automático» sigue al sistema mientras el hook está montado.
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const query = window.matchMedia(SYSTEM_THEME_QUERY);
    const sync = () => setSystemTheme(query.matches ? "dark" : "light");
    sync();
    if (typeof query.addEventListener === "function") {
      query.addEventListener("change", sync);
    }
    return () => {
      if (typeof query.removeEventListener === "function") {
        query.removeEventListener("change", sync);
      }
    };
  }, []);

  const theme: Theme = themeMode === "system" ? systemTheme : themeMode;

  useEffect(() => {
    applyTheme(theme);
    if (themeMode === "system") return;
    // La clave heredada se mantiene al día con el override explícito.
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
    } catch {
      // Persistencia no disponible: el tema sigue vigente en memoria.
    }
  }, [theme, themeMode]);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    if (!isThemeMode(mode)) return;
    updateSettings({ themeMode: mode });
  }, []);

  const setTheme = useCallback((next: Theme) => {
    updateSettings({ themeMode: next });
  }, []);

  const toggleTheme = useCallback(() => {
    updateSettings({ themeMode: theme === "dark" ? "light" : "dark" });
  }, [theme]);

  return { themeMode, theme, setThemeMode, setTheme, toggleTheme };
}
