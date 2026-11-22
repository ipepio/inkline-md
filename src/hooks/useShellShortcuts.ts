/**
 * Atajos del shell (ODD editor groups · T1).
 *
 * Un único `keydown` en `window`: la tabla de `shellShortcut` decide qué acción
 * corresponde y aquí se despacha con `applyShellAction`, el mismo despacho que
 * usa el menú nativo (T7). Refs y setters de React son estables, así que el
 * escucha se registra una vez por cambio de acción, no por render.
 * ⌘K no aparece aquí: lo registra la propia paleta de comandos.
 */

import { useEffect, type Dispatch, type RefObject, type SetStateAction } from "react";
import type { EditorWorkspaceHandle } from "@/components/editor/EditorWorkspace";
import type { ExportMenuHandle } from "@/components/export/ExportMenu";
import { applyShellAction } from "./shellAction";
import { shellShortcut } from "./shellShortcut";

export interface ShellShortcutsOptions {
  editorRef: RefObject<EditorWorkspaceHandle>;
  exportRef: RefObject<ExportMenuHandle>;
  handleSave: () => Promise<void>;
  handleOpenDialog: () => Promise<void>;
  handleNewDoc: () => void;
  /** ⌘D: dividir el área en dos grupos (S1). */
  handleSplit: () => void;
  /** ⌘W: cerrar el documento del grupo con foco (S5). */
  handleClose: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  setSettingsOpen: Dispatch<SetStateAction<boolean>>;
  setSidebarOpen: Dispatch<SetStateAction<boolean>>;
}

export function useShellShortcuts({
  editorRef,
  exportRef,
  handleSave,
  handleOpenDialog,
  handleNewDoc,
  handleSplit,
  handleClose,
  zoomIn,
  zoomOut,
  resetZoom,
  setSettingsOpen,
  setSidebarOpen,
}: ShellShortcutsOptions): void {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const action = shellShortcut(event);
      if (action === null) return;
      event.preventDefault();
      // Mismo despacho que el menú nativo (T7): una sola tabla de acciones.
      applyShellAction(action, {
        editorRef,
        exportRef,
        handleSave,
        handleOpenDialog,
        handleNewDoc,
        handleSplit,
        handleClose,
        zoomIn,
        zoomOut,
        resetZoom,
        setSettingsOpen,
        setSidebarOpen,
      });
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    editorRef,
    exportRef,
    handleSave,
    handleOpenDialog,
    handleNewDoc,
    handleSplit,
    handleClose,
    zoomIn,
    zoomOut,
    resetZoom,
    setSettingsOpen,
    setSidebarOpen,
  ]);
}
