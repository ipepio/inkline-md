/**
 * Exportación HTML autónoma de Inkline (ODD T5 · S4 «Exportación»).
 *
 * `exportStandaloneHtml` produce un único archivo sin dependencias de red:
 * doctype, `lang="es"`, `<title>`, la hoja de estilos propia embebida y el
 * cuerpo que devuelve el pipeline de lectura (`renderToHtml`).
 *
 * Por qué se duplica la hoja de estilos en vez de extraer `src/index.css`:
 * el archivo exportado debe abrirse a doble clic en cualquier navegador, sin
 * Vite, sin Tailwind y sin variables de tema aplicadas por la app. Un
 * stylesheet hand-crafted, con la paleta del mockup ya horneada por tema, es
 * autónomo y legible por cualquiera. El coste es que un cambio tipográfico en
 * `src/index.css` debe replicarse aquí a mano; a cambio, el export nunca se
 * rompe por un cambio en el build.
 *
 * Los bloques ```mermaid se exportan con su fuente visible: el SVG sólo existe
 * tras hidratar el diagrama en la app, y este pipeline es de sólo HTML.
 */

import { renderToHtml } from "@/lib/markdown/render";

export type ExportTheme = "dark" | "light";

export interface ExportOptions {
  /** Tema Inkline activo en el momento de exportar. */
  theme: ExportTheme;
  /** Título del documento; va al `<title>` del archivo exportado. */
  title: string;
}

interface Palette {
  scheme: ExportTheme;
  bg: string;
  text: string;
  muted: string;
  faint: string;
  border: string;
  accent: string;
  accentBg: string;
  panel: string;
  hover: string;
  code: string;
}

/** Valores del mockup (`design/inkline/inkline-markdown-studio.html`). */
const PALETTES: Record<ExportTheme, Palette> = {
  dark: {
    scheme: "dark",
    bg: "#0c0f10",
    text: "#e8eee9",
    muted: "#85918b",
    faint: "#5b6762",
    border: "#283130",
    accent: "#d1ff65",
    accentBg: "#29371d",
    panel: "#101515",
    hover: "#202828",
    code: "#182020",
  },
  light: {
    scheme: "light",
    bg: "#f6f8f4",
    text: "#263127",
    muted: "#627066",
    faint: "#8c988c",
    border: "#dae2d8",
    accent: "#769f21",
    accentBg: "#edf6dc",
    panel: "#ffffff",
    hover: "#e5ebe2",
    code: "#f0f5ed",
  },
};

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Escapa texto que se interpola en el documento (título del `<title>`). */
export function escapeHtmlText(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);
}

/**
 * Hoja de estilos del archivo exportado: tipografía de lectura del mockup
 * (`.readable`), tokens de Inkline horneados y bloque `@media print`.
 */
export function exportStylesheet(theme: ExportTheme): string {
  const p = PALETTES[theme];
  return `:root {
  color-scheme: ${p.scheme};
  --bg: ${p.bg};
  --panel: ${p.panel};
  --hover: ${p.hover};
  --text: ${p.text};
  --muted: ${p.muted};
  --faint: ${p.faint};
  --border: ${p.border};
  --accent: ${p.accent};
  --accent-bg: ${p.accentBg};
  --code: ${p.code};
  --mono: ui-monospace, SFMono-Regular, Consolas, monospace;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 52px 26px;
  background: var(--bg);
  color: var(--text);
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 15px;
}

.inkline-readable {
  max-width: 770px;
  margin-inline: auto;
  line-height: 1.8;
  overflow-wrap: anywhere;
}

.inkline-readable > :first-child {
  margin-block-start: 0;
}

.inkline-readable h1,
.inkline-readable h2,
.inkline-readable h3 {
  line-height: 1.3;
  letter-spacing: -0.04em;
}

.inkline-readable h1 {
  font-size: 36px;
  letter-spacing: -1.3px;
  margin: 0 0 16px;
}

.inkline-readable h2 {
  font-size: 25px;
  border-bottom: 1px solid var(--border);
  padding-bottom: 10px;
  margin: 36px 0 15px;
}

.inkline-readable h3 {
  font-size: 19px;
  margin: 25px 0 12px;
}

.inkline-readable p {
  margin: 13px 0 18px;
}

.inkline-readable a {
  color: var(--accent);
  text-underline-offset: 3px;
}

.inkline-readable blockquote {
  background: var(--accent-bg);
  border-left: 3px solid var(--accent);
  border-radius: 0 6px 6px 0;
  margin: 21px 0;
  padding: 8px 17px;
}

.inkline-readable .inkline-table {
  margin: 19px 0 24px;
  overflow-x: auto;
  max-width: 100%;
}

.inkline-readable table {
  border-collapse: collapse;
  width: 100%;
  font-size: 13px;
}

.inkline-readable :is(td, th) {
  border: 1px solid var(--border);
  padding: 9px 12px;
  text-align: left;
}

.inkline-readable th {
  background: var(--hover);
}

.inkline-readable tbody tr:nth-child(even) {
  background: var(--panel);
}

.inkline-readable :is(ul, ol) {
  padding-left: 23px;
  margin-block: 12px 17px;
}

.inkline-readable li {
  margin-block: 5px;
}

.inkline-readable li.task-list-item {
  list-style: none;
  margin-left: -20px;
}

.inkline-readable input[type="checkbox"] {
  accent-color: var(--accent);
  margin-right: 8px;
}

.inkline-readable :not(pre) > code {
  font: 12px/1.5 var(--mono);
  background: var(--code);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 3px 5px;
  color: var(--accent);
}

.inkline-readable .inkline-code {
  margin: 20px 0 25px;
}

.inkline-readable .inkline-pre {
  background: var(--code);
  border: 1px solid var(--border);
  border-radius: 9px;
  padding: 18px 20px;
  overflow: auto;
  font: 12px/1.7 var(--mono);
  margin: 0;
}

.inkline-readable .inkline-pre code {
  font: inherit;
}

.inkline-readable .inkline-lang {
  font: 10px var(--mono);
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.6px;
  background: var(--hover);
  border: 1px solid var(--border);
  border-bottom: 0;
  border-radius: 6px 6px 0 0;
  padding: 4px 10px;
  width: max-content;
  margin: 0 0 -1px 8px;
}

.inkline-readable .inkline-lang + .inkline-pre {
  border-top-left-radius: 0;
}

.inkline-readable .inkline-diagram {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 23px;
  overflow: auto;
  margin: 19px 0;
}

.inkline-readable .inkline-diagram svg {
  width: 100%;
  max-width: 100%;
  height: auto;
}

.inkline-readable .inkline-diagram__caption {
  font-size: 10px;
  text-align: center;
  color: var(--muted);
  margin-top: 10px;
}

.inkline-readable .inkline-diagram__source {
  background: var(--code);
  border: 1px solid var(--border);
  border-radius: 9px;
  padding: 18px 20px;
  overflow: auto;
  font: 12px/1.7 var(--mono);
  margin-block: 16px 0;
}

.inkline-readable .inkline-diagram__source code {
  font: inherit;
}

.inkline-readable hr {
  border: 0;
  border-top: 1px solid var(--border);
  margin: 29px 0;
}

.inkline-readable img {
  max-width: 100%;
  border-radius: 8px;
}

.inkline-readable :is(s, del) {
  color: var(--muted);
}

@media print {
  @page {
    size: A4;
    margin: 18mm;
  }

  :root {
    color-scheme: light;
  }

  /* Papel: negro sobre blanco, sin fondos que se coman la tinta. */
  body {
    padding: 0;
    background: #ffffff;
    color: #000000;
    font-size: 11.5pt;
  }

  .inkline-readable {
    max-width: none;
  }

  .inkline-readable :is(
    blockquote,
    th,
    tbody tr:nth-child(even),
    .inkline-pre,
    .inkline-lang,
    .inkline-diagram,
    .inkline-diagram__source,
    :not(pre) > code
  ) {
    background: transparent !important;
  }

  .inkline-readable a {
    color: inherit;
    text-decoration: underline;
  }

  /* Ni bloques de código ni diagramas partidos por un salto de página. */
  .inkline-readable :is(pre, .inkline-code, blockquote, figure, table, .inkline-diagram) {
    break-inside: avoid;
  }

  .inkline-readable :is(h1, h2, h3) {
    break-after: avoid;
  }

  .inkline-readable .inkline-table {
    overflow: visible;
  }
}`;
}

/** Placeholder que la app sustituye por el SVG al hidratar Mermaid. */
const DIAGRAM_PENDING =
  '<span class="inkline-diagram__pending">Generando diagrama…</span>';

/**
 * En el export no hay hidratación de Mermaid: se quita el aviso de «generando»
 * y se muestra la fuente del diagrama, que es lo único que existe en HTML.
 */
export function revealDiagramSources(html: string): string {
  return html
    .replaceAll(DIAGRAM_PENDING, "")
    .replace(/(<pre class="inkline-diagram__source"[^>]*?)\shidden/g, "$1");
}

/**
 * Documento HTML completo listo para guardar y abrir en un navegador.
 */
export async function exportStandaloneHtml(
  markdown: string,
  options: ExportOptions,
): Promise<string> {
  const body = await renderToHtml(markdown ?? "", { theme: options.theme });

  return [
    "<!doctype html>",
    '<html lang="es">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<meta name="color-scheme" content="${PALETTES[options.theme].scheme}">`,
    `<title>${escapeHtmlText(options.title)}</title>`,
    `<style>\n${exportStylesheet(options.theme)}\n</style>`,
    "</head>",
    "<body>",
    '<article class="inkline-readable">',
    revealDiagramSources(body),
    "</article>",
    "</body>",
    "</html>",
    "",
  ].join("\n");
}
