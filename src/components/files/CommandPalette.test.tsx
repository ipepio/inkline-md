import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  CommandPalette,
  PALETTE_PLACEHOLDER,
  filterPalette,
} from "./CommandPalette";

// jsdom no trae ResizeObserver ni scrollIntoView; los componentes de diálogo de
// `ui/` los usan para medir el popup. Stubs mínimos, sólo en este test.
beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const docs = [
  { id: "doc-1", name: "guia.md", path: "/ws/docs/guia.md" },
  { id: "doc-2", name: "README.md", path: "/ws/README.md" },
];

const files = ["/ws/docs/guia.md", "/ws/docs/notas.txt", "/ws/apuntes/frases.md"];

const ACTION_LABELS = [
  "Abrir archivo…",
  "Nuevo documento",
  "Alternar tema",
  "Aumentar zoom",
  "Reducir zoom",
  "Restablecer zoom",
];

const props = {
  docs,
  files,
  onSelectDoc: vi.fn(),
  onOpenFile: vi.fn(),
  onOpenDialog: vi.fn(),
  onNewDoc: vi.fn(),
  onToggleTheme: vi.fn(),
  onZoomIn: vi.fn(),
  onZoomOut: vi.fn(),
  onZoomReset: vi.fn(),
};

function openPalette() {
  act(() => {
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }),
    );
  });
}

describe("filterPalette", () => {
  it("sin consulta devuelve documentos, archivos no abiertos y todas las acciones", () => {
    const groups = filterPalette("", docs, files);

    expect(groups.docs.map((item) => item.path)).toEqual([
      "/ws/docs/guia.md",
      "/ws/README.md",
    ]);
    // guia.md ya está abierto: no se repite como archivo suelto.
    expect(groups.files.map((item) => item.path)).toEqual([
      "/ws/docs/notas.txt",
      "/ws/apuntes/frases.md",
    ]);
    expect(groups.actions.map((item) => item.label)).toEqual(ACTION_LABELS);
  });

  it("busca documentos por nombre y archivos por subcadena de ruta", () => {
    const byName = filterPalette("readme", docs, files);
    expect(byName.docs.map((item) => item.path)).toEqual(["/ws/README.md"]);
    expect(byName.files).toEqual([]);

    const byPath = filterPalette("apuntes", docs, files);
    expect(byPath.docs).toEqual([]);
    expect(byPath.files.map((item) => item.path)).toEqual(["/ws/apuntes/frases.md"]);

    const byExtension = filterPalette(".TXT", docs, files);
    expect(byExtension.files.map((item) => item.path)).toEqual(["/ws/docs/notas.txt"]);
  });

  it("mantiene las acciones aunque la consulta no coincida con nada", () => {
    const groups = filterPalette("zzz", docs, files);
    expect(groups.docs).toEqual([]);
    expect(groups.files).toEqual([]);
    expect(groups.actions.map((item) => item.label)).toEqual(ACTION_LABELS);
  });
});

describe("CommandPalette", () => {
  it("se abre con ⌘K y cierra con Esc", () => {
    render(<CommandPalette {...props} />);

    expect(screen.queryByPlaceholderText(PALETTE_PLACEHOLDER)).toBeNull();

    openPalette();
    expect(screen.getByPlaceholderText(PALETTE_PLACEHOLDER)).toBeInTheDocument();
    expect(screen.getByText("↑↓ navegar")).toBeInTheDocument();
    expect(screen.getByText("↵ abrir")).toBeInTheDocument();
    expect(screen.getByText("esc cerrar")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape", code: "Escape" });
    expect(screen.queryByPlaceholderText(PALETTE_PLACEHOLDER)).toBeNull();
  });

  it("filtra al escribir y abre el documento elegido", () => {
    const onSelectDoc = vi.fn();
    render(<CommandPalette {...props} onSelectDoc={onSelectDoc} />);

    openPalette();
    fireEvent.change(screen.getByPlaceholderText(PALETTE_PLACEHOLDER), {
      target: { value: "readme" },
    });

    expect(screen.queryByText("guia.md")).toBeNull();
    fireEvent.click(screen.getByRole("option", { name: /README\.md/i }));
    expect(onSelectDoc).toHaveBeenCalledWith("doc-2");
  });

  it("ejecuta las acciones fijas", () => {
    const onNewDoc = vi.fn();
    const onToggleTheme = vi.fn();
    const onOpenDialog = vi.fn();
    render(
      <CommandPalette
        {...props}
        docs={[]}
        files={[]}
        onOpenDialog={onOpenDialog}
        onNewDoc={onNewDoc}
        onToggleTheme={onToggleTheme}
      />,
    );

    openPalette();
    fireEvent.click(screen.getByText("Nuevo documento"));
    expect(onNewDoc).toHaveBeenCalledTimes(1);

    openPalette();
    fireEvent.click(screen.getByText("Alternar tema"));
    expect(onToggleTheme).toHaveBeenCalledTimes(1);

    openPalette();
    fireEvent.click(screen.getByText("Abrir archivo…"));
    expect(onOpenDialog).toHaveBeenCalledTimes(1);
  });

  it("ejecuta los comandos de zoom", () => {
    const onZoomIn = vi.fn();
    const onZoomOut = vi.fn();
    const onZoomReset = vi.fn();
    render(
      <CommandPalette
        {...props}
        onZoomIn={onZoomIn}
        onZoomOut={onZoomOut}
        onZoomReset={onZoomReset}
      />,
    );

    openPalette();
    fireEvent.click(screen.getByText("Aumentar zoom"));
    expect(onZoomIn).toHaveBeenCalledTimes(1);

    openPalette();
    fireEvent.click(screen.getByText("Reducir zoom"));
    expect(onZoomOut).toHaveBeenCalledTimes(1);

    openPalette();
    fireEvent.click(screen.getByText("Restablecer zoom"));
    expect(onZoomReset).toHaveBeenCalledTimes(1);
  });
});
