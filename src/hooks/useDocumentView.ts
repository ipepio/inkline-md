/**
 * Vista del documento activo (ODD editor groups · T1).
 *
 * Reúne lo que el área de trabajo y la barra de estado leen del documento
 * activo: migas de pan, vista (editor/preview/split), métricas, cursor y el
 * reparto recordado del divisor. Se mantiene el mismo modelo que tenía el
 * shell: todo vive en el `viewState` del documento, compartido entre sus vistas.
 */

import { useCallback, useMemo } from "react";
import { setViewState, type OpenDocument } from "@/lib/documents";
import { isWorkspaceMode, type WorkspaceMode } from "@/lib/editor/mode";
import type { DefaultView } from "@/lib/settings";
import { documentStats, type DocumentStats } from "@/lib/text";
import { workspaceName } from "@/lib/workspace";
import { readSplitLayout, type SplitLayout } from "./splitLayout";
import { displayName } from "./untitled";

/** Migas de pan del topbar: raíz (si la hay), carpetas y archivo. */
export interface DocumentCrumbs {
  rootName: string | null;
  folders: string[];
  fileName: string;
}

/**
 * Descompone la ruta bajo la raíz del espacio de trabajo. Fuera de la raíz no
 * se inventan carpetas: sólo se muestra el nombre del archivo.
 */
export function documentCrumbs(path: string, root: string | null): DocumentCrumbs {
  const fileName = displayName(path);
  if (!root || !path.startsWith(`${root}/`)) {
    return { rootName: null, folders: [], fileName };
  }
  const relative = path.slice(root.length + 1);
  const segments = relative.split("/").filter(Boolean);
  return {
    rootName: workspaceName(root),
    folders: segments.slice(0, -1),
    fileName,
  };
}

/** Posición del cursor guardada por el editor en el estado de vista. */
export interface CursorState {
  line?: number;
  column?: number;
}

export interface UseDocumentViewOptions {
  active: OpenDocument | null;
  root: string | null;
  /** Vista con la que se abre un documento sin vista propia. */
  defaultView: DefaultView;
}

export interface DocumentView {
  crumbs: DocumentCrumbs | null;
  mode: WorkspaceMode;
  handleModeChange: (next: WorkspaceMode) => void;
  stats: DocumentStats;
  cursor: CursorState | undefined;
  splitLayout: SplitLayout | undefined;
  handleSplitLayoutChange: (layout: SplitLayout) => void;
}

export function useDocumentView({
  active,
  root,
  defaultView,
}: UseDocumentViewOptions): DocumentView {
  const crumbs = useMemo(
    () => (active ? documentCrumbs(active.path, root) : null),
    [active, root],
  );

  const activeMode = active?.viewState.mode;
  const mode: WorkspaceMode = isWorkspaceMode(activeMode) ? activeMode : defaultView;

  const handleModeChange = useCallback(
    (next: WorkspaceMode) => {
      if (!active) return;
      setViewState(active.id, { ...active.viewState, mode: next });
    },
    [active],
  );

  const handleSplitLayoutChange = useCallback(
    (layout: SplitLayout) => {
      if (!active) return;
      setViewState(active.id, { ...active.viewState, splitLayout: layout });
    },
    [active],
  );

  const stats = useMemo(() => documentStats(active?.contents ?? ""), [active?.contents]);
  const cursor = active?.viewState as CursorState | undefined;
  const splitLayout = active ? readSplitLayout(active.viewState) : undefined;

  return {
    crumbs,
    mode,
    handleModeChange,
    stats,
    cursor,
    splitLayout,
    handleSplitLayoutChange,
  };
}
