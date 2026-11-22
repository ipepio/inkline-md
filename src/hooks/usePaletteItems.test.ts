import { describe, expect, it } from "vitest";
import type { OpenDocument } from "@/lib/documents";
import type { TreeNode } from "@/lib/workspace";
import { paletteDocuments, usePaletteItems } from "./usePaletteItems";
import { renderHook } from "@testing-library/react";

function doc(overrides: Partial<OpenDocument> = {}): OpenDocument {
  return {
    id: "doc-1",
    path: "/notas/diario.md",
    name: "diario.md",
    contents: "",
    dirty: false,
    viewState: {},
    ...overrides,
  };
}

describe("paletteDocuments", () => {
  it("mapea los documentos abiertos con su nombre visible", () => {
    expect(paletteDocuments([doc(), doc({ id: "doc-2", path: "/notas/idea.md" })])).toEqual([
      { id: "doc-1", name: "diario.md", path: "/notas/diario.md" },
      { id: "doc-2", name: "idea.md", path: "/notas/idea.md" },
    ]);
  });

  it("deja la ruta vacía en los documentos sin archivo y los etiqueta", () => {
    expect(paletteDocuments([doc({ path: "untitled://9-1" })])).toEqual([
      { id: "doc-1", name: "Sin título.md", path: "" },
    ]);
  });
});

describe("usePaletteItems", () => {
  it("aplana el árbol y conserva el orden de los documentos", () => {
    const tree: TreeNode[] = [
      {
        name: "notas",
        path: "/notas",
        isDir: true,
        children: [{ name: "idea.md", path: "/notas/idea.md", isDir: false, children: [] }],
      },
      { name: "suelto.md", path: "/suelto.md", isDir: false, children: [] },
    ];

    const { result } = renderHook(() => usePaletteItems(tree, [doc(), doc({ id: "doc-2" })]));

    expect(result.current.paletteFiles).toEqual(["/notas/idea.md", "/suelto.md"]);
    expect(result.current.paletteDocs.map((entry) => entry.id)).toEqual(["doc-1", "doc-2"]);
  });
});
