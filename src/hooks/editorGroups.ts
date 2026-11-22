/**
 * Grupos de edición del shell (ODD editor groups · T2 · S1–S4 · S7).
 *
 * Modelo puro de los dos grupos en los que se puede dividir el área de trabajo
 * (⌘D, máximo 2). Sin React y sin almacén: el shell lo envolverá en
 * `useReducer`. Por eso el reducer nunca muta lo que recibe y devuelve el MISMO
 * estado cuando la acción no cambia nada (así React no vuelve a renderizar).
 *
 * Lo que este módulo NO modela, a propósito: los documentos. El array `docs`
 * (`lib/documents`) sigue siendo único y compartido, y un grupo sólo guarda
 * referencias por id. De ahí sale gratis lo de S7: el mismo `.md` puede vivir
 * en los dos grupos y lo que se escribe en uno se ve en el otro.
 *
 * Invariantes (los mantiene toda acción; `editorGroups.test.ts` los verifica
 * después de CADA paso):
 *  1. `groups.length` es 1 o 2, `groups[0]` siempre existe y los ids no se
 *     repiten (un grupo puede ser «1» o «2» sin importar su posición).
 *  2. `focusedGroupId` es siempre el id de un grupo existente.
 *  3. `activeDocId` es `null` sólo cuando el grupo está vacío; si no, es uno de
 *     sus `docIds` (no hay grupos con pestañas y sin documento activo).
 *  4. `docIds` no repite ids dentro de un grupo.
 *  5. Un mismo `docId` SÍ puede aparecer en los dos grupos.
 *
 * Ids desconocidos (un grupo que ya no existe, un documento que no está en el
 * grupo) no rompen el modelo: la acción no hace nada y devuelve el estado
 * recibido. Es deliberado, no un descuido: los llamadores despachan acciones de
 * UI (⌘W de una pestaña ya cerrada, el clic tardío de una cruz) y un reducer que
 * lanzase obligaría a cada uno a defenderse sin ganar ningún invariante.
 */

import { isWorkspaceMode, type WorkspaceMode } from "@/lib/editor/mode";

/** Id de grupo. Sólo existen dos, «1» y «2» (S1: máximo 2 documentos). */
export type GroupId = "1" | "2";

/** Los ids posibles, en orden de creación. */
export const GROUP_IDS: readonly GroupId[] = ["1", "2"];

/**
 * Un grupo: su pestañas ordenadas, cuál está activa y su vista propia
 * (editor/preview/split), independiente de la del otro grupo (S3).
 */
export interface Group {
  id: GroupId;
  docIds: string[];
  activeDocId: string | null;
  mode: WorkspaceMode;
}

/** Estado completo de la división; el foco es el grupo que recibe las acciones. */
export interface EditorGroupsState {
  groups: Group[];
  focusedGroupId: GroupId;
}

/**
 * Estado inicial: un solo grupo, vacío, en modo editor. Lo de «2 editores sin
 * preview» (S3) lo consigue ⌘D: el grupo nuevo nace `editor`.
 */
export function createInitialEditorGroups(mode: WorkspaceMode = "editor"): EditorGroupsState {
  return { groups: [{ id: "1", docIds: [], activeDocId: null, mode }], focusedGroupId: "1" };
}

/** Acciones del shell. `groupId` omitido significa «el grupo enfocado». */
export type EditorGroupsAction =
  /** ⌘D: 1 → 2 grupos; con 2 ya no hace nada (S1). */
  | { type: "SPLIT" }
  /** Cruz de un grupo: 2 → 1, sus pestañas pasan al superviviente (S5). */
  | { type: "CLOSE_GROUP"; id?: GroupId }
  /** ⌘O/⌘N/explorador/recientes/paleta: abre en el grupo enfocado (S2). */
  | { type: "OPEN_DOC"; docId: string; groupId?: GroupId }
  /** ⌘W: cierra el documento en un grupo (S5). */
  | { type: "CLOSE_DOC"; docId: string; groupId?: GroupId }
  /** Clic en una pestaña: ese documento pasa a activo en su grupo (S6). */
  | { type: "ACTIVATE_DOC"; docId: string; groupId?: GroupId }
  /** Clic en el área de un grupo: el foco manda ahí (S4 · S6). */
  | { type: "FOCUS_GROUP"; groupId: GroupId }
  /** Control segmentado de una vista: sólo cambia esa vista (S3). */
  | { type: "SET_MODE"; mode: WorkspaceMode; groupId?: GroupId }
  /**
   * Reconciliación con el almacén único (S6): fuera de los grupos todo id que
   * ya no existe. El shell la despacha cuando cambian los documentos abiertos.
   */
  | { type: "PRUNE_DOCS"; docIds: readonly string[] };

/** Grupo por id, o `undefined` si no existe (las acciones lo tratan como no-op). */
export function groupById(state: EditorGroupsState, id: GroupId): Group | undefined {
  return state.groups.find((group) => group.id === id);
}

/** El grupo con foco; siempre existe (invariante 2). */
export function focusedGroup(state: EditorGroupsState): Group {
  const group = groupById(state, state.focusedGroupId);
  if (!group) {
    throw new Error(`Estado de grupos inconsistente: no existe el grupo ${state.focusedGroupId}`);
  }
  return group;
}

/** ¿Hay dos grupos? Es la condición de la cruz por grupo y del divisor (S5). */
export function isSplit(state: EditorGroupsState): boolean {
  return state.groups.length === 2;
}

/** Reducer del shell: `(state, action) => state`, sin efectos secundarios. */
export function editorGroupsReducer(
  state: EditorGroupsState,
  action: EditorGroupsAction,
): EditorGroupsState {
  switch (action.type) {
    case "SPLIT":
      return split(state);
    case "CLOSE_GROUP":
      return closeGroup(state, action.id);
    case "OPEN_DOC":
      return openDoc(state, action.docId, action.groupId);
    case "CLOSE_DOC":
      return closeDoc(state, action.docId, action.groupId);
    case "ACTIVATE_DOC":
      return activateDoc(state, action.docId, action.groupId);
    case "FOCUS_GROUP":
      return focusGroup(state, action.groupId);
    case "SET_MODE":
      return setMode(state, action.mode, action.groupId);
    case "PRUNE_DOCS":
      return pruneDocs(state, action.docIds);
  }
}

/**
 * Grupo al que va la acción, o `null` si el id pedido no existe. Un id
 * explícito nunca cambia el foco: enfocar es cosa de `FOCUS_GROUP`.
 */
function targetGroupId(
  state: EditorGroupsState,
  groupId: GroupId | undefined,
): GroupId | null {
  const id = groupId ?? state.focusedGroupId;
  return groupById(state, id) ? id : null;
}

/** Un `docId` utilizable: los ids de documento son cadenas no vacías. */
function isDocId(docId: unknown): docId is string {
  return typeof docId === "string" && docId.length > 0;
}

/** Estado con un grupo reemplazado; los demás grupos conservan su identidad. */
function replaceGroup(state: EditorGroupsState, group: Group): EditorGroupsState {
  return {
    groups: state.groups.map((current) => (current.id === group.id ? group : current)),
    focusedGroupId: state.focusedGroupId,
  };
}

/** ⌘D: divide en dos. El grupo nuevo nace vacío y en modo editor (S3 · S4). */
function split(state: EditorGroupsState): EditorGroupsState {
  if (state.groups.length >= GROUP_IDS.length) return state;
  const used = state.groups.map((group) => group.id);
  const id = GROUP_IDS.find((candidate) => !used.includes(candidate));
  if (!id) return state;
  const group: Group = { id, docIds: [], activeDocId: null, mode: "editor" };
  return { groups: [...state.groups, group], focusedGroupId: id };
}

/**
 * Cruz de un grupo (S5): lo que estaba abierto se mergea en el superviviente
 * sin perder nada. Orden = las pestañas del superviviente y detrás las del
 * grupo cerrado que aún no estaban (deduplicado); el superviviente conserva su
 * documento activo y su modo. Si el superviviente estaba vacío adopta la
 * primera pestaña heredada, para no quedar con pestañas y sin documento activo.
 */
function closeGroup(state: EditorGroupsState, id: GroupId | undefined): EditorGroupsState {
  if (state.groups.length < 2) return state;
  const closedId = id ?? state.focusedGroupId;
  const closed = groupById(state, closedId);
  if (!closed) return state;
  const survivor = state.groups.find((group) => group.id !== closed.id);
  if (!survivor) return state;
  const docIds = [...survivor.docIds];
  for (const docId of closed.docIds) {
    if (!docIds.includes(docId)) docIds.push(docId);
  }
  const activeDocId = survivor.activeDocId ?? firstOf(docIds);
  return {
    groups: [{ ...survivor, docIds, activeDocId }],
    focusedGroupId: survivor.id,
  };
}

/** Primera pestaña, o `null` si la lista está vacía. */
function firstOf(docIds: string[]): string | null {
  return docIds.length > 0 ? docIds[0] : null;
}

/**
 * Abre (o reabre) un documento en un grupo (S2): lo añade al final si no estaba
 * y lo deja activo. Un id que ya está en el otro grupo se abre igualmente aquí:
 * el documento es uno solo y las dos vistas comparten contenido (S7).
 */
function openDoc(
  state: EditorGroupsState,
  docId: string,
  groupId: GroupId | undefined,
): EditorGroupsState {
  if (!isDocId(docId)) return state;
  const id = targetGroupId(state, groupId);
  if (!id) return state;
  const group = groupById(state, id);
  if (!group) return state;
  if (group.activeDocId === docId) return state;
  const docIds = group.docIds.includes(docId) ? group.docIds : [...group.docIds, docId];
  return replaceGroup(state, { ...group, docIds, activeDocId: docId });
}

/**
 * ⌘W en un grupo (S5). Si se cierra la pestaña activa pasa a la anterior y, si
 * no la hay, a la siguiente; si era la única pestaña y hay dos grupos, ese grupo
 * desaparece y el foco va al superviviente (no se pierde nada). Con un solo
 * grupo el grupo se queda vacío (CTA de S4).
 */
function closeDoc(
  state: EditorGroupsState,
  docId: string,
  groupId: GroupId | undefined,
): EditorGroupsState {
  if (!isDocId(docId)) return state;
  const id = targetGroupId(state, groupId);
  if (!id) return state;
  const group = groupById(state, id);
  if (!group) return state;
  const index = group.docIds.indexOf(docId);
  if (index === -1) return state;

  if (group.docIds.length === 1) {
    if (isSplit(state)) {
      const survivor = state.groups.find((current) => current.id !== group.id);
      if (!survivor) return state;
      return { groups: [survivor], focusedGroupId: survivor.id };
    }
    return replaceGroup(state, { ...group, docIds: [], activeDocId: null });
  }

  const docIds = group.docIds.filter((_, position) => position !== index);
  const activeDocId =
    group.activeDocId === docId ? neighborDocId(group.docIds, index) : group.activeDocId;
  return replaceGroup(state, { ...group, docIds, activeDocId });
}

/**
 * Poda contra los ids vivos del almacén (S6).
 *
 * El modelo no ve los documentos (sólo guarda ids) y el almacén único puede
 * cerrar uno sin pasar por aquí: ⌘W, la cruz de una pestaña o el explorador. Por
 * cada pestaña cuyo id ya no existe se aplica el MISMO cierre que `closeDoc` en
 * SU grupo, así que la poda hereda sus reglas: la vecina activa, el grupo que se
 * queda sin pestañas y, con dos grupos, el colapso en el superviviente (S5).
 * Ninguna sección se queda con pestañas apuntando a ids inexistentes, y el
 * invariante 3 se mantiene también después de podar.
 *
 * Sin nada que podar devuelve el MISMO estado: el shell la despacha en cada
 * cambio del almacén y no debe provocar renders por ello.
 */
function pruneDocs(state: EditorGroupsState, docIds: readonly string[]): EditorGroupsState {
  if (!Array.isArray(docIds)) return state;
  const alive = new Set<string>();
  for (const docId of docIds) {
    if (isDocId(docId)) alive.add(docId);
  }

  const victims: { docId: string; groupId: GroupId }[] = [];
  for (const group of state.groups) {
    for (const docId of group.docIds) {
      if (!alive.has(docId)) victims.push({ docId, groupId: group.id });
    }
  }
  if (victims.length === 0) return state;

  let next = state;
  for (const victim of victims) {
    next = closeDoc(next, victim.docId, victim.groupId);
  }
  return next;
}

/** Vecina activa tras cerrar: la anterior; si no la hay, la siguiente. */
function neighborDocId(docIds: string[], index: number): string | null {
  const previous = index > 0 ? docIds[index - 1] : null;
  return previous ?? nextOf(docIds, index) ?? null;
}

function nextOf(docIds: string[], index: number): string | undefined {
  return index + 1 < docIds.length ? docIds[index + 1] : undefined;
}

/** Clic en una pestaña (S6): activa ese documento, sin tocar el foco ni el orden. */
function activateDoc(
  state: EditorGroupsState,
  docId: string,
  groupId: GroupId | undefined,
): EditorGroupsState {
  if (!isDocId(docId)) return state;
  const id = targetGroupId(state, groupId);
  if (!id) return state;
  const group = groupById(state, id);
  if (!group || group.activeDocId === docId) return state;
  if (!group.docIds.includes(docId)) return state;
  return replaceGroup(state, { ...group, activeDocId: docId });
}

/** Foco a un grupo (S4 · S6): con «1» o «2» la acción es un no-op. */
function focusGroup(state: EditorGroupsState, groupId: GroupId): EditorGroupsState {
  if (state.focusedGroupId === groupId) return state;
  if (!groupById(state, groupId)) return state;
  return { groups: state.groups, focusedGroupId: groupId };
}

/** Vista propia de un grupo (S3): la del otro grupo no se toca. */
function setMode(
  state: EditorGroupsState,
  mode: WorkspaceMode,
  groupId: GroupId | undefined,
): EditorGroupsState {
  if (!isWorkspaceMode(mode)) return state;
  const id = targetGroupId(state, groupId);
  if (!id) return state;
  const group = groupById(state, id);
  if (!group || group.mode === mode) return state;
  return replaceGroup(state, { ...group, mode });
}
