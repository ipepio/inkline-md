/**
 * Acciones de archivo del shell (ODD editor groups · T1).
 *
 * Abrir (explorador, recientes o diálogo), crear y guardar. Los nombres
 * `handleOpenDialog` y `handleSave` son costuras estables: la rama hermana
 * `feat/web-demo-mode` añade sus guardas de modo demo dentro de ellos y no se
 * deben renombrar, alinear ni reordenar sus guardas.
 */

import { useCallback } from "react";
import {
  closeDoc,
  markSaved,
  openDoc,
  setViewState,
  type OpenDocument,
} from "@/lib/documents";
import {
  openTextFile,
  readTextFile,
  saveTextFile,
  saveTextFileAs,
} from "@/lib/files";
import type { DefaultView } from "@/lib/settings";
import { pushRecent, type RecentFile } from "@/lib/workspace";
import { isUntitled, untitledPath } from "./untitled";

/** Contador de documentos sin título; el contador vive con el shell. */
let untitledCounter = 0;

export interface FileActionsOptions {
  /** Documento activo: es el que guarda ⌘S y el botón del topbar. */
  active: OpenDocument | null;
  /** Vista con la que nace un documento nuevo (preferencia de la persona). */
  defaultView: DefaultView;
  setRecents: (recents: RecentFile[]) => void;
  setStatus: (status: string) => void;
}

export interface FileActionsResult {
  registerOpen: (path: string, contents: string) => Promise<void>;
  handleOpenFile: (path: string) => Promise<void>;
  handleOpenDialog: () => Promise<void>;
  handleNewDoc: () => void;
  handleSave: () => Promise<void>;
}

export function useFileActions({
  active,
  defaultView,
  setRecents,
  setStatus,
}: FileActionsOptions): FileActionsResult {
  /** Abre el documento y, aparte, recuerda la ruta entre los recientes. */
  const registerOpen = useCallback(
    async (path: string, contents: string): Promise<void> => {
      openDoc(path, contents);
      try {
        setRecents(await pushRecent(path));
      } catch {
        // Los recientes son un extra: no interrumpen la apertura.
      }
    },
    [setRecents],
  );

  const handleOpenFile = useCallback(
    async (path: string): Promise<void> => {
      if (isUntitled(path)) return;
      try {
        const doc = await readTextFile(path);
        await registerOpen(doc.path, doc.contents);
        setStatus(`Abierto: ${doc.path}`);
      } catch (err) {
        setStatus(`Error al abrir: ${String(err)}`);
      }
    },
    [registerOpen, setStatus],
  );

  const handleOpenDialog = useCallback(async (): Promise<void> => {
    const doc = await openTextFile();
    if (!doc) return;
    await registerOpen(doc.path, doc.contents);
    setStatus(`Abierto: ${doc.path}`);
  }, [registerOpen, setStatus]);

  const handleNewDoc = useCallback((): void => {
    untitledCounter += 1;
    const id = openDoc(untitledPath(Date.now(), untitledCounter), "");
    setViewState(id, { mode: defaultView });
  }, [defaultView]);

  const handleSave = useCallback(async (): Promise<void> => {
    if (!active) return;
    try {
      if (isUntitled(active.path)) {
        const savedPath = await saveTextFileAs(active.contents);
        if (!savedPath) return;
        closeDoc(active.id);
        await registerOpen(savedPath, active.contents);
        setStatus(`Guardado: ${savedPath}`);
      } else {
        await saveTextFile(active.path, active.contents);
        markSaved(active.id);
        setStatus(`Guardado: ${active.path}`);
      }
    } catch (err) {
      setStatus(`Error al guardar: ${String(err)}`);
    }
  }, [active, registerOpen, setStatus]);

  return { registerOpen, handleOpenFile, handleOpenDialog, handleNewDoc, handleSave };
}
