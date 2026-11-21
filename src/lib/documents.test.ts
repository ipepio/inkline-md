import { beforeEach, describe, expect, it } from "vitest";
import {
  closeDoc,
  getDocumentsSnapshot,
  markSaved,
  openDoc,
  resetDocuments,
  selectDoc,
  setContents,
  setViewState,
  subscribeDocuments,
} from "./documents";

function activeId(): string | null {
  return getDocumentsSnapshot().activeId;
}

function docById(id: string) {
  return getDocumentsSnapshot().docs.find((doc) => doc.id === id);
}

describe("documents store", () => {
  beforeEach(() => {
    resetDocuments();
  });

  it("abre un documento, lo marca sucio al editar y limpio al guardar", () => {
    const id = openDoc("/tmp/espacio/nota.md", "# Nota");

    expect(getDocumentsSnapshot().docs).toHaveLength(1);
    expect(activeId()).toBe(id);
    expect(docById(id)).toMatchObject({
      path: "/tmp/espacio/nota.md",
      name: "nota.md",
      contents: "# Nota",
      dirty: false,
      viewState: {},
    });

    setContents(id, "# Nota editada");
    expect(docById(id)).toMatchObject({ contents: "# Nota editada", dirty: true });

    markSaved(id);
    expect(docById(id)?.dirty).toBe(false);
  });

  it("no duplica la pestaña al reabrir la misma ruta y conserva lo editado", () => {
    const id = openDoc("/tmp/espacio/nota.md", "uno");
    setContents(id, "dos");

    const again = openDoc("/tmp/espacio/nota.md", "contenido del disco");

    expect(again).toBe(id);
    expect(getDocumentsSnapshot().docs).toHaveLength(1);
    expect(docById(id)?.contents).toBe("dos");
  });

  it("cierra una pestaña activa y activa la vecina", () => {
    const first = openDoc("/tmp/a.md", "a");
    const second = openDoc("/tmp/b.md", "b");
    expect(activeId()).toBe(second);

    closeDoc(second);
    expect(getDocumentsSnapshot().docs).toHaveLength(1);
    expect(activeId()).toBe(first);

    closeDoc(first);
    expect(getDocumentsSnapshot().docs).toHaveLength(0);
    expect(activeId()).toBeNull();
  });

  it("cambia activeId con selectDoc e ignora ids desconocidos", () => {
    const first = openDoc("/tmp/a.md", "a");
    const second = openDoc("/tmp/b.md", "b");

    selectDoc(first);
    expect(activeId()).toBe(first);

    selectDoc("doc-inexistente");
    expect(activeId()).toBe(first);
    expect(getDocumentsSnapshot().docs.map((doc) => doc.id)).toEqual([first, second]);
  });

  it("conserva viewState por documento", () => {
    const id = openDoc("/tmp/a.md", "a");
    const other = openDoc("/tmp/b.md", "b");

    setViewState(id, { cursor: 12, scroll: 240 });
    expect(docById(id)?.viewState).toEqual({ cursor: 12, scroll: 240 });
    expect(docById(other)?.viewState).toEqual({});
    expect(docById(id)?.dirty).toBe(false);
  });

  it("avisa a los suscriptores y deja de hacerlo al desuscribirse", () => {
    let calls = 0;
    const unsubscribe = subscribeDocuments(() => {
      calls += 1;
    });

    const id = openDoc("/tmp/a.md", "a");
    setContents(id, "b");
    expect(calls).toBe(2);

    unsubscribe();
    markSaved(id);
    expect(calls).toBe(2);
  });
});
