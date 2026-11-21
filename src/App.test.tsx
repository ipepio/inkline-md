import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
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

    fireEvent.click(screen.getByTitle(/Mostrar \/ ocultar el explorador/));

    expect(container.querySelector('aside[aria-label="Explorador de archivos"]')).toBeNull();
    expect(container.querySelector("main.col-start-3")).not.toBeNull();
    // El estado vacío sigue visible: no se desmonta el área de trabajo.
    expect(screen.getByText("Ningún documento abierto")).toBeInTheDocument();
  });
});
