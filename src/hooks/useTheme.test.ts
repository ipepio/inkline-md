import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { resetSettings } from "@/lib/settings";
import { THEME_STORAGE_KEY, useTheme } from "./useTheme";

function root(): HTMLElement {
  return document.documentElement;
}

/**
 * Doble de `Storage`: el entorno de test de Node no expone `localStorage`
 * (avisa "requires --localstorage-file"), así que se verifica el contrato de
 * persistencia contra una implementación en memoria de la misma API.
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
  root().className = "";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useTheme", () => {
  it("usa el tema oscuro por defecto y lo aplica al documento", () => {
    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe("dark");
    expect(root()).toHaveClass("dark");
  });

  it("honra el tema persistido", () => {
    storage.setItem(THEME_STORAGE_KEY, "light");

    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe("light");
    expect(root()).not.toHaveClass("dark");
  });

  it("ignora un valor persistido inválido", () => {
    storage.setItem(THEME_STORAGE_KEY, "violeta");

    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe("dark");
    expect(root()).toHaveClass("dark");
  });

  it("alterna entre claro y oscuro y persiste el resultado", () => {
    const { result } = renderHook(() => useTheme());

    act(() => result.current.toggleTheme());

    expect(result.current.theme).toBe("light");
    expect(root()).not.toHaveClass("dark");
    expect(storage.getItem(THEME_STORAGE_KEY)).toBe("light");

    act(() => result.current.toggleTheme());

    expect(result.current.theme).toBe("dark");
    expect(root()).toHaveClass("dark");
    expect(storage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });

  it("aplica un tema explícito con setTheme", () => {
    const { result } = renderHook(() => useTheme());

    act(() => result.current.setTheme("light"));

    expect(result.current.theme).toBe("light");
    expect(root()).not.toHaveClass("dark");
    expect(storage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });
});

/**
 * «Automático» (T6): el tema sigue a `prefers-color-scheme` mientras el hook
 * está montado. `MediaQueryList` simulado para poder lanzar sus cambios.
 */
function systemQuery(initial: boolean) {
  const listeners = new Set<() => void>();
  const query = {
    matches: initial,
    media: "(prefers-color-scheme: dark)",
    addEventListener: (_type: string, listener: () => void) => {
      listeners.add(listener);
    },
    removeEventListener: (_type: string, listener: () => void) => {
      listeners.delete(listener);
    },
    dispatch(next: boolean) {
      query.matches = next;
      for (const listener of listeners) listener();
    },
  };
  return query;
}

function stubMatchMedia(query: ReturnType<typeof systemQuery>): void {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => query),
  );
}

describe("useTheme con el tema del sistema", () => {
  beforeEach(() => resetSettings());

  it("resuelve «system» con prefers-color-scheme", () => {
    stubMatchMedia(systemQuery(false));

    const { result } = renderHook(() => useTheme());

    expect(result.current.themeMode).toBe("system");
    expect(result.current.theme).toBe("light");
    expect(root()).not.toHaveClass("dark");
  });

  it("sigue los cambios del sistema mientras está montado", () => {
    const query = systemQuery(true);
    stubMatchMedia(query);

    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe("dark");
    expect(root()).toHaveClass("dark");

    act(() => query.dispatch(false));

    expect(result.current.theme).toBe("light");
    expect(root()).not.toHaveClass("dark");

    act(() => query.dispatch(true));

    expect(result.current.theme).toBe("dark");
    expect(root()).toHaveClass("dark");
  });

  it("un override manual ignora los cambios del sistema", () => {
    const query = systemQuery(true);
    stubMatchMedia(query);

    const { result } = renderHook(() => useTheme());

    act(() => result.current.setThemeMode("light"));
    act(() => query.dispatch(true));

    expect(result.current.themeMode).toBe("light");
    expect(result.current.theme).toBe("light");
    expect(root()).not.toHaveClass("dark");
    expect(storage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });

  it("alternar desde «system» deja un override explícito", () => {
    stubMatchMedia(systemQuery(true));

    const { result } = renderHook(() => useTheme());

    act(() => result.current.toggleTheme());

    expect(result.current.themeMode).toBe("light");
    expect(result.current.theme).toBe("light");
  });
});
