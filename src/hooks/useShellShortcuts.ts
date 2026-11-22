/**
 * Atajos del shell (ODD editor groups · T1).
 *
 * Un único `keydown` en `window`: la tabla de `shellShortcut` decide qué acción
 * corresponde y aquí se despacha. Refs y setters de React son estables, así que
 * el escucha se registra una vez por cambio de acción, no por render.
 * ⌘K no aparece aquí: lo registra la propia paleta de comandos.
 */

import { useEffect, type Dispatch, type RefObject, type SetStateAction } from "react";
import type { EditorWorkspaceHandle } from "@/components/editor/EditorWorkspace";
import type { ExportMenuHandle } from "@/components/export/ExportMenu";
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
      switch (action) {
        case "save":
          void handleSave();
          break;
        case "open":
          void handleOpenDialog();
          break;
        case "new":
          handleNewDoc();
          break;
        case "split":
          handleSplit();
          break;
        case "close":
          handleClose();
          break;
        case "bold":
          editorRef.current?.applyFormat("bold");
          break;
        case "italic":
          editorRef.current?.applyFormat("italic");
          break;
        case "export":
          void exportRef.current?.exportHtml();
          break;
        case "settings":
          setSettingsOpen(true);
          break;
        case "sidebar":
          setSidebarOpen((open) => !open);
          break;
        case "zoom-in":
          zoomIn();
          break;
        case "zoom-out":
          zoomOut();
          break;
        case "zoom-reset":
          resetZoom();
          break;
      }
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
