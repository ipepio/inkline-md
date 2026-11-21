/**
 * Métricas de texto de Inkline (ODD T6 · S6).
 *
 * La barra de estado del mockup (`.bottom`) muestra «0 palabras · 1 líneas» y
 * «Ln 1, Col 1». Ambas cifras se calculan aquí, lejos de los componentes, para
 * poder probarlas y para que la barra de estado no dependa de CodeMirror.
 *
 * Convenios: las palabras son trozos de texto separados por espacios del
 * contenido ya recortado; las líneas son 1 + saltos de línea, así que un
 * documento vacío tiene 1 línea y un salto final abre una línea nueva; la
 * posición del cursor es 1-based, como la muestra el mockup.
 */

export interface DocumentStats {
  words: number;
  lines: number;
}

export interface DocumentPosition {
  line: number;
  column: number;
}

const LINE_FEED = 10;

/** Número de líneas: 1 + saltos de línea, como el mockup. */
export function countLines(contents: string): number {
  let lines = 1;
  for (let index = 0; index < contents.length; index += 1) {
    if (contents.charCodeAt(index) === LINE_FEED) lines += 1;
  }
  return lines;
}

/** Palabras y líneas de un documento. */
export function documentStats(contents: string): DocumentStats {
  const trimmed = contents.trim();
  return {
    words: trimmed === "" ? 0 : trimmed.split(/\s+/).length,
    lines: countLines(contents),
  };
}

/**
 * Línea y columna 1-based de un desplazamiento en el contenido. Es la misma
 * cifra que persiste el editor en el `viewState` del documento.
 */
export function cursorPosition(contents: string, offset: number): DocumentPosition {
  const head = Number.isFinite(offset)
    ? Math.min(Math.max(Math.trunc(offset), 0), contents.length)
    : 0;
  let line = 1;
  let column = 1;
  for (let index = 0; index < head; index += 1) {
    if (contents.charCodeAt(index) === LINE_FEED) {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }
  return { line, column };
}
