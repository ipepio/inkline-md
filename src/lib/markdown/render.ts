/**
 * Pipeline de render Markdown de Inkline — modo visualización (ODD T2 / S4).
 *
 * Contrato:
 * - `renderToHtmlSync(markdown)` → HTML estructural inmediato (sin Shiki). Es la
 *   primera pintura: el documento aparece sin esperar a ningún motor asíncrono.
 * - `renderToHtml(markdown, { theme })` → el mismo HTML con las cercas resaltadas
 *   por Shiki. Es asíncrono y nunca lanza: si un lenguaje falla, la cerca queda
 *   como código escapado.
 * - Los diagramas ```mermaid NO se resaltan: salen como placeholder con contrato
 *   propio (`data-inkline-diagram*`). El post-proceso vive en `./diagrams.ts`
 *   (`hydrateDiagrams`), que MarkdownView ejecuta después de montar el HTML.
 *
 * Decisión de seguridad: `html: false`. El HTML crudo del documento se muestra
 * como texto, nunca como HTML vivo; un `<script>` escrito en el .md aparece
 * literal en la página y jamás se ejecuta.
 *
 * Temas Shiki: par `catppuccin-mocha` / `catppuccin-latte`, el más cercano al
 * mockup de marca (azules-violeta para keywords ~ #c7a1ee del mockup, comentarios
 * apagados y números cálidos). El color de fondo del bloque lo pone Inkline
 * (`--ink-code`), así que el fondo del tema se elimina del HTML de Shiki.
 */

import MarkdownIt from "markdown-it";
import taskLists from "markdown-it-task-lists";
import { createHighlighter, type Highlighter } from "shiki";

export type ThemeMode = "dark" | "light";

export interface RenderOptions {
  /** Tema Inkline activo: decide el par de temas de Shiki. */
  theme: ThemeMode;
}

const SHIKI_THEME: Record<ThemeMode, "catppuccin-mocha" | "catppuccin-latte"> = {
  dark: "catppuccin-mocha",
  light: "catppuccin-latte",
};

interface CodeFence {
  lang: string;
  code: string;
}

/** Marcador interno que luego se sustituye por la cerca renderizada. */
const CODE_MARKER = /<!--inkline:code:(\d+)-->/g;

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (char) => HTML_ESCAPES[char] ?? char);
}

/**
 * Panel de diagrama Mermaid: placeholder neutro mientras se renderiza y fuente
 * escapada siempre presente para poder degradar sin perder el contenido.
 */
function mermaidFigure(source: string): string {
  return [
    `<figure class="inkline-diagram" data-inkline-diagram>`,
    `<div class="inkline-diagram__panel" data-inkline-diagram-panel>`,
    `<span class="inkline-diagram__pending">Generando diagrama…</span>`,
    `</div>`,
    `<figcaption class="inkline-diagram__caption" data-inkline-diagram-caption>Mermaid</figcaption>`,
    `<pre class="inkline-diagram__source" data-inkline-diagram-source hidden>`,
    `<code class="language-mermaid">${escapeHtml(source)}</code>`,
    `</pre>`,
    `</figure>`,
  ].join("");
}

function codeFigure(fence: CodeFence, bodyHtml: string): string {
  const badge = fence.lang
    ? `<figcaption class="inkline-lang">${escapeHtml(fence.lang.toUpperCase())}</figcaption>`
    : "";
  return `<figure class="inkline-code">${badge}${bodyHtml}</figure>`;
}

function plainCodeFigure(fence: CodeFence): string {
  const langClass = fence.lang ? ` class="language-${escapeHtml(fence.lang)}"` : "";
  return codeFigure(
    fence,
    `<pre class="inkline-pre"><code${langClass}>${escapeHtml(fence.code)}</code></pre>`,
  );
}

/**
 * El bloque debe usar los tokens de Inkline, no el fondo del tema de Shiki:
 * se añade la clase propia y se recorta el `background-color` inline.
 */
function decorateShikiHtml(html: string): string {
  return html.replace(/<pre\b([^>]*)>/, (_match, attributes: string) => {
    const withClass = attributes.replace(/\bclass="/, 'class="inkline-pre ');
    const cleaned = withClass.replace(
      /style="([^"]*)"/,
      (_styleMatch, style: string) => `style="${style.replace(/background-color:[^;"]*;?/g, "")}"`,
    );
    return `<pre${cleaned}>`;
  });
}

function createRenderer(fences: CodeFence[]): MarkdownIt {
  const md = new MarkdownIt({
    // El HTML desconocido se muestra como texto: nunca se inyecta como HTML vivo.
    html: false,
    linkify: true,
    // Sin comillas tipográficas ni sustituciones: el texto se muestra tal cual.
    typographer: false,
    breaks: false,
  });

  // Modo lectura: los checkboxes de las task lists siempre van deshabilitados.
  md.use(taskLists, { enabled: false, label: false, labelAfter: false });

  md.renderer.rules.fence = (tokens, idx) => {
    const token = tokens[idx];
    const lang = (token.info.trim().split(/\s+/)[0] ?? "").toLowerCase();
    if (lang === "mermaid") return mermaidFigure(token.content);

    fences.push({ lang, code: token.content });
    return `<!--inkline:code:${fences.length - 1}-->`;
  };

  md.renderer.rules.code_block = (tokens, idx) => {
    fences.push({ lang: "", code: tokens[idx].content });
    return `<!--inkline:code:${fences.length - 1}-->`;
  };

  md.renderer.rules.table_open = () =>
    '<div class="inkline-table" role="region" tabindex="0" aria-label="Tabla desplazable"><table>\n';
  md.renderer.rules.table_close = () => "</table></div>\n";

  // GFM usa <del> para el tachado; markdown-it emite <s> por defecto.
  md.renderer.rules.s_open = () => "<del>";
  md.renderer.rules.s_close = () => "</del>";

  // Los enlaces externos abren fuera del WebView; los internos (#ancla) no.
  const defaultLinkOpen: NonNullable<MarkdownIt["renderer"]["rules"]["link_open"]> =
    md.renderer.rules.link_open ??
    ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));

  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const href = tokens[idx].attrGet("href") ?? "";
    if (/^https?:\/\//i.test(href)) {
      tokens[idx].attrSet("target", "_blank");
      tokens[idx].attrSet("rel", "noopener noreferrer");
    }
    return defaultLinkOpen(tokens, idx, options, env, self);
  };

  return md;
}

function runPipeline(markdown: string): { html: string; fences: CodeFence[] } {
  const fences: CodeFence[] = [];
  const html = createRenderer(fences).render(markdown ?? "");
  return { html, fences };
}

let highlighterPromise: Promise<Highlighter> | null = null;

function getHighlighter(): Promise<Highlighter> {
  highlighterPromise ??= createHighlighter({
    themes: [SHIKI_THEME.dark, SHIKI_THEME.light],
    langs: [],
  });
  return highlighterPromise;
}

async function highlightFence(fence: CodeFence, theme: ThemeMode): Promise<string> {
  if (!fence.lang) return plainCodeFigure(fence);

  try {
    const highlighter = await getHighlighter();
    if (!highlighter.getLoadedLanguages().includes(fence.lang)) {
      await highlighter.loadLanguage(fence.lang as Parameters<Highlighter["loadLanguage"]>[0]);
    }
    const html = await highlighter.codeToHtml(fence.code, {
      lang: fence.lang,
      theme: SHIKI_THEME[theme],
    });
    return codeFigure(fence, decorateShikiHtml(html));
  } catch {
    // Lenguaje no incluido en Shiki o fallo del motor: el código sigue visible.
    return plainCodeFigure(fence);
  }
}

/**
 * Primera pintura síncrona: bloques GFM y cercas escapadas, sin resaltado.
 */
export function renderToHtmlSync(markdown: string): string {
  const { html, fences } = runPipeline(markdown);
  return html.replace(CODE_MARKER, (_marker, index: string) => {
    const fence = fences[Number(index)];
    return fence ? plainCodeFigure(fence) : "";
  });
}

/**
 * Versión definitiva: añade el resaltado de Shiki a las cercas. Nunca lanza.
 */
export async function renderToHtml(markdown: string, options: RenderOptions): Promise<string> {
  const { html, fences } = runPipeline(markdown);
  const rendered = await Promise.all(fences.map((fence) => highlightFence(fence, options.theme)));
  let index = 0;
  return html.replace(CODE_MARKER, () => rendered[index++] ?? "");
}
