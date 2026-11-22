/**
 * Vista del documento activo (ODD editor groups · T1 · T3).
 *
 * Reúne lo que el topbar y la barra de estado leen del documento activo: migas
 * de pan y métricas/cursor. Desde T3 la vista (editor/preview/split) NO vive
 * aquí: es del GRUPO (`hooks/editorGroups`), así que el `viewState.mode` de un
 * documento ya no decide cómo se pinta. El reparto del divisor sigue siendo por
 * documento y lo resuelve el shell de grupos al construir cada workspace.
 */

import { useMemo } from "react";
import type { OpenDocument } from "@/lib/documents";
import { documentStats, type DocumentStats } from "@/lib/text";
import { workspaceName } from "@/lib/workspace";
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
}

export interface DocumentView {
  crumbs: DocumentCrumbs | null;
  stats: DocumentStats;
  cursor: CursorState | undefined;
}

export function useDocumentView({ active, root }: UseDocumentViewOptions): DocumentView {
  const crumbs = useMemo(
    () => (active ? documentCrumbs(active.path, root) : null),
    [active, root],
  );

  const stats = useMemo(() => documentStats(active?.contents ?? ""), [active?.contents]);
  const cursor = active?.viewState as CursorState | undefined;

  return { crumbs, stats, cursor };
}
