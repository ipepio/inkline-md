/**
 * Traducción de atajos del shell (ODD editor groups · T1).
 *
 * La tabla vive fuera del hook para poder verificarla sin montar un componente
 * ni un `window`: el hook sólo escucha, traduce y despacha. ⌘K no aparece aquí
 * porque lo registra la propia paleta de comandos.
 */

/** Acción del shell que dispara un atajo ya reconocido. */
export type ShellShortcut =
  | "save"
  | "open"
  | "new"
  | "bold"
  | "italic"
  | "export"
  | "settings"
  | "sidebar"
  | "zoom-in"
  | "zoom-out"
  | "zoom-reset";

/** Lo mínimo de `KeyboardEvent` que decide el atajo. */
export interface ShortcutEvent {
  key: string;
  code?: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
}

/**
 * Acción del atajo, o `null` si la pulsación no es del shell. Con ⌘/Ctrl y sin
 * Alt: la tecla se compara en minúsculas para que Shift no cambie el atajo.
 */
export function shellShortcut(event: ShortcutEvent): ShellShortcut | null {
  if (!(event.metaKey || event.ctrlKey) || event.altKey) return null;
  const key = event.key.toLowerCase();
  if (key === "s") return "save";
  if (key === "o") return "open";
  if (key === "n") return "new";
  if (key === "b") return "bold";
  if (key === "i") return "italic";
  if (key === "e") return "export";
  if (key === ",") return "settings";
  if (key === "\\") return "sidebar";
  if (key === "=" || key === "+" || event.code === "NumpadAdd") return "zoom-in";
  if (key === "-" || event.code === "NumpadSubtract") return "zoom-out";
  if (key === "0") return "zoom-reset";
  return null;
}
