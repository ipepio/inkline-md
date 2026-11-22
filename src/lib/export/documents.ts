/**
 * Exportación multiplataforma a Word (.docx) y OpenDocument (.odt) de Inkline.
 *
 * El contrato es el mismo que el resto de exportaciones: el documento se
 * convierte en un modelo estructural tipado (`OfficeDoc`) usando `markdown-it`
 * (el mismo parser GFM del visor), se elige la ruta con el diálogo del sistema
 * y el backend Rust (`convert_to_office`) genera directamente el paquete ZIP/XML
 * nativo (OOXML para `.docx`, ODF 1.2 para `.odt`) sin depender de `textutil`,
 * pandoc ni LibreOffice. Funciona por igual en Windows, Linux y macOS.
 */

import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import MarkdownIt from "markdown-it";
import type Token from "markdown-it/lib/token.mjs";
import { htmlExportFileName } from "@/lib/export/names";
import type { ExportFilter } from "@/lib/export/operations";

/** Formatos de oficina que ofrece el menú de exportación. */
export type OFFICE_FORMATS = "docx" | "odt";

export const OFFICE_FORMATS = ["docx", "odt"] as const;

/** Filtros del diálogo «Guardar como» por formato. */
export const OFFICE_EXPORT_FILTERS: Record<OFFICE_FORMATS, ExportFilter[]> = {
  docx: [{ name: "Word", extensions: ["docx"] }],
  odt: [{ name: "OpenDocument", extensions: ["odt"] }],
};

export type TextAlign = "left" | "center" | "right";

export type OfficeRun =
  | {
      kind: "text";
      text: string;
      bold?: boolean;
      italic?: boolean;
      strike?: boolean;
      code?: boolean;
      href?: string;
    }
  | {
      kind: "break";
    };

export interface OfficeTableCell {
  align?: TextAlign;
  runs: OfficeRun[];
}

export interface OfficeListItem {
  checked?: boolean;
  blocks: OfficeBlock[];
}

export type OfficeBlock =
  | { kind: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6; runs: OfficeRun[] }
  | { kind: "paragraph"; runs: OfficeRun[] }
  | { kind: "blockquote"; blocks: OfficeBlock[] }
  | { kind: "codeBlock"; language?: string; code: string }
  | { kind: "list"; ordered: boolean; start?: number; items: OfficeListItem[] }
  | { kind: "table"; headers: OfficeTableCell[]; rows: OfficeTableCell[][] }
  | { kind: "thematicBreak" };

export interface OfficeDoc {
  title: string;
  blocks: OfficeBlock[];
}

const parser = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: false,
  breaks: false,
});

const TASK_PREFIX = /^\[([ xX])\]\s+/;

function extractAlign(token: Token): TextAlign | undefined {
  const style = token.attrGet("style") ?? "";
  const match = /text-align\s*:\s*(left|center|right)/i.exec(style);
  return match ? (match[1].toLowerCase() as TextAlign) : undefined;
}

function makeTextRun(
  text: string,
  state: { bold: number; italic: number; strike: number; hrefs: string[] },
  extra?: { code?: boolean; italic?: boolean },
): OfficeRun {
  const run: Extract<OfficeRun, { kind: "text" }> = { kind: "text", text };
  if (state.bold > 0) run.bold = true;
  if (state.italic > 0 || extra?.italic) run.italic = true;
  if (state.strike > 0) run.strike = true;
  if (extra?.code) run.code = true;
  const href = state.hrefs[state.hrefs.length - 1];
  if (href) run.href = href;
  return run;
}

function parseRuns(children: Token[] | null): OfficeRun[] {
  if (!children || children.length === 0) return [];
  const runs: OfficeRun[] = [];
  const state = { bold: 0, italic: 0, strike: 0, hrefs: [] as string[] };

  for (const token of children) {
    switch (token.type) {
      case "text":
        if (token.content.length > 0) {
          runs.push(makeTextRun(token.content, state));
        }
        break;
      case "code_inline":
        runs.push(makeTextRun(token.content, state, { code: true }));
        break;
      case "softbreak":
        runs.push(makeTextRun(" ", state));
        break;
      case "hardbreak":
        runs.push({ kind: "break" });
        break;
      case "strong_open":
        state.bold += 1;
        break;
      case "strong_close":
        state.bold = Math.max(0, state.bold - 1);
        break;
      case "em_open":
        state.italic += 1;
        break;
      case "em_close":
        state.italic = Math.max(0, state.italic - 1);
        break;
      case "s_open":
        state.strike += 1;
        break;
      case "s_close":
        state.strike = Math.max(0, state.strike - 1);
        break;
      case "link_open":
        state.hrefs.push(token.attrGet("href") ?? "");
        break;
      case "link_close":
        state.hrefs.pop();
        break;
      case "image": {
        const alt =
          token.children
            ?.filter((child) => child.type === "text" || child.type === "code_inline")
            .map((child) => child.content)
            .join("")
            .trim() || token.content.trim();
        const label = alt ? `[Imagen: ${alt}]` : "[Imagen]";
        runs.push(makeTextRun(label, state, { italic: true }));
        break;
      }
      default:
        if (token.content.length > 0) {
          runs.push(makeTextRun(token.content, state));
        }
        break;
    }
  }

  return runs;
}

function parseTable(tokens: Token[], startIdx: number): { block: OfficeBlock; nextIdx: number } {
  const headers: OfficeTableCell[] = [];
  const rows: OfficeTableCell[][] = [];
  let inHead = false;
  let currentRow: OfficeTableCell[] = [];
  let i = startIdx + 1;

  while (i < tokens.length && tokens[i].type !== "table_close") {
    const token = tokens[i];
    if (token.type === "thead_open") {
      inHead = true;
    } else if (token.type === "thead_close") {
      inHead = false;
    } else if (token.type === "tr_open") {
      currentRow = [];
    } else if (token.type === "tr_close") {
      if (inHead) {
        headers.push(...currentRow);
      } else {
        rows.push(currentRow);
      }
      currentRow = [];
    } else if (token.type === "th_open" || token.type === "td_open") {
      const align = extractAlign(token);
      const inlineToken = tokens[i + 1];
      const runs = inlineToken?.type === "inline" ? parseRuns(inlineToken.children) : [];
      const cell: OfficeTableCell = align ? { align, runs } : { runs };
      currentRow.push(cell);
      // Avanzar hasta th_close / td_close
      while (i < tokens.length && tokens[i].type !== "th_close" && tokens[i].type !== "td_close") {
        i += 1;
      }
    }
    i += 1;
  }

  return {
    block: { kind: "table", headers, rows },
    nextIdx: i + 1,
  };
}

function extractTaskCheckbox(blocks: OfficeBlock[]): boolean | undefined {
  const first = blocks[0];
  if (!first || first.kind !== "paragraph") return undefined;
  const firstRun = first.runs[0];
  if (!firstRun || firstRun.kind !== "text") return undefined;
  const match = TASK_PREFIX.exec(firstRun.text);
  if (!match) return undefined;

  const checked = match[1].toLowerCase() === "x";
  const rest = firstRun.text.slice(match[0].length);
  if (rest.length > 0) {
    first.runs[0] = { ...firstRun, text: rest };
  } else {
    first.runs.shift();
  }
  return checked;
}

function parseList(
  tokens: Token[],
  startIdx: number,
  ordered: boolean,
): { block: OfficeBlock; nextIdx: number } {
  const closeType = ordered ? "ordered_list_close" : "bullet_list_close";
  const startAttr = ordered ? tokens[startIdx].attrGet("start") : null;
  const parsedStart = startAttr ? Number.parseInt(startAttr, 10) : NaN;
  const start = Number.isFinite(parsedStart) && parsedStart > 0 ? parsedStart : undefined;

  const items: OfficeListItem[] = [];
  let i = startIdx + 1;

  while (i < tokens.length && tokens[i].type !== closeType) {
    if (tokens[i].type === "list_item_open") {
      const inner = parseBlocks(tokens, i + 1, "list_item_close");
      const checked = extractTaskCheckbox(inner.blocks);
      const item: OfficeListItem =
        checked !== undefined ? { checked, blocks: inner.blocks } : { blocks: inner.blocks };
      items.push(item);
      i = inner.nextIdx;
    } else {
      i += 1;
    }
  }

  const block: OfficeBlock = start
    ? { kind: "list", ordered, start, items }
    : { kind: "list", ordered, items };
  return { block, nextIdx: i + 1 };
}

function parseBlocks(
  tokens: Token[],
  startIdx: number,
  stopType?: string,
): { blocks: OfficeBlock[]; nextIdx: number } {
  const blocks: OfficeBlock[] = [];
  let i = startIdx;

  while (i < tokens.length) {
    const token = tokens[i];
    if (stopType && token.type === stopType) {
      return { blocks, nextIdx: i + 1 };
    }

    switch (token.type) {
      case "heading_open": {
        const rawLevel = Number.parseInt(token.tag.slice(1), 10);
        const level = Math.min(6, Math.max(1, Number.isFinite(rawLevel) ? rawLevel : 1)) as
          | 1
          | 2
          | 3
          | 4
          | 5
          | 6;
        const inlineToken = tokens[i + 1];
        const runs = inlineToken?.type === "inline" ? parseRuns(inlineToken.children) : [];
        blocks.push({ kind: "heading", level, runs });
        while (i < tokens.length && tokens[i].type !== "heading_close") i += 1;
        i += 1;
        break;
      }
      case "paragraph_open": {
        const inlineToken = tokens[i + 1];
        const runs = inlineToken?.type === "inline" ? parseRuns(inlineToken.children) : [];
        blocks.push({ kind: "paragraph", runs });
        while (i < tokens.length && tokens[i].type !== "paragraph_close") i += 1;
        i += 1;
        break;
      }
      case "blockquote_open": {
        const inner = parseBlocks(tokens, i + 1, "blockquote_close");
        blocks.push({ kind: "blockquote", blocks: inner.blocks });
        i = inner.nextIdx;
        break;
      }
      case "fence": {
        const language = token.info.trim().split(/\s+/)[0] || undefined;
        blocks.push(
          language
            ? { kind: "codeBlock", language, code: token.content }
            : { kind: "codeBlock", code: token.content },
        );
        i += 1;
        break;
      }
      case "code_block": {
        blocks.push({ kind: "codeBlock", code: token.content });
        i += 1;
        break;
      }
      case "bullet_list_open": {
        const parsed = parseList(tokens, i, false);
        blocks.push(parsed.block);
        i = parsed.nextIdx;
        break;
      }
      case "ordered_list_open": {
        const parsed = parseList(tokens, i, true);
        blocks.push(parsed.block);
        i = parsed.nextIdx;
        break;
      }
      case "table_open": {
        const parsed = parseTable(tokens, i);
        blocks.push(parsed.block);
        i = parsed.nextIdx;
        break;
      }
      case "hr": {
        blocks.push({ kind: "thematicBreak" });
        i += 1;
        break;
      }
      default:
        i += 1;
        break;
    }
  }

  return { blocks, nextIdx: i };
}

/**
 * Convierte un documento Markdown en el modelo estructural (`OfficeDoc`) que
 * consume el generador nativo de `.docx` / `.odt` en Rust.
 */
export function markdownToOfficeDoc(markdown: string, title: string): OfficeDoc {
  const tokens = parser.parse(markdown ?? "", {});
  const { blocks } = parseBlocks(tokens, 0);
  return { title, blocks };
}

/** «guia.md» + docx → «guia.docx»; reutiliza la normalización del export HTML. */
export function officeExportFileName(title: string, format: OFFICE_FORMATS): string {
  return htmlExportFileName(title).replace(/\.html$/i, `.${format}`);
}

/**
 * Diálogo «Guardar como» + generación nativa en el backend. Devuelve la ruta
 * escrita o `null` si la persona usuaria cancela.
 */
export async function exportOfficeDocument(
  markdown: string,
  title: string,
  format: OFFICE_FORMATS,
): Promise<string | null> {
  const target = await save({
    defaultPath: officeExportFileName(title, format),
    filters: OFFICE_EXPORT_FILTERS[format],
  });
  if (typeof target !== "string") return null;
  return invoke<string>("convert_to_office", {
    doc: markdownToOfficeDoc(markdown, title),
    format,
    target,
  });
}
