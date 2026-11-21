import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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

    // Marca del sidebar (el punto vive en un span propio, como en el mockup).
    expect(
      screen.getByText(
        (_, element) => element?.tagName === "STRONG" && element.textContent === "inkline.",
      ),
    ).toBeInTheDocument();
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
});
