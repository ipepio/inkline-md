import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
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
