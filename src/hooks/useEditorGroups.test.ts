/**
 * Pegamento React de los grupos (ODD editor groups · T3).
 *
 * El reducer ya está probado en `editorGroups.test.ts`; aquí sólo se verifica
 * lo que añade el hook: la vista inicial del primer grupo, el documento activo
 * del grupo con foco y el puente mínimo con el almacén único de documentos
 * (abrir deja el documento en el grupo enfocado, sin llenar el grupo nuevo de
 * ⌘D).
 */

import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { OpenDocument } from "@/lib/documents";
import type { DefaultView } from "@/lib/settings";
import { useEditorGroups } from "./useEditorGroups";

function doc(id: string, path = `/notas/${id}.md`): OpenDocument {
  return {
    id,
    path,
    name: `${id}.md`,
    contents: `# ${id}`,
    dirty: false,
    viewState: {},
  };
}

const A = doc("doc-a");
const B = doc("doc-b");

interface Props {
  docs: OpenDocument[];
  activeId: string | null;
}

function setup(
  initialDocs: OpenDocument[] = [],
  initialActiveId: string | null = null,
  defaultView: DefaultView = "editor",
) {
  return renderHook(
    (props: Props) => useEditorGroups({ defaultView, docs: props.docs, activeId: props.activeId }),
    { initialProps: { docs: initialDocs, activeId: initialActiveId } satisfies Props },
  );
}

describe("useEditorGroups", () => {
  it("arranca con un grupo en la vista por defecto y sin documento", () => {
    const { result } = setup([], null, "split");

    expect(result.current.groups).toEqual([
      { id: "1", docIds: [], activeDocId: null, mode: "split" },
    ]);
    expect(result.current.focusedGroupId).toBe("1");
    expect(result.current.focusedGroup.id).toBe("1");
    expect(result.current.focusedDoc).toBeNull();
  });

  it("expone el documento activo del grupo enfocado", () => {
    const { result } = setup([A, B], B.id);

    expect(result.current.groups[0].activeDocId).toBe(B.id);
    expect(result.current.focusedDoc?.id).toBe(B.id);
  });

  it("abre en el grupo enfocado el documento que se selecciona", () => {
    const { result, rerender } = setup();

    rerender({ docs: [A], activeId: A.id });

    expect(result.current.groups[0].docIds).toEqual([A.id]);
    expect(result.current.groups[0].activeDocId).toBe(A.id);
    expect(result.current.focusedDoc?.id).toBe(A.id);
  });

  // S4: dividir deja el grupo nuevo vacío aunque ya hubiera un documento
  // abierto; el enlace con el almacén no debe rellenarlo solo.
  it("no llena el grupo nuevo al dividir", () => {
    const { result } = setup([A], A.id);

    act(() => {
      result.current.split();
    });

    expect(result.current.groups).toHaveLength(2);
    expect(result.current.groups[1]).toEqual(expect.objectContaining({ docIds: [], activeDocId: null }));
    expect(result.current.focusedGroupId).toBe("2");
    expect(result.current.focusedDoc).toBeNull();
  });

  // S1 · S2: con dos grupos, lo que se abre después cae en el grupo con foco y
  // el otro conserva su documento.
  it("abre en el segundo grupo sin tocar el primero", () => {
    const { result, rerender } = setup([A], A.id);

    act(() => {
      result.current.split();
    });

    rerender({ docs: [A, B], activeId: B.id });

    expect(result.current.groups[0].docIds).toEqual([A.id]);
    expect(result.current.groups[1].docIds).toEqual([B.id]);
    expect(result.current.focusedDoc?.id).toBe(B.id);
  });

  it("enfocar un grupo no duplica ni mueve documentos", () => {
    const { result, rerender } = setup([A], A.id);
    act(() => {
      result.current.split();
    });
    rerender({ docs: [A, B], activeId: B.id });

    act(() => {
      result.current.focusGroup("1");
    });

    expect(result.current.focusedGroupId).toBe("1");
    expect(result.current.groups[0].docIds).toEqual([A.id]);
    expect(result.current.groups[1].docIds).toEqual([B.id]);
  });

  it("cambia la vista de un solo grupo", () => {
    const { result } = setup();

    act(() => {
      result.current.setMode("1", "preview");
    });

    expect(result.current.groups[0].mode).toBe("preview");
  });

  it("cerrar el grupo con foco deja al superviviente sus documentos", () => {
    const { result, rerender } = setup([A], A.id);
    act(() => {
      result.current.split();
    });
    rerender({ docs: [A, B], activeId: B.id });

    act(() => {
      result.current.closeGroup("2");
    });

    // S5: las pestañas del grupo cerrado pasan al superviviente, sin perder nada.
    expect(result.current.groups).toHaveLength(1);
    expect(result.current.groups[0].docIds).toEqual([A.id, B.id]);
    expect(result.current.focusedGroupId).toBe("1");
    expect(result.current.focusedDoc?.id).toBe(A.id);
  });

  it("sin grupo no hay documento aunque el almacén tarde en vaciarse", () => {
    const { result, rerender } = setup([A], A.id);

    rerender({ docs: [], activeId: null });

    expect(result.current.focusedDoc).toBeNull();
  });
});
