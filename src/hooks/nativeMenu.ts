/**
 * Tabla del menú nativo (ODD editor groups · T7).
 *
 * Espejo de `src-tauri/src/menu.rs`: cada id estable que emite el menú
 * (`inkline://menu`) se traduce a la MISMA acción de `shellShortcut` que dispara
 * su acelerador, y `useNativeMenu` la despacha con `applyShellAction`. Añadir un
 * ítem en Rust sin añadirlo aquí (o al revés) deja un ítem muerto: la tabla es
 * el contrato.
 *
 * ⌘K no aparece a propósito: la paleta de comandos la registra el webview y, si
 * macOS reclamara la tecla desde el menú, la paleta dejaría de abrirse.
 */

import type { ShellShortcut } from "./shellShortcut";

/** Evento que emite `on_menu_event` en Rust con el id del ítem como payload. */
export const MENU_EVENT = "inkline://menu";

/** id estable del ítem del menú → acción del shell que ejecuta. */
const MENU_ACTIONS = new Map<string, ShellShortcut>([
  ["inkline:new", "new"],
  ["inkline:open", "open"],
  ["inkline:save", "save"],
  ["inkline:close", "close"],
  ["inkline:export", "export"],
  ["inkline:settings", "settings"],
  ["inkline:bold", "bold"],
  ["inkline:italic", "italic"],
  ["inkline:split", "split"],
  ["inkline:zoom-in", "zoom-in"],
  ["inkline:zoom-out", "zoom-out"],
  ["inkline:zoom-reset", "zoom-reset"],
  ["inkline:sidebar", "sidebar"],
]);

/**
 * Acción del shell para un id del menú nativo, o `null` si el id no es nuestro
 * (los ítems nativos de Editar/Ventana los resuelve el sistema y no se emiten).
 */
export function menuAction(id: string): ShellShortcut | null {
  return MENU_ACTIONS.get(id) ?? null;
}

/** Ids del menú nativo, en el orden de la tabla (para pruebas y depuración). */
export function menuIds(): string[] {
  return [...MENU_ACTIONS.keys()];
}
