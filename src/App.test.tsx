import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { getSettingsSnapshot, resetSettings } from "@/lib/settings";
import App from "./App";

vi.mock("@/lib/workspace", () => ({
  listTree: vi.fn().mockResolvedValue([]),
  loadWorkspaceConfig: vi.fn().mockResolvedValue({ root: null, recents: [] }),
  pushRecent: vi.fn().mockResolvedValue([]),
  setWorkspace: vi.fn().mockResolvedValue(undefined),
  flattenFiles: vi.fn().mockReturnValue([]),
  filePaths: vi.fn().mockReturnValue([]),
  fileNameOf: (path: string) => path.split(/[\\/]/).pop() ?? path,
  workspaceName: (root: string | null) => (root ? "raíz" : "Sin carpeta raíz"),
  MAX_RECENTS: 10,
}));

vi.mock("@/lib/files", () => ({
  openTextFile: vi.fn().mockResolvedValue(null),
  readTextFile: vi.fn().mockResolvedValue({ path: "", contents: "" }),
  saveTextFile: vi.fn().mockResolvedValue(undefined),
  saveTextFileAs: vi.fn().mockResolvedValue(null),
}));

describe("App (shell Inkline)", () => {
  it("muestra marca, explorador, acciones y estado vacío", () => {
    render(<App />);

    // Marca del rail y del explorador (ahora son los assets de la marca).
    expect(screen.getAllByAltText(/inkline/i).length).toBeGreaterThan(0);
    // Cabecera del explorador.
    expect(screen.getByText("EXPLORADOR")).toBeInTheDocument();
    // Acciones del topbar.
    expect(screen.getByRole("button", { name: "Abrir" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Guardar/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Exportar/i })).toBeInTheDocument();
    // Estado vacío del área de lectura.
    expect(screen.getByText("Ningún documento abierto")).toBeInTheDocument();
    expect(screen.getByText(/crea uno nuevo con ⌘N/)).toBeInTheDocument();
    // QA humano: sin pie Local-first ni avatar IL en el rail; Preferencias accesible.
    expect(screen.queryByText("Local-first workspace")).not.toBeInTheDocument();
    expect(screen.queryByText("IL")).not.toBeInTheDocument();
    expect(screen.getByTitle("Preferencias (⌘,)")).toBeInTheDocument();
  });

  // Regresión QA: al colapsar el explorador, el panel principal debe conservar
  // su columna. Antes el `<aside>` se desmontaba, `<main>` caía en la columna de
  // 0px y los paneles se quedaban sin ancho (texto en vertical).
  it("mantiene el panel principal en su columna al colapsar el explorador", () => {
    const { container } = render(<App />);

    // Selector por tag+clase: hay más de un nodo con rol main en el árbol
    // (diálogos de shadcn/Base UI), así que el rol no identifica el panel.
    expect(container.querySelector("main.col-start-3")).not.toBeNull();
    expect(container.querySelector('aside[aria-label="Explorador de archivos"]')).not.toBeNull();

    // Regresión QA: ambos son grid items, así que necesitan `min-h-0`. Sin él
    // crecían por encima de la ventana, el grid los recortaba y el área de
    // trabajo dejaba de verse y de hacer scroll.
    expect(container.querySelector("main.col-start-3")?.className).toContain("min-h-0");
    expect(
      container.querySelector('aside[aria-label="Explorador de archivos"]')?.className,
    ).toContain("min-h-0");
    // El rail también: su espaciador empujaba tema y Preferencias fuera de vista.
    expect(container.querySelector('aside[aria-label="Barra de Inkline"]')?.className).toContain(
      "min-h-0",
    );

    fireEvent.click(screen.getByTitle(/Mostrar \/ ocultar el explorador/));

    expect(container.querySelector('aside[aria-label="Explorador de archivos"]')).toBeNull();
    expect(container.querySelector("main.col-start-3")).not.toBeNull();
    // El estado vacío sigue visible: no se desmonta el área de trabajo.
    expect(screen.getByText("Ningún documento abierto")).toBeInTheDocument();
  });

  // Zoom global de texto (⌘+ / ⌘− / ⌘0): escala editor y visor a la vez.
  it("hace zoom con ⌘+ / ⌘− y restablece con ⌘0", () => {
    resetSettings();

    render(<App />);

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { metaKey: true, key: "=" }));
    });
    expect(getSettingsSnapshot().zoom).toBe(110);

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { metaKey: true, key: "-" }));
    });
    expect(getSettingsSnapshot().zoom).toBe(100);

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { metaKey: true, key: "=" }));
    });
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { metaKey: true, key: "=" }));
    });
    expect(getSettingsSnapshot().zoom).toBe(125);

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { metaKey: true, key: "0" }));
    });
    expect(getSettingsSnapshot().zoom).toBe(100);

    resetSettings();
  });

  // Fuera de macOS los atajos se muestran con Ctrl.
  it("muestra los atajos con Ctrl en Windows", () => {
    Object.defineProperty(window.navigator, "platform", {
      value: "Win32",
      configurable: true,
    });
    try {
      render(<App />);

      expect(screen.getByTitle("Preferencias (Ctrl+,)")).toBeInTheDocument();
      expect(screen.getByText(/crea uno nuevo con Ctrl\+N/)).toBeInTheDocument();
    } finally {
      Object.defineProperty(window.navigator, "platform", {
        value: "MacIntel",
        configurable: true,
      });
    }
  });
});
