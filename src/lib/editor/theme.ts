/**
 * Tema de CodeMirror de Inkline (ODD T3 / S6).
 *
 * `src/index.css` es territorio de otro trabajo en paralelo, así que la paleta
 * del editor vive aquí como extensión de CodeMirror: dos objetos con los
 * colores exactos del mockup (fondo transparente porque el panel ya pinta
 * `bg-ink-preview`, cursor en el acento, selección sobre el tono de acento y
 * monoespaciada 12/25 como `.editor`).
 */

import { EditorView, type Extension } from "@uiw/react-codemirror";
import type { Theme } from "@/hooks/useTheme";

const MONO = "ui-monospace, SFMono-Regular, Consolas, monospace";

interface Palette {
  text: string;
  gutter: string;
  caret: string;
  selection: string;
  match: string;
}

/** Valores tomados de `design/inkline/inkline-markdown-studio.html`. */
const PALETTES: Record<Theme, Palette> = {
  dark: {
    text: "#e8eee9",
    gutter: "#5b6762",
    caret: "#d1ff65",
    selection: "#29371d",
    match: "#384a24",
  },
  light: {
    text: "#263127",
    gutter: "#8c988c",
    caret: "#769f21",
    selection: "#edf6dc",
    match: "#dcecc1",
  },
};

/** Extensión de tema para el modo de color activo. */
export function editorTheme(theme: Theme): Extension {
  const palette = PALETTES[theme];
  return EditorView.theme(
    {
      "&": {
        backgroundColor: "transparent",
        color: palette.text,
        fontSize: "12px",
        height: "100%",
        // `overflow: hidden` evita que el editor empuje el layout del shell y
        // deje la barra de estado fuera de la ventana.
        minHeight: "0",
        overflow: "hidden",
      },
      "&.cm-focused": { outline: "none" },
      ".cm-scroller": {
        fontFamily: MONO,
        fontSize: "12px",
        lineHeight: "25px",
        overflow: "auto",
        minHeight: "0",
      },
      ".cm-content": {
        fontFamily: MONO,
        padding: "24px 20px 60px 0",
        caretColor: palette.caret,
      },
      ".cm-line": { padding: "0" },
      ".cm-gutters": {
        // Fondo opaco y sin opacidad: con el fondo transparente el texto se
        // veía a través del gutter al desplazar en horizontal (las líneas se
        // solapaban con el contenido).
        backgroundColor: "var(--background)",
        border: "none",
        borderRight: "1px solid var(--border)",
        color: palette.gutter,
        fontFamily: MONO,
        fontSize: "12px",
        lineHeight: "25px",
        minWidth: "53px",
        padding: "24px 0 40px 0",
        opacity: "1",
        userSelect: "none",
      },
      ".cm-lineNumbers .cm-gutterElement": { padding: "0 14px 0 0" },
      ".cm-activeLine": { backgroundColor: "transparent" },
      ".cm-activeLineGutter": { backgroundColor: "transparent" },
      ".cm-cursor, .cm-dropCursor": {
        borderLeftColor: palette.caret,
        borderLeftWidth: "2px",
      },
      ".cm-selectionBackground, &.cm-focused .cm-selectionBackground, .cm-content ::selection": {
        backgroundColor: palette.selection,
      },
      ".cm-selectionMatch": { backgroundColor: palette.match },
    },
    { dark: theme === "dark" },
  );
}
