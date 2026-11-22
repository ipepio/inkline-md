/**
 * Endurecimiento del shell frente a comportamientos de navegador.
 *
 * Inkline corre dentro de un WebView (Tauri 2) y no debe comportarse como una
 * pestaña web:
 * - Suprime el menú contextual nativo del navegador/WebView (donde aparece
 *   «Inspeccionar elemento» o «Recargar») para que el botón secundario sólo
 *   dispare menús propios de Inkline.
 * - Bloquea atajos de inspector de DevTools, ver código fuente y recarga
 *   (`F12`, `F5`, `⌘⌥I/J/C/U`, `Ctrl+Shift+I/J/C`, `⌘/Ctrl+U`, `⌘/Ctrl+R`).
 */

import { useEffect } from "react";

export interface BrowserShortcutEvent {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
}

/** ¿Es un atajo de DevTools, ver código fuente o recarga de navegador? */
export function isBlockedBrowserShortcut(event: BrowserShortcutEvent): boolean {
  const key = event.key.toLowerCase();
  if (key === "f12" || key === "f5") return true;

  const primary = Boolean(event.metaKey || event.ctrlKey);
  if (!primary) return false;

  // Recarga (⌘R / Ctrl+R) y ver código fuente (⌘U / Ctrl+U / ⌘⌥U).
  if (key === "r" || key === "u") return true;

  // DevTools en macOS (⌘⌥I / ⌘⌥J / ⌘⌥C) y Windows/Linux (Ctrl+Shift+I/J/C).
  if ((event.altKey || event.shiftKey) && (key === "i" || key === "j" || key === "c")) {
    return true;
  }

  return false;
}

/** Desactiva el menú contextual del navegador y los atajos de inspección. */
export function useAppHardening(): void {
  useEffect(() => {
    function onContextMenu(event: MouseEvent) {
      event.preventDefault();
    }

    function onKeyDown(event: KeyboardEvent) {
      if (!isBlockedBrowserShortcut(event)) return;
      event.preventDefault();
      event.stopPropagation();
    }

    window.addEventListener("contextmenu", onContextMenu);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, []);
}
