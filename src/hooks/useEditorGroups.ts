/**
 * Pegamento React de los grupos de edición (ODD editor groups · T3).
 *
 * Envuelve el reducer puro de `editorGroups` en `useReducer` y añade lo único
 * que necesita React: el estado inicial con la vista de las preferencias (el
 * primer grupo arranca en `settings.defaultView`, como hoy) y el documento
 * activo de cada grupo, resuelto contra el almacén único de `lib/documents`.
 *
 * Puente con el almacén (mínimo, sin robar trabajo a T5): ⌘O, ⌘N, el explorador,
 * los recientes, la paleta o una pestaña dejan el documento seleccionado dentro
 * del grupo enfocado. El enrutado completo (⌘W, ⌘S, ⌘E, formato…) llega en T5.
 *
 * El foco se lee desde un ref a propósito: así el puente sólo reacciona a un
 * documento nuevo y no rellena solo el grupo vacío que crea ⌘D (S4).
 */

import { useCallback, useEffect, useMemo, useReducer, useRef, type Dispatch } from "react";
import type { OpenDocument } from "@/lib/documents";
import type { DefaultView } from "@/lib/settings";
import type { WorkspaceMode } from "@/lib/editor/mode";
import {
  createInitialEditorGroups,
  editorGroupsReducer,
  focusedGroup,
  type EditorGroupsAction,
  type Group,
  type GroupId,
} from "./editorGroups";

export interface UseEditorGroupsOptions {
  /** Vista con la que nace el primer grupo (preferencia de la persona). */
  defaultView: DefaultView;
  /** Documentos abiertos: el almacén sigue siendo único. */
  docs: OpenDocument[];
  /** Documento seleccionado en el almacén (lo que abren ⌘O, ⌘N, las pestañas…). */
  activeId: string | null;
}

export interface EditorGroupsResult {
  groups: Group[];
  focusedGroupId: GroupId;
  focusedGroup: Group;
  /** Documento activo del grupo con foco: es el que leen topbar y estado. */
  focusedDoc: OpenDocument | null;
  docFor: (group: Group) => OpenDocument | null;
  dispatch: Dispatch<EditorGroupsAction>;
  split: () => void;
  focusGroup: (groupId: GroupId) => void;
  closeGroup: (groupId: GroupId) => void;
  setMode: (groupId: GroupId, mode: WorkspaceMode) => void;
}

export function useEditorGroups({
  defaultView,
  docs,
  activeId,
}: UseEditorGroupsOptions): EditorGroupsResult {
  const [state, dispatch] = useReducer(editorGroupsReducer, defaultView, createInitialEditorGroups);

  const current = focusedGroup(state);

  const focusedRef = useRef(state.focusedGroupId);
  useEffect(() => {
    focusedRef.current = state.focusedGroupId;
  }, [state.focusedGroupId]);

  const lastSelected = useRef<string | null>(null);
  const prevDocIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    const currentDocIds = new Set(docs.map((doc) => doc.id));
    if (activeId === null) {
      lastSelected.current = null;
      prevDocIds.current = currentDocIds;
      return;
    }
    if (lastSelected.current !== activeId) {
      // Si el documento activo anterior desapareció del almacén y el nuevo
      // `activeId` ya existía, es el fallback automático de `closeDoc` (no una
      // apertura explícita): no debe abrirse en el grupo enfocado antes de que
      // `PRUNE_DOCS` colapse el grupo cerrado.
      const prevActiveClosed =
        lastSelected.current !== null && !currentDocIds.has(lastSelected.current);
      const activeAlreadyExisted = prevDocIds.current.has(activeId);
      lastSelected.current = activeId;
      if (!(prevActiveClosed && activeAlreadyExisted)) {
        dispatch({ type: "OPEN_DOC", docId: activeId, groupId: focusedRef.current });
      }
    }
    prevDocIds.current = currentDocIds;
  }, [activeId, docs]);

  const docFor = useCallback(
    (group: Group): OpenDocument | null =>
      group.activeDocId ? docs.find((doc) => doc.id === group.activeDocId) ?? null : null,
    [docs],
  );

  const split = useCallback(() => {
    dispatch({ type: "SPLIT" });
  }, []);
  const focusGroup = useCallback((groupId: GroupId) => {
    dispatch({ type: "FOCUS_GROUP", groupId });
  }, []);
  const closeGroup = useCallback((groupId: GroupId) => {
    dispatch({ type: "CLOSE_GROUP", id: groupId });
  }, []);
  const setMode = useCallback((groupId: GroupId, mode: WorkspaceMode) => {
    dispatch({ type: "SET_MODE", mode, groupId });
  }, []);

  const focusedDoc = useMemo(() => docFor(current), [docFor, current]);

  return {
    groups: state.groups,
    focusedGroupId: state.focusedGroupId,
    focusedGroup: current,
    focusedDoc,
    docFor,
    dispatch,
    split,
    focusGroup,
    closeGroup,
    setMode,
  };
}
