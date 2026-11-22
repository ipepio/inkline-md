/**
 * Nombres de los documentos de Inkline (ODD editor groups · T1).
 *
 * Extraído de `App.tsx` para que la orquestación del shell y los hooks que la
 * componen compartan una única definición de «documento sin archivo». Las rutas
 * internas empiezan por `untitled://` y nunca llegan al disco.
 */

import { fileNameOf } from "@/lib/workspace";

/** Prefijo interno de los documentos aún sin archivo en disco. */
export const UNTITLED_PREFIX = "untitled://";

/** Etiqueta visible de un documento que todavía no tiene archivo. */
export const UNTITLED_LABEL = "Sin título.md";

export function isUntitled(path: string): boolean {
  return path.startsWith(UNTITLED_PREFIX);
}

/** Nombre visible: etiqueta para lo que no es archivo, último segmento si lo es. */
export function displayName(name: string): string {
  return isUntitled(name) ? UNTITLED_LABEL : fileNameOf(name);
}

/**
 * Ruta interna de un documento nuevo. La marca de tiempo más el contador hace
 * la ruta única aunque se creen varios documentos en el mismo milisegundo.
 */
export function untitledPath(stamp: number, counter: number): string {
  return `${UNTITLED_PREFIX}${stamp}-${counter}`;
}
