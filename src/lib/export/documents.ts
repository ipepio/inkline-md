/**
 * Exportación a Word (.docx) y OpenDocument (.odt) de Inkline (ODD T7 · S4).
 *
 * El contrato es el mismo que el resto de exportaciones: el documento se
 * convierte, se elige la ruta con el diálogo del sistema y el resultado se
 * comunica por el estado. Aquí no se escribe ningún archivo: el HTML viaja al
 * comando `convert_to_office` de Rust, que ejecuta `textutil` de macOS (ver
 * `src-tauri/src/export.rs`).
 *
 * Por qué el HTML es mínimo: textutil lee estructura (encabezados, listas,
 * tablas, bloques de código), no estética. Incrustar la hoja de estilos de
 * Inkline sólo añadiría peso y ruido a la conversión, así que el documento
 * exportado lleva únicamente doctype, `lang="es"` y el título.
 */

import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { escapeHtmlText, revealDiagramSources } from "@/lib/export/html";
import { htmlExportFileName } from "@/lib/export/names";
import type { ExportFilter } from "@/lib/export/operations";
import { renderToHtmlSync } from "@/lib/markdown/render";

/** Formatos de oficina que ofrece el menú de exportación. */
export type OFFICE_FORMATS = "docx" | "odt";

export const OFFICE_FORMATS = ["docx", "odt"] as const;

/** Filtros del diálogo «Guardar como» por formato. */
export const OFFICE_EXPORT_FILTERS: Record<OFFICE_FORMATS, ExportFilter[]> = {
  docx: [{ name: "Word", extensions: ["docx"] }],
  odt: [{ name: "OpenDocument", extensions: ["odt"] }],
};

/**
 * Documento HTML plano para el conversor: doctype, idioma, título y el cuerpo
 * del pipeline de lectura síncrono (`renderToHtmlSync`, sin Shiki).
 *
 * Los diagramas Mermaid se exportan con su fuente visible, igual que en el
 * export HTML: sin hidratación no hay SVG, y dejar el aviso «Generando
 * diagrama…» dentro de un .docx sería texto inventado.
 */
export function officeHtml(markdown: string, title: string): string {
  const body = revealDiagramSources(renderToHtmlSync(markdown ?? ""));
  return [
    "<!doctype html>",
    '<html lang="es">',
    "<head>",
    '<meta charset="utf-8">',
    `<title>${escapeHtmlText(title)}</title>`,
    "</head>",
    "<body>",
    body,
    "</body>",
    "</html>",
    "",
  ].join("\n");
}

/** «guia.md» + docx → «guia.docx»; reutiliza la normalización del export HTML. */
export function officeExportFileName(title: string, format: OFFICE_FORMATS): string {
  return htmlExportFileName(title).replace(/\.html$/i, `.${format}`);
}

/**
 * Diálogo «Guardar como» + conversión en el backend. Devuelve la ruta escrita
 * o `null` si la persona usuaria cancela. Los errores de textutil se propagan
 * como `Error` para que el menú los cuente en el estado.
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
    html: officeHtml(markdown, title),
    format,
    target,
  });
}
