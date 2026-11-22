import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import type { OpenDocument } from "@/lib/documents";
import { documentCrumbs, useDocumentView } from "./useDocumentView";

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

// T3: la vista es del grupo, así que el hook ya no lee ni escribe el modo del
// documento (antes lo guardaba en `viewState.mode`).
describe("useDocumentView", () => {
  it("expone cruces, estadísticas y cursor del documento activo", () => {
    const active = doc({ viewState: { line: 3, column: 7 } });

    const { result } = renderHook(() => useDocumentView({ active, root: "/notas" }));

    expect(result.current.crumbs).toEqual({
      rootName: "notas",
      folders: [],
      fileName: "diario.md",
    });
    expect(result.current.stats.words).toBe(4);
    expect(result.current.stats.lines).toBe(3);
    expect(result.current.cursor).toEqual({ line: 3, column: 7 });
  });

  it("sin documento no hay cruces ni cursor", () => {
    const { result } = renderHook(() => useDocumentView({ active: null, root: "/notas" }));

    expect(result.current.crumbs).toBeNull();
    expect(result.current.cursor).toBeUndefined();
    expect(result.current.stats.words).toBe(0);
  });

  it("no publica ninguna vista: eso es del grupo", () => {
    const active = doc({ viewState: { mode: "preview" } });

    const { result } = renderHook(() => useDocumentView({ active, root: "/notas" }));

    expect(result.current).not.toHaveProperty("mode");
    expect(result.current).not.toHaveProperty("handleModeChange");
  });
});
