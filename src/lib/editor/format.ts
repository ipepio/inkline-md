/**
 * Formato Markdown de Inkline (ODD T3 / S2 · S4 · S6).
 *
 * Funciones puras, sin DOM ni tipos de CodeMirror: reciben el texto y la
 * selección, y devuelven el texto y la selección resultantes. Así la barra de
 * formato se prueba entera sin levantar el editor.
 *
 * Criterios comunes:
 * - Las marcas se aplican sobre `text` y todas devuelven índices coherentes con
 *   el texto nuevo (`selectionStart`/`selectionEnd`).
 * - Cuando el texto no cambia, la entrada se devuelve tal cual (misma referencia)
 *   para que el llamador pueda detectar el no-op.
 * - Volver a aplicar una marca que ya está deshace el marcado (alternancia).
 */

/** Marca de texto que envuelve la selección. */
export type WrapKind = "bold" | "italic" | "strike";

/** Marca que se aplica al principio de cada línea seleccionada. */
export type LineKind = "h2" | "list" | "task";

/** Todas las acciones que la barra de formato puede disparar. */
export type FormatKind = WrapKind | LineKind | "code" | "link" | "table" | "mermaid";

export interface FormatState {
  text: string;
  selectionStart: number;
  selectionEnd: number;
}

export interface TextChange {
  from: number;
  to: number;
  insert: string;
}

/** Texto de ejemplo para las marcas que se insertan sin selección. */
export const PLACEHOLDER = "texto";

/** Texto de ejemplo del código en línea. */
export const CODE_PLACEHOLDER = "código";

/** Texto de ejemplo de un enlace sin título seleccionado. */
export const LINK_PLACEHOLDER = PLACEHOLDER;

/** URL de ejemplo de un enlace. */
export const LINK_URL = "url";

const WRAP_MARKERS: Record<WrapKind, string> = {
  bold: "**",
  italic: "*",
  strike: "~~",
};

const LINE_PREFIXES: Record<LineKind, string> = {
  h2: "## ",
  list: "- ",
  task: "- [ ] ",
};

/** Cabecera Markdown de cualquier nivel: `#`, `##`, … */
const ANY_HEADING = /^#{1,6}\s+/;
/** Casilla de tarea marcada: se normaliza al reaplicar. */
const CHECKED_TASK = /^[-*+]\s+\[[xX]\]\s+/;
/** Casilla de tarea sin marcar: es el prefijo que la alternancia quita. */
const UNCHECKED_TASK = /^[-*+]\s+\[ \]\s+/;
/** Viñeta simple, sin casilla detrás. */
const BULLET = /^[-*+]\s+(?!\[[ xX]\]\s)/;

function selectionOf(state: FormatState): { from: number; to: number } {
  const from = Math.min(state.selectionStart, state.selectionEnd);
  const to = Math.max(state.selectionStart, state.selectionEnd);
  return { from, to };
}

function replace(
  state: FormatState,
  from: number,
  to: number,
  insert: string,
  selectionStart: number,
  selectionEnd: number,
): FormatState {
  const text = state.text.slice(0, from) + insert + state.text.slice(to);
  return { text, selectionStart, selectionEnd };
}

/**
 * ¿La marca envuelve la selección por fuera? Evita confundir `*` con parte de
 * `**`, o `~` con parte de `~~`.
 */
function wrappedOutside(
  text: string,
  from: number,
  to: number,
  marker: string,
): boolean {
  const start = from - marker.length;
  const end = to + marker.length;
  if (start < 0 || end > text.length) return false;
  if (text.slice(start, from) !== marker) return false;
  if (text.slice(to, end) !== marker) return false;
  if (marker.length === 1 && text[start - 1] === marker) return false;
  if (marker.length === 1 && text[end] === marker) return false;
  return true;
}

/** ¿La propia selección incluye las marcas (`**texto**` seleccionado)? */
function wrappedInside(
  text: string,
  from: number,
  to: number,
  marker: string,
): boolean {
  const inner = to - from;
  if (inner < marker.length * 2) return false;
  if (text.slice(from, from + marker.length) !== marker) return false;
  if (text.slice(to - marker.length, to) !== marker) return false;
  if (marker.length === 1 && text[from + marker.length] === marker) return false;
  if (marker.length === 1 && text[to - marker.length - 1] === marker) return false;
  return true;
}

/**
 * Negrita, cursiva o tachado.
 *
 * Sin selección inserta las marcas con un texto de ejemplo y deja ese texto
 * seleccionado, dentro de las marcas, para escribir encima. Con selección la
 * envuelve y la mantiene seleccionada. Sobre algo ya marcado, deshace el marcado.
 */
export function wrapSelection(kind: WrapKind, state: FormatState): FormatState {
  const marker = WRAP_MARKERS[kind];
  const { from, to } = selectionOf(state);

  if (wrappedOutside(state.text, from, to, marker)) {
    const start = from - marker.length;
    return replace(
      state,
      start,
      to + marker.length,
      state.text.slice(from, to),
      start,
      start + (to - from),
    );
  }

  if (wrappedInside(state.text, from, to, marker)) {
    const inner = state.text.slice(from + marker.length, to - marker.length);
    return replace(state, from, to, inner, from, from + inner.length);
  }

  if (from === to) {
    const insert = marker + PLACEHOLDER + marker;
    const start = from + marker.length;
    return replace(state, from, to, insert, start, start + PLACEHOLDER.length);
  }

  const insert = marker + state.text.slice(from, to) + marker;
  return replace(state, from, to, insert, from + marker.length, to + marker.length);
}

/** Línea del bloque seleccionado, con su hueco y su desplazamiento. */
interface BlockLine {
  start: number;
  end: number;
  text: string;
  newStart: number;
  newText: string;
}

/** Parte el tramo afectado en líneas y calcula el resultado de cada una. */
function transformLines(
  state: FormatState,
  start: number,
  end: number,
  transform: (line: string) => string,
): BlockLine[] {
  const block = state.text.slice(start, end);
  const rawLines = block.split("\n");
  const lines: BlockLine[] = [];
  let cursor = start;
  let newCursor = start;
  for (const raw of rawLines) {
    const newText = transform(raw);
    lines.push({
      start: cursor,
      end: cursor + raw.length,
      text: raw,
      newStart: newCursor,
      newText,
    });
    cursor += raw.length + 1;
    newCursor += newText.length + 1;
  }
  return lines;
}

/** Traduce una posición del texto viejo a su equivalente en el nuevo. */
function mapOffset(lines: BlockLine[], blockEnd: number, position: number): number {
  let index = 0;
  while (index < lines.length - 1 && position >= lines[index].end + 1) index += 1;
  const line = lines[index];
  if (!line) return blockEnd;
  const within = position - line.start;
  const shifted = Math.max(0, Math.min(within + (line.newText.length - line.text.length), line.newText.length));
  return line.newStart + shifted;
}

/**
 * Prefijos de bloque: `## `, `- ` y `- [ ] `.
 *
 * Si todas las líneas con contenido ya llevan el prefijo, se quita; si no, se
 * añade a todas. Las cabeceras de otro nivel y las casillas marcadas se
 * normalizan al prefijo pedido. Las líneas en blanco se respetan, salvo que toda
 * la selección esté en blanco: entonces se marca la primera para poder escribir.
 */
export function toggleLinePrefix(kind: LineKind, state: FormatState): FormatState {
  const prefix = LINE_PREFIXES[kind];
  const { from, to } = selectionOf(state);
  const start = from === 0 ? 0 : state.text.lastIndexOf("\n", from - 1) + 1;
  const lastIndex = to > from ? to - 1 : from;
  const found = state.text.indexOf("\n", Math.max(lastIndex, start));
  const end = found < 0 ? state.text.length : found;

  const removable = (line: string): string | null => {
    const match =
      kind === "h2" ? /^##\s+/.exec(line) : kind === "list" ? BULLET.exec(line) : UNCHECKED_TASK.exec(line);
    return match ? line.slice(match[0].length) : null;
  };

  const normalizable = (line: string): string | null => {
    if (kind === "h2") {
      const match = ANY_HEADING.exec(line);
      return match ? line.slice(match[0].length) : null;
    }
    if (kind === "task") {
      const match = CHECKED_TASK.exec(line);
      return match ? line.slice(match[0].length) : null;
    }
    return null;
  };

  const contentLines = state.text
    .slice(start, end)
    .split("\n")
    .filter((line) => line.trim().length > 0);

  const allPrefixed =
    contentLines.length > 0 && contentLines.every((line) => removable(line) !== null);
  const allBlank = contentLines.length === 0;

  let firstContentSeen = false;
  const lines = transformLines(state, start, end, (line) => {
    if (line.trim().length === 0) {
      if (!allBlank || firstContentSeen) return line;
      firstContentSeen = true;
      return prefix + line;
    }
    firstContentSeen = true;
    if (allPrefixed) return removable(line) ?? line;
    if (line.startsWith(prefix)) return line;
    const normalized = normalizable(line);
    if (normalized !== null) return prefix + normalized;
    return prefix + line;
  });

  const block = lines.map((line) => line.newText).join("\n");
  const text = state.text.slice(0, start) + block + state.text.slice(end);
  if (text === state.text) return state;

  const selectionStart = mapOffset(lines, start + block.length, from);
  const selectionEnd = mapOffset(lines, start + block.length, to) + Math.max(0, to - end);
  return { text, selectionStart, selectionEnd };
}

/**
 * Bloque suelto (tabla, diagrama): se separa del texto vecino con una línea en
 * blanco para que Markdown no lo pegue al párrafo anterior.
 */
function insertBlock(state: FormatState, block: string): FormatState {
  const { from, to } = selectionOf(state);
  const before = state.text.slice(0, from);
  const after = state.text.slice(to);

  let lead = "";
  if (before.length > 0) {
    if (/\n\s*\n$/.test(before)) lead = "";
    else if (before.endsWith("\n")) lead = "\n";
    else lead = "\n\n";
  }

  let trail = "";
  if (after.length > 0) {
    if (/^\n\s*\n/.test(after)) trail = "";
    else if (after.startsWith("\n")) trail = "\n";
    else trail = "\n\n";
  }

  const insert = lead + block + trail;
  const cursor = from + lead.length + block.length;
  return replace(state, from, to, insert, cursor, cursor);
}

/** Código en línea: alterna sobre un fragmento ya delimitado por tildes. */
export function insertInlineCode(state: FormatState): FormatState {
  const { from, to } = selectionOf(state);
  if (wrappedOutside(state.text, from, to, "`")) {
    const start = from - 1;
    return replace(state, start, to + 1, state.text.slice(from, to), start, start + (to - from));
  }
  if (from === to) {
    const insert = "`" + CODE_PLACEHOLDER + "`";
    return replace(state, from, to, insert, from + 1, from + 1 + CODE_PLACEHOLDER.length);
  }
  const insert = "`" + state.text.slice(from, to) + "`";
  return replace(state, from, to, insert, from + 1, to + 1);
}

/**
 * Enlace `[texto](url)`.
 *
 * Sin selección se inserta el ejemplo con el texto seleccionado; con selección
 * el cursor queda en la URL, listo para pegar.
 */
export function insertLink(state: FormatState): FormatState {
  const { from, to } = selectionOf(state);
  const label = from === to ? LINK_PLACEHOLDER : state.text.slice(from, to);
  const insert = `[${label}](${LINK_URL})`;
  const urlStart = from + label.length + 3;
  const selectionStart = from === to ? from + 1 : urlStart;
  const selectionEnd = from === to ? from + 1 + label.length : urlStart + LINK_URL.length;
  return replace(state, from, to, insert, selectionStart, selectionEnd);
}

const TABLE_SNIPPET = [
  "| Columna 1 | Columna 2 | Columna 3 | Columna 4 |",
  "| --- | --- | --- | --- |",
  "|  |  |  |  |",
  "|  |  |  |  |",
].join("\n");

const MERMAID_SNIPPET = ["```mermaid", "graph TD", "  A[Inicio] --> B[Fin]", "```"].join("\n");

/** Tabla GFM de 4 columnas y 3 filas. */
export function insertTable(state: FormatState): FormatState {
  return insertBlock(state, TABLE_SNIPPET);
}

/** Bloque `mermaid` con un grafo mínimo listo para editar. */
export function insertMermaidFence(state: FormatState): FormatState {
  return insertBlock(state, MERMAID_SNIPPET);
}

/** Despacha el botón de la barra a su función de formato. */
export function applyFormat(kind: FormatKind, state: FormatState): FormatState {
  switch (kind) {
    case "bold":
    case "italic":
    case "strike":
      return wrapSelection(kind, state);
    case "h2":
    case "list":
    case "task":
      return toggleLinePrefix(kind, state);
    case "code":
      return insertInlineCode(state);
    case "link":
      return insertLink(state);
    case "table":
      return insertTable(state);
    case "mermaid":
      return insertMermaidFence(state);
  }
}

/**
 * Tramo mínimo que hay que reemplazar para pasar de `before` a `after`; evita
 * reescribir el documento entero en CodeMirror en cada formato.
 */
export function minimalChange(before: string, after: string): TextChange {
  const max = Math.min(before.length, after.length);
  let from = 0;
  while (from < max && before[from] === after[from]) from += 1;
  let suffix = 0;
  while (
    suffix < max - from &&
    before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  ) {
    suffix += 1;
  }
  return {
    from,
    to: before.length - suffix,
    insert: after.slice(from, after.length - suffix),
  };
}
