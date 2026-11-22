/**
 * Modelo de grupos (ODD editor groups · T2).
 *
 * Cada caso pasa por `apply`, que verifica dos cosas que valen para toda
 * acción: el reducer no muta el estado recibido y el estado devuelto sigue
 * cumpliendo los invariantes del modelo. Las acciones sin efecto comprueban
 * además que se devuelve el MISMO objeto (no hay re-render inútil).
 */

import { describe, expect, it } from "vitest";
import type { WorkspaceMode } from "@/lib/editor/mode";
import {
  createInitialEditorGroups,
  editorGroupsReducer,
  focusedGroup,
  groupById,
  GROUP_IDS,
  isSplit,
  type EditorGroupsAction,
  type EditorGroupsState,
} from "./editorGroups";

const A = "doc-a";
const B = "doc-b";
const C = "doc-c";
const D = "doc-d";

/** Invariantes 1–5 del módulo, comprobados sobre cualquier estado alcanzable. */
function expectInvariants(state: EditorGroupsState): void {
  expect(state.groups.length).toBeGreaterThanOrEqual(1);
  expect(state.groups.length).toBeLessThanOrEqual(2);
  expect(state.groups[0]).toBeDefined();

  const ids = state.groups.map((group) => group.id);
  expect(new Set(ids).size).toBe(ids.length);
  for (const id of ids) expect(GROUP_IDS).toContain(id);
  expect(ids).toContain(state.focusedGroupId);

  for (const group of state.groups) {
    // Invariante 4: sin ids repetidos dentro de un grupo.
    expect(new Set(group.docIds).size).toBe(group.docIds.length);
    // Invariante 3: activo nulo sólo sin pestañas; si no, una de sus pestañas.
    if (group.docIds.length > 0) expect(group.activeDocId).not.toBeNull();
    if (group.activeDocId !== null) expect(group.docIds).toContain(group.activeDocId);
  }
}

function initial(): EditorGroupsState {
  const state = createInitialEditorGroups();
  expectInvariants(state);
  return state;
}

function sequence(actions: EditorGroupsAction[]): EditorGroupsState {
  return actions.reduce<EditorGroupsState>((state, action) => apply(state, action), initial());
}

function apply(state: EditorGroupsState, action: EditorGroupsAction): EditorGroupsState {
  const snapshot = JSON.parse(JSON.stringify(state)) as EditorGroupsState;
  const next = editorGroupsReducer(state, action);
  expect(state).toEqual(snapshot);
  expectInvariants(next);
  return next;
}

describe("estado inicial", () => {
  it("arranca con un grupo vacío, en modo editor y con foco", () => {
    const state = createInitialEditorGroups();
    expectInvariants(state);
    expect(state.groups).toEqual([
      { id: "1", docIds: [], activeDocId: null, mode: "editor" },
    ]);
    expect(state.focusedGroupId).toBe("1");
    expect(isSplit(state)).toBe(false);
    expect(focusedGroup(state).id).toBe("1");
  });

  it("acepta la vista por defecto de las preferencias para el primer grupo", () => {
    const state = createInitialEditorGroups("preview");
    expectInvariants(state);
    expect(focusedGroup(state).mode).toBe("preview");
  });
});

describe("SPLIT (⌘D · S1 · S3 · S4)", () => {
  it("divide en dos: el grupo nuevo nace vacío, en editor y con el foco", () => {
    const before = sequence([{ type: "OPEN_DOC", docId: A }, { type: "SET_MODE", mode: "split" }]);
    expect(isSplit(before)).toBe(false);

    const next = apply(before, { type: "SPLIT" });
    expect(next.groups).toHaveLength(2);
    expect(next.groups[0]).toEqual(before.groups[0]);
    expect(next.groups[1]).toEqual({ id: "2", docIds: [], activeDocId: null, mode: "editor" });
    expect(next.focusedGroupId).toBe("2");
    expect(focusedGroup(next).docIds).toEqual([]);
  });

  it("es no-op con dos grupos (máximo 2, S1)", () => {
    const state = sequence([{ type: "SPLIT" }]);
    expect(apply(state, { type: "SPLIT" })).toBe(state);
  });

  it("reutiliza el id libre cuando el superviviente es el grupo 2", () => {
    const oneGroup = sequence([{ type: "SPLIT" }, { type: "CLOSE_GROUP", id: "1" }]);
    expect(oneGroup.groups).toEqual([{ id: "2", docIds: [], activeDocId: null, mode: "editor" }]);
    expect(oneGroup.focusedGroupId).toBe("2");

    const next = apply(oneGroup, { type: "SPLIT" });
    expect(next.groups.map((group) => group.id)).toEqual(["2", "1"]);
    expect(focusedGroup(next).id).toBe("1");
    expect(focusedGroup(next).docIds).toEqual([]);
    expect(focusedGroup(next).mode).toBe("editor");
    expect(next.focusedGroupId).toBe("1");
  });

  it("no hereda los documentos del grupo 1 (S4)", () => {
    const state = sequence([{ type: "OPEN_DOC", docId: A }, { type: "OPEN_DOC", docId: B }]);
    const next = apply(state, { type: "SPLIT" });
    expect(next.groups[0].docIds).toEqual([A, B]);
    expect(next.groups[1].docIds).toEqual([]);
    expect(next.groups[1].activeDocId).toBeNull();
  });
});

describe("CLOSE_GROUP (cruz por grupo · S5)", () => {
    it("cierra el grupo no enfocado y mergea sus pestañas en el superviviente", () => {
      const state = sequence([
        { type: "OPEN_DOC", docId: A },
        { type: "OPEN_DOC", docId: B },
        { type: "SPLIT" },
        { type: "OPEN_DOC", docId: C },
        { type: "OPEN_DOC", docId: D },
        { type: "FOCUS_GROUP", groupId: "1" },
      ]);
      expect(state.focusedGroupId).toBe("1");

      const next = apply(state, { type: "CLOSE_GROUP", id: "2" });
      expect(next.groups).toHaveLength(1);
      expect(next.groups[0].id).toBe("1");
      expect(next.groups[0].docIds).toEqual([A, B, C, D]);
      expect(next.groups[0].activeDocId).toBe(B);
      expect(next.focusedGroupId).toBe("1");
      expect(isSplit(next)).toBe(false);
    });

    it("cierra el grupo enfocado y mueve el foco al superviviente", () => {
      const state = sequence([
        { type: "OPEN_DOC", docId: A },
        { type: "OPEN_DOC", docId: B },
        { type: "SPLIT" },
        { type: "OPEN_DOC", docId: C },
        { type: "OPEN_DOC", docId: D },
        { type: "FOCUS_GROUP", groupId: "1" },
      ]);

      const next = apply(state, { type: "CLOSE_GROUP", id: "1" });
      expect(next.groups).toHaveLength(1);
      expect(next.groups[0].id).toBe("2");
      expect(next.groups[0].docIds).toEqual([C, D, A, B]);
      expect(next.groups[0].activeDocId).toBe(D);
      expect(next.focusedGroupId).toBe("2");
      expect(focusedGroup(next).id).toBe("2");
    });

    it("sin id cierra el grupo enfocado", () => {
      const state = sequence([{ type: "OPEN_DOC", docId: A }, { type: "SPLIT" }]);
      expect(state.focusedGroupId).toBe("2");

      const next = apply(state, { type: "CLOSE_GROUP" });
      expect(next.groups).toHaveLength(1);
      expect(next.groups[0].docIds).toEqual([A]);
      expect(next.focusedGroupId).toBe("1");
    });

    it("no duplica el documento que vivía en los dos grupos (S7)", () => {
      const state = sequence([
        { type: "OPEN_DOC", docId: A },
        { type: "OPEN_DOC", docId: B },
        { type: "SPLIT" },
        { type: "OPEN_DOC", docId: B },
        { type: "OPEN_DOC", docId: C },
        { type: "FOCUS_GROUP", groupId: "1" },
      ]);
      expect(state.groups[1].docIds).toEqual([B, C]);

      const next = apply(state, { type: "CLOSE_GROUP", id: "2" });
      expect(next.groups[0].docIds).toEqual([A, B, C]);
      expect(next.groups[0].activeDocId).toBe(B);
    });

    it("adopta la primera pestaña heredada si el superviviente estaba vacío", () => {
      const state = sequence([
        { type: "OPEN_DOC", docId: A },
        { type: "OPEN_DOC", docId: B },
        { type: "SPLIT" },
      ]);
      expect(focusedGroup(state).docIds).toEqual([]);

      const next = apply(state, { type: "CLOSE_GROUP", id: "1" });
      expect(next.groups[0].id).toBe("2");
      expect(next.groups[0].docIds).toEqual([A, B]);
      expect(next.groups[0].activeDocId).toBe(A);
      expect(next.focusedGroupId).toBe("2");
    });

    it("el superviviente conserva su propia vista", () => {
      const state = sequence([
        { type: "OPEN_DOC", docId: A },
        { type: "SPLIT" },
        { type: "SET_MODE", mode: "preview" },
        { type: "FOCUS_GROUP", groupId: "1" },
        { type: "SET_MODE", mode: "split" },
      ]);

      const next = apply(state, { type: "CLOSE_GROUP", id: "2" });
      expect(next.groups[0].mode).toBe("split");
    });

    it("es no-op con un solo grupo", () => {
      const state = sequence([{ type: "OPEN_DOC", docId: A }]);
      expect(apply(state, { type: "CLOSE_GROUP" })).toBe(state);
      expect(apply(state, { type: "CLOSE_GROUP", id: "1" })).toBe(state);
    });

    it("es no-op con un id de grupo desconocido", () => {
      const state = sequence([{ type: "OPEN_DOC", docId: A }]);
      expect(apply(state, { type: "CLOSE_GROUP", id: "2" })).toBe(state);
    });
});

describe("OPEN_DOC (⌘O/⌘N · S2 · S7)", () => {
  it("abre en el grupo enfocado: al final y activo", () => {
    const state = sequence([{ type: "OPEN_DOC", docId: A }]);
    const next = apply(state, { type: "OPEN_DOC", docId: B });
    expect(next.groups[0].docIds).toEqual([A, B]);
    expect(next.groups[0].activeDocId).toBe(B);
    expect(next.focusedGroupId).toBe("1");
  });

  it("abre en el grupo indicado sin mover el foco", () => {
    const state = sequence([{ type: "SPLIT" }]);
    expect(state.focusedGroupId).toBe("2");

    const next = apply(state, { type: "OPEN_DOC", docId: A, groupId: "1" });
    expect(next.groups[0].docIds).toEqual([A]);
    expect(next.groups[0].activeDocId).toBe(A);
    expect(next.groups[1].docIds).toEqual([]);
    expect(next.focusedGroupId).toBe("2");
  });

  it("un documento que ya está en el grupo sólo pasa a activo", () => {
    const state = sequence([{ type: "OPEN_DOC", docId: A }, { type: "OPEN_DOC", docId: B }]);
    expect(state.groups[0].activeDocId).toBe(B);

    const next = apply(state, { type: "OPEN_DOC", docId: A });
    expect(next.groups[0].docIds).toEqual([A, B]);
    expect(next.groups[0].activeDocId).toBe(A);
  });

  it("es no-op si el documento ya está activo", () => {
    const state = sequence([{ type: "OPEN_DOC", docId: A }]);
    expect(apply(state, { type: "OPEN_DOC", docId: A })).toBe(state);
  });

  it("abre el mismo documento en los dos grupos (S7)", () => {
    const state = sequence([{ type: "OPEN_DOC", docId: A }, { type: "SPLIT" }]);
    const next = apply(state, { type: "OPEN_DOC", docId: A });
    expect(next.groups[0].docIds).toEqual([A]);
    expect(next.groups[1].docIds).toEqual([A]);
    expect(next.groups[0].activeDocId).toBe(A);
    expect(next.groups[1].activeDocId).toBe(A);
  });

  it("es no-op con un id de grupo desconocido", () => {
    const state = sequence([{ type: "OPEN_DOC", docId: A }]);
    expect(apply(state, { type: "OPEN_DOC", docId: B, groupId: "2" })).toBe(state);
  });

  it("es no-op con un id de documento vacío", () => {
    const state = sequence([{ type: "OPEN_DOC", docId: A }]);
    expect(apply(state, { type: "OPEN_DOC", docId: "" })).toBe(state);
  });
});

describe("CLOSE_DOC (⌘W · S5)", () => {
  it("cierra un documento no activo sin cambiar el activo", () => {
    const state = sequence([
      { type: "OPEN_DOC", docId: A },
      { type: "OPEN_DOC", docId: B },
      { type: "OPEN_DOC", docId: C },
    ]);
    expect(state.groups[0].activeDocId).toBe(C);

    const next = apply(state, { type: "CLOSE_DOC", docId: A });
    expect(next.groups[0].docIds).toEqual([B, C]);
    expect(next.groups[0].activeDocId).toBe(C);
  });

  it("activa la pestaña anterior al cerrar la activa", () => {
    const state = sequence([
      { type: "OPEN_DOC", docId: A },
      { type: "OPEN_DOC", docId: B },
      { type: "OPEN_DOC", docId: C },
    ]);

    const next = apply(state, { type: "CLOSE_DOC", docId: C });
    expect(next.groups[0].docIds).toEqual([A, B]);
    expect(next.groups[0].activeDocId).toBe(B);
  });

  it("activa la pestaña siguiente al cerrar la activa sin anterior", () => {
    const state = sequence([
      { type: "OPEN_DOC", docId: A },
      { type: "OPEN_DOC", docId: B },
      { type: "OPEN_DOC", docId: C },
      { type: "OPEN_DOC", docId: A },
    ]);
    expect(state.groups[0].activeDocId).toBe(A);

    const next = apply(state, { type: "CLOSE_DOC", docId: A });
    expect(next.groups[0].docIds).toEqual([B, C]);
    expect(next.groups[0].activeDocId).toBe(B);
  });

  it("prefiere la anterior a la siguiente cuando cierra una intermedia", () => {
    const state = sequence([
      { type: "OPEN_DOC", docId: A },
      { type: "OPEN_DOC", docId: B },
      { type: "OPEN_DOC", docId: C },
      { type: "OPEN_DOC", docId: B },
    ]);
    expect(state.groups[0].activeDocId).toBe(B);

    const next = apply(state, { type: "CLOSE_DOC", docId: B });
    expect(next.groups[0].docIds).toEqual([A, C]);
    expect(next.groups[0].activeDocId).toBe(A);
  });

  it("cierra el grupo 2 al quedarse sin documentos y enfoca el superviviente", () => {
    const state = sequence([
      { type: "OPEN_DOC", docId: A },
      { type: "SPLIT" },
      { type: "OPEN_DOC", docId: B },
    ]);
    expect(state.focusedGroupId).toBe("2");

    const next = apply(state, { type: "CLOSE_DOC", docId: B });
    expect(next.groups).toHaveLength(1);
    expect(next.groups[0].id).toBe("1");
    expect(next.groups[0].docIds).toEqual([A]);
    expect(next.groups[0].activeDocId).toBe(A);
    expect(next.focusedGroupId).toBe("1");
  });

  it("cierra el grupo 1 no enfocado y deja el foco en el superviviente", () => {
    const state = sequence([
      { type: "OPEN_DOC", docId: A },
      { type: "SPLIT" },
      { type: "OPEN_DOC", docId: B },
    ]);
    expect(state.focusedGroupId).toBe("2");

    const next = apply(state, { type: "CLOSE_DOC", docId: A, groupId: "1" });
    expect(next.groups).toHaveLength(1);
    expect(next.groups[0].id).toBe("2");
    expect(next.groups[0].docIds).toEqual([B]);
    expect(next.groups[0].activeDocId).toBe(B);
    expect(next.focusedGroupId).toBe("2");
  });

  it("deja el grupo vacío si era el único grupo", () => {
    const state = sequence([{ type: "OPEN_DOC", docId: A }, { type: "SET_MODE", mode: "preview" }]);

    const next = apply(state, { type: "CLOSE_DOC", docId: A });
    expect(next.groups).toHaveLength(1);
    expect(next.groups[0].docIds).toEqual([]);
    expect(next.groups[0].activeDocId).toBeNull();
    expect(next.groups[0].mode).toBe("preview");
  });

  it("colapsa a un grupo aunque el superviviente esté vacío", () => {
    const state = sequence([{ type: "SPLIT" }, { type: "OPEN_DOC", docId: B }]);
    const next = apply(state, { type: "CLOSE_DOC", docId: B });
    expect(next.groups).toHaveLength(1);
    expect(next.groups[0].id).toBe("1");
    expect(next.groups[0].docIds).toEqual([]);
    expect(next.groups[0].activeDocId).toBeNull();
    expect(next.focusedGroupId).toBe("1");
  });

  it("no pierde las pestañas del superviviente", () => {
    const state = sequence([
      { type: "OPEN_DOC", docId: A },
      { type: "OPEN_DOC", docId: B },
      { type: "SPLIT" },
      { type: "OPEN_DOC", docId: C },
      { type: "FOCUS_GROUP", groupId: "1" },
    ]);

    const next = apply(state, { type: "CLOSE_DOC", docId: C, groupId: "2" });
    expect(next.groups).toHaveLength(1);
    expect(next.groups[0].docIds).toEqual([A, B]);
    expect(next.groups[0].activeDocId).toBe(B);
    expect(next.focusedGroupId).toBe("1");
  });

  it("cierra en el grupo indicado sin mover el foco", () => {
    const state = sequence([
      { type: "OPEN_DOC", docId: A },
      { type: "OPEN_DOC", docId: B },
      { type: "SPLIT" },
      { type: "OPEN_DOC", docId: C },
    ]);
    expect(state.focusedGroupId).toBe("2");

    const next = apply(state, { type: "CLOSE_DOC", docId: B, groupId: "1" });
    expect(next.focusedGroupId).toBe("2");
    expect(next.groups[0].docIds).toEqual([A]);
    expect(next.groups[0].activeDocId).toBe(A);
    expect(next.groups[1].docIds).toEqual([C]);
  });

  it("es no-op con un documento que no está en el grupo", () => {
    const state = sequence([{ type: "OPEN_DOC", docId: A }]);
    expect(apply(state, { type: "CLOSE_DOC", docId: B })).toBe(state);
  });

  it("es no-op con un id de grupo desconocido", () => {
    const state = sequence([{ type: "OPEN_DOC", docId: A }]);
    expect(apply(state, { type: "CLOSE_DOC", docId: A, groupId: "2" })).toBe(state);
  });
});

describe("ACTIVATE_DOC (clic en pestaña · S6)", () => {
  it("activa la pestaña sin reordenar ni cambiar el foco", () => {
    const state = sequence([{ type: "OPEN_DOC", docId: A }, { type: "OPEN_DOC", docId: B }]);

    const next = apply(state, { type: "ACTIVATE_DOC", docId: A });
    expect(next.groups[0].docIds).toEqual([A, B]);
    expect(next.groups[0].activeDocId).toBe(A);
    expect(next.focusedGroupId).toBe("1");
  });

  it("activa en el grupo indicado sin mover el foco", () => {
    const state = sequence([
      { type: "OPEN_DOC", docId: A },
      { type: "SPLIT" },
      { type: "OPEN_DOC", docId: B, groupId: "1" },
      { type: "OPEN_DOC", docId: C },
    ]);

    const next = apply(state, { type: "ACTIVATE_DOC", docId: B, groupId: "1" });
    expect(next.groups[0].activeDocId).toBe(B);
    expect(next.focusedGroupId).toBe("2");
    expect(next.groups[1].activeDocId).toBe(C);
  });

  it("es no-op si el documento no está en el grupo", () => {
    const state = sequence([{ type: "OPEN_DOC", docId: A }]);
    expect(apply(state, { type: "ACTIVATE_DOC", docId: B })).toBe(state);
    // El mismo documento en el otro grupo tampoco activa nada aquí.
    const split = apply(state, { type: "SPLIT" });
    expect(apply(split, { type: "ACTIVATE_DOC", docId: A, groupId: "2" })).toBe(split);
  });

  it("es no-op si la pestaña ya está activa o el grupo no existe", () => {
    const state = sequence([{ type: "OPEN_DOC", docId: A }]);
    expect(apply(state, { type: "ACTIVATE_DOC", docId: A })).toBe(state);
    expect(apply(state, { type: "ACTIVATE_DOC", docId: A, groupId: "2" })).toBe(state);
  });
});

describe("FOCUS_GROUP (foco del shell · S4 · S6)", () => {
  it("mueve el foco sin tocar los grupos", () => {
    const state = sequence([{ type: "SPLIT" }]);
    expect(state.focusedGroupId).toBe("2");

    const next = apply(state, { type: "FOCUS_GROUP", groupId: "1" });
    expect(next.focusedGroupId).toBe("1");
    expect(next.groups).toBe(state.groups);
    expect(focusedGroup(next).docIds).toEqual([]);
  });

  it("el grupo enfocado recibe lo que se abre después (S2)", () => {
    const state = sequence([
      { type: "SPLIT" },
      { type: "FOCUS_GROUP", groupId: "1" },
      { type: "OPEN_DOC", docId: A },
      { type: "OPEN_DOC", docId: B },
    ]);
    expect(state.groups[0].docIds).toEqual([A, B]);
    expect(state.groups[1].docIds).toEqual([]);
  });

  it("es no-op si ya tiene ese foco", () => {
    const state = sequence([{ type: "SPLIT" }]);
    expect(apply(state, { type: "FOCUS_GROUP", groupId: "2" })).toBe(state);
  });

  it("es no-op con un id de grupo que no existe", () => {
    const state = sequence([{ type: "OPEN_DOC", docId: A }]);
    expect(apply(state, { type: "FOCUS_GROUP", groupId: "2" })).toBe(state);
  });

  it("lanza error si el estado es inconsistente (guarda de invariante 2)", () => {
    const broken: EditorGroupsState = {
      groups: [{ id: "1", docIds: [], activeDocId: null, mode: "editor" }],
      focusedGroupId: "2",
    };
    expect(() => focusedGroup(broken)).toThrow(/grupo 2/);
  });
});

describe("SET_MODE (vista por grupo · S3)", () => {
  it("cambia sólo la vista del grupo enfocado", () => {
    const state = sequence([
      { type: "OPEN_DOC", docId: A },
      { type: "OPEN_DOC", docId: B },
      { type: "SPLIT" },
      { type: "OPEN_DOC", docId: C },
    ]);
    expect(state.focusedGroupId).toBe("2");

    const next = apply(state, { type: "SET_MODE", mode: "preview" });
    expect(next.groups[1].mode).toBe("preview");
    expect(next.groups[0].mode).toBe("editor");
  });

  it("los dos grupos pueden tener vistas distintas a la vez (S1 · S3)", () => {
    const state = sequence([
      { type: "OPEN_DOC", docId: A },
      { type: "OPEN_DOC", docId: B },
      { type: "SPLIT" },
      { type: "OPEN_DOC", docId: C },
      { type: "SET_MODE", mode: "preview" },
      { type: "SET_MODE", mode: "split", groupId: "1" },
    ]);
    expect(state.groups[0].mode).toBe("split");
    expect(state.groups[1].mode).toBe("preview");

    const next = apply(state, { type: "SET_MODE", mode: "editor", groupId: "2" });
    expect(next.groups[0].mode).toBe("split");
    expect(next.groups[1].mode).toBe("editor");
  });

  it("es no-op con la misma vista", () => {
    const state = sequence([{ type: "SPLIT" }]);
    expect(apply(state, { type: "SET_MODE", mode: "editor" })).toBe(state);
  });

  it("es no-op con una vista desconocida", () => {
    const state = sequence([{ type: "SPLIT" }]);
    expect(apply(state, { type: "SET_MODE", mode: "nope" as WorkspaceMode })).toBe(state);
  });

  it("es no-op con un id de grupo desconocido", () => {
    const state = sequence([{ type: "OPEN_DOC", docId: A }]);
    expect(apply(state, { type: "SET_MODE", mode: "preview", groupId: "2" })).toBe(state);
  });
});

describe("selectores", () => {
  it("groupById devuelve el grupo pedido o undefined", () => {
    const state = sequence([{ type: "OPEN_DOC", docId: A }, { type: "SPLIT" }]);
    expect(groupById(state, "1")?.docIds).toEqual([A]);
    expect(groupById(state, "2")?.docIds).toEqual([]);
    expect(groupById(state, "2")).toBe(state.groups[1]);

    const single = sequence([{ type: "OPEN_DOC", docId: A }]);
    expect(groupById(single, "2")).toBeUndefined();
  });
});

describe("secuencias", () => {
  it("mantiene los invariantes a lo largo de una secuencia larga", () => {
    const actions: EditorGroupsAction[] = [
      { type: "OPEN_DOC", docId: A },
      { type: "SPLIT" },
      { type: "OPEN_DOC", docId: B },
      { type: "SET_MODE", mode: "split" },
      { type: "OPEN_DOC", docId: A },
      { type: "ACTIVATE_DOC", docId: B },
      { type: "CLOSE_DOC", docId: B },
      { type: "CLOSE_DOC", docId: A },
      { type: "SPLIT" },
      { type: "OPEN_DOC", docId: C },
      { type: "CLOSE_GROUP", id: "2" },
    ];
    const state = sequence(actions);
    expect(isSplit(state)).toBe(false);
    expect(state.groups).toHaveLength(1);
    expect(state.groups[0].docIds).toEqual([A, C]);
    expect(state.groups[0].activeDocId).toBe(A);
    expect(state.focusedGroupId).toBe("1");
  });
});

/**
 * Poda contra los ids vivos del almacén (T4 · S6).
 *
 * El almacén único puede cerrar un documento (⌘W, la cruz de una pestaña, el
 * explorador) sin pasar por el modelo de grupos: el modelo sólo guarda ids. Esta
 * acción reconcilia el modelo con la lista de ids que siguen vivos y, por
 * contrato, deja el estado EXACTAMENTE como lo dejaría cerrar ese documento en
 * cada grupo (mismas vecinas activas, mismo colapso del grupo).
 */
describe("PRUNE_DOCS (poda contra los ids vivos)", () => {
  it("quita el documento cerrado de los dos grupos (S7)", () => {
    const state = sequence([
      { type: "OPEN_DOC", docId: A },
      { type: "OPEN_DOC", docId: B },
      { type: "SPLIT" },
      { type: "OPEN_DOC", docId: A },
      { type: "OPEN_DOC", docId: C },
    ]);
    expect(state.groups[0].docIds).toEqual([A, B]);
    expect(state.groups[1].docIds).toEqual([A, C]);

    const next = apply(state, { type: "PRUNE_DOCS", docIds: [B, C] });

    expect(next.groups[0].docIds).toEqual([B]);
    expect(next.groups[1].docIds).toEqual([C]);
    expect(next.groups[0].activeDocId).toBe(B);
    expect(next.groups[1].activeDocId).toBe(C);
    // Los grupos conservan su id y su modo; el foco no se toca al podar.
    expect(next.groups.map((group) => group.id)).toEqual(["1", "2"]);
    expect(next.focusedGroupId).toBe(state.focusedGroupId);
  });

  it("activa una vecina cuando cae la pestaña activa (misma regla que CLOSE_DOC)", () => {
    // Activa C (la última): pasa a la anterior.
    const last = sequence([
      { type: "OPEN_DOC", docId: A },
      { type: "OPEN_DOC", docId: B },
      { type: "OPEN_DOC", docId: C },
    ]);
    const afterLast = apply(last, { type: "PRUNE_DOCS", docIds: [A, B] });
    expect(afterLast.groups[0].docIds).toEqual([A, B]);
    expect(afterLast.groups[0].activeDocId).toBe(B);

    // Activa A (la primera, sin anterior): pasa a la siguiente.
    const first = sequence([
      { type: "OPEN_DOC", docId: A },
      { type: "OPEN_DOC", docId: B },
      { type: "ACTIVATE_DOC", docId: A },
    ]);
    const afterFirst = apply(first, { type: "PRUNE_DOCS", docIds: [B] });
    expect(afterFirst.groups[0].docIds).toEqual([B]);
    expect(afterFirst.groups[0].activeDocId).toBe(B);
  });

  it("vacía el grupo si cae su único documento y, con dos grupos, pasa al superviviente", () => {
    const single = apply(sequence([{ type: "OPEN_DOC", docId: A }]), {
      type: "PRUNE_DOCS",
      docIds: [],
    });
    expect(single.groups).toHaveLength(1);
    expect(single.groups[0].docIds).toEqual([]);
    expect(single.groups[0].activeDocId).toBeNull();

    // Con dos grupos se comporta como ⌘W sobre la única pestaña del grupo (S5).
    const split = sequence([
      { type: "OPEN_DOC", docId: A },
      { type: "SPLIT" },
      { type: "OPEN_DOC", docId: B },
    ]);
    const next = apply(split, { type: "PRUNE_DOCS", docIds: [A] });
    expect(next.groups).toHaveLength(1);
    expect(next.groups[0].id).toBe("1");
    expect(next.groups[0].docIds).toEqual([A]);
    expect(next.focusedGroupId).toBe("1");

    // Dos grupos que se quedan sin nada: uno solo, vacío, y con foco válido.
    const both = sequence([
      { type: "OPEN_DOC", docId: A },
      { type: "SPLIT" },
      { type: "OPEN_DOC", docId: B },
    ]);
    const emptied = apply(both, { type: "PRUNE_DOCS", docIds: [] });
    expect(emptied.groups).toHaveLength(1);
    expect(emptied.groups[0].docIds).toEqual([]);
    expect(emptied.groups[0].activeDocId).toBeNull();
  });

  it("es no-op (mismo objeto) si todos los ids siguen vivos", () => {
    const state = sequence([
      { type: "OPEN_DOC", docId: A },
      { type: "OPEN_DOC", docId: B },
      { type: "SPLIT" },
      { type: "OPEN_DOC", docId: C },
    ]);
    expect(apply(state, { type: "PRUNE_DOCS", docIds: [A, B, C] })).toBe(state);
    // Una lista con ids de más tampoco toca nada.
    expect(apply(state, { type: "PRUNE_DOCS", docIds: [A, B, C, D] })).toBe(state);
    // Los grupos vacíos no tienen nada que podar.
    const empty = createInitialEditorGroups();
    expect(apply(empty, { type: "PRUNE_DOCS", docIds: [] })).toBe(empty);
  });

  it("ignora ids que no son documentos y listas inválidas", () => {
    const state = sequence([{ type: "OPEN_DOC", docId: A }]);
    expect(apply(state, { type: "PRUNE_DOCS", docIds: [A, ""] })).toBe(state);
    expect(
      apply(state, { type: "PRUNE_DOCS", docIds: null as unknown as string[] }),
    ).toBe(state);
  });
});
