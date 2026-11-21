/**
 * Tema de Inkline (ODD T2 / S4 · S6).
 *
 * El tema vive en la clase `dark` de `document.documentElement` (index.html ya
 * trae `class="dark"`, y `src/index.css` define `.dark` / `:root`). El hook sólo
 * expone lectura, cambio y persistencia; la UI de ajustes llega en T6.
 */

import { useCallback, useEffect, useState } from "react";

export type Theme = "dark" | "light";

/** Clave de persistencia del tema elegido por la persona usuaria. */
export const THEME_STORAGE_KEY = "inkline-theme";

/** Inkline es oscuro por defecto. */
export const DEFAULT_THEME: Theme = "dark";

export function isTheme(value: unknown): value is Theme {
  return value === "dark" || value === "light";
}

/** Lee el tema persistido y descarta cualquier valor que no sea válido. */
function readStoredTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(stored) ? stored : DEFAULT_THEME;
  } catch {
    // localStorage bloqueado (modo privado): se usa el tema por defecto.
    return DEFAULT_THEME;
  }
}

/** Aplica el tema al elemento raíz: `dark` presente u ausente. */
export function applyTheme(theme: Theme, element: HTMLElement = document.documentElement): void {
  element.classList.toggle("dark", theme === "dark");
}

export interface UseThemeResult {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

export function useTheme(): UseThemeResult {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme);

  useEffect(() => {
    applyTheme(theme);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Persistencia no disponible: el tema sigue vigente en memoria.
    }
  }, [theme]);

  const setTheme = useCallback((next: Theme) => setThemeState(next), []);
  const toggleTheme = useCallback(
    () => setThemeState((current) => (current === "dark" ? "light" : "dark")),
    [],
  );

  return { theme, setTheme, toggleTheme };
}
