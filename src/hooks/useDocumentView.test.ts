import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { setViewState, type OpenDocument } from "@/lib/documents";
import { documentCrumbs, useDocumentView } from "./useDocumentView";

vi.mock("@/lib/documents", () => ({ setViewState: vi.fn() }));

function doc(overrides: Partial<OpenDocument> = {}): OpenDocument {
  return {
    id: "doc-1",
    path: "/notas/diario.md",
    name: "diario.md",
    contents: "# diario\n\nDos palabras",
    dirty: false,
    viewState: {},
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("documentCrumbs", () => {
  it("descompone la ruta bajo la raíz del espacio de trabajo", () => {
    expect(documentCrumbs("/notas/proyectos/idea.md", "/notas")).toEqual({
      rootName: "notas",
      folders: ["proyectos"],
      fileName: "idea.md",
    });
  });

  it("sin raíz deja sólo el nombre del archivo", () => {
    expect(documentCrumbs("/notas/idea.md", null)).toEqual({
      rootName: null,
      folders: [],
      fileName: "idea.md",
    });
  });

  it("fuera de la raíz no inventa carpetas", () => {
    expect(documentCrumbs("/otro/idea.md", "/notas")).toEqual({
      rootName: null,
      folders: [],
      fileName: "idea.md",
    });
  });

  it("no confunde una raíz que es prefijo de otra carpeta", () => {
    expect(documentCrumbs("/notas-viejas/idea.md", "/notas")).toEqual({
      rootName: null,
      folders: [],
      fileName: "idea.md",
    });
  });

  it("etiqueta los documentos sin archivo", () => {
    expect(documentCrumbs("untitled://1-1", "/notas")).toEqual({
      rootName: null,
      folders: [],
      fileName: "Sin título.md",
    });
  });
});

describe("useDocumentView", () => {
  it("usa la vista guardada del documento cuando es válida", () => {
    const active = doc({ viewState: { mode: "preview" } });

    const { result } = renderHook(() =>
      useDocumentView({ active, root: "/notas", defaultView: "split" }),
    );

    expect(result.current.mode).toBe("preview");
  });

  it("cae a la vista por defecto si el documento no tiene una válida", () => {
    const active = doc({ viewState: { mode: "otra-cosa" } });

    const { result } = renderHook(() =>
      useDocumentView({ active, root: "/notas", defaultView: "editor" }),
    );

    expect(result.current.mode).toBe("editor");
  });

  it("guarda la nueva vista sin perder el resto del estado de vista", () => {
    const active = doc({ viewState: { line: 4, column: 2 } });

    const { result } = renderHook(() =>
      useDocumentView({ active, root: "/notas", defaultView: "split" }),
    );

    act(() => {
      result.current.handleModeChange("preview");
    });

    expect(setViewState).toHaveBeenCalledWith("doc-1", {
      line: 4,
      column: 2,
      mode: "preview",
    });
  });

  it("expone cruces, estadísticas y cursor del documento activo", () => {
    const active = doc({ viewState: { line: 3, column: 7 } });

    const { result } = renderHook(() =>
      useDocumentView({ active, root: "/notas", defaultView: "split" }),
    );

    expect(result.current.crumbs).toEqual({
      rootName: "notas",
      folders: [],
      fileName: "diario.md",
    });
    expect(result.current.stats.words).toBe(4);
    expect(result.current.stats.lines).toBe(3);
    expect(result.current.cursor).toEqual({ line: 3, column: 7 });
  });

  it("sin documento no hay cruces ni cursor y no escribe estado", () => {
    const { result } = renderHook(() =>
      useDocumentView({ active: null, root: "/notas", defaultView: "split" }),
    );

    act(() => {
      result.current.handleModeChange("preview");
      result.current.handleSplitLayoutChange({ editor: 50, preview: 50 });
    });

    expect(result.current.crumbs).toBeNull();
    expect(result.current.cursor).toBeUndefined();
    expect(result.current.splitLayout).toBeUndefined();
    expect(setViewState).not.toHaveBeenCalled();
  });

  it("recuerda el reparto del divisor en el estado de vista del documento", () => {
    const active = doc({ viewState: { mode: "split", line: 2 } });

    const { result } = renderHook(() =>
      useDocumentView({ active, root: "/notas", defaultView: "split" }),
    );

    act(() => {
      result.current.handleSplitLayoutChange({ editor: 60, preview: 40 });
    });

    expect(setViewState).toHaveBeenCalledWith("doc-1", {
      mode: "split",
      line: 2,
      splitLayout: { editor: 60, preview: 40 },
    });
  });
});
