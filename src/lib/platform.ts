/**
 * Plataforma y modificador visible de los atajos.
 *
 * Los manejadores del shell aceptan ⌘ y Ctrl por igual (los dos modificadores
 * funcionan en los tres sistemas); lo que cambia es cómo se MUESTRA la
 * combinación. La detección es de sólo lectura: el WebView de la app no
 * cambia de sistema operativo en caliente.
 */

export type ModifierLabel = "⌘" | "Ctrl";

/** ¿Estamos en un sistema de Apple? (macOS, iPhone, iPad) */
export function isMacPlatform(): boolean {
  const clues = `${navigator.platform ?? ""} ${navigator.userAgent ?? ""}`;
  return /Mac|iPhone|iPad|iPod/i.test(clues);
}

/** Modificador que muestran los atajos: ⌘ en Apple, Ctrl en Windows/Linux. */
export function modifierLabel(): ModifierLabel {
  return isMacPlatform() ? "⌘" : "Ctrl";
}

/**
 * Combinación visible de un atajo: `⌘K` en Apple, `Ctrl+K` en Windows/Linux.
 * `key` es la tecla sin modificador ("K", "+", "−", "0", "\\"…).
 */
export function comboLabel(key: string): string {
  return isMacPlatform() ? `⌘${key}` : `Ctrl+${key}`;
}
