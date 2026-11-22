/**
 * Despacho de acciones del shell (ODD editor groups · T1 · T7).
 *
 * `shellShortcut` decide QUÉ acción pulsó la persona; esta pieza decide qué
 * manejador la ejecuta. Vive fuera del hook para que el teclado
 * (`useShellShortcuts`) y el menú nativo (`useNativeMenu`) compartan UN único
 * despacho: así un ítem del menú no puede hacer algo distinto de su acelerador
 * (T7), porque es literalmente el mismo código.
 */

import type { Dispatch, RefObject, SetStateAction } from "react";
import type { EditorWorkspaceHandle } from "@/components/editor/EditorWorkspace";
import type { ExportMenuHandle } from "@/components/export/ExportMenu";
import type { ShellShortcut } from "./shellShortcut";

/** Manejadores que ejecuta una acción del shell. */
export interface ShellActionHandlers {
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

/** Ejecuta la acción con los manejadores del shell. */
export function applyShellAction(action: ShellShortcut, handlers: ShellActionHandlers): void {
  switch (action) {
    case "save":
      void handlers.handleSave();
      break;
    case "open":
      void handlers.handleOpenDialog();
      break;
    case "new":
      handlers.handleNewDoc();
      break;
    case "split":
      handlers.handleSplit();
      break;
    case "close":
      handlers.handleClose();
      break;
    case "bold":
      handlers.editorRef.current?.applyFormat("bold");
      break;
    case "italic":
      handlers.editorRef.current?.applyFormat("italic");
      break;
    case "export":
      void handlers.exportRef.current?.exportHtml();
      break;
    case "settings":
      handlers.setSettingsOpen(true);
      break;
    case "sidebar":
      handlers.setSidebarOpen((open) => !open);
      break;
    case "zoom-in":
      handlers.zoomIn();
      break;
    case "zoom-out":
      handlers.zoomOut();
      break;
    case "zoom-reset":
      handlers.resetZoom();
      break;
  }
}
