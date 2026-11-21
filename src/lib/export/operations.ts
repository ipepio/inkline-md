/**
 * Operaciones de escritura y apertura de los exports (ODD T5 · S4).
 *
 * Separadas del componente para poder verificarlas sin montar UI: el diálogo
 * del sistema, la escritura atómica del backend y la apertura externa se
 * mockean en los tests.
 *
 * Impresión: WKWebView en macOS no imprime de forma fiable (`window.print()`
 * puede quedarse en blanco o no abrir el diálogo), así que el camino validado
 * es escribir el HTML autónomo en un archivo temporal y abrirlo en el navegador
 * por defecto del sistema con el plugin opener. Si el sistema rechaza esa
 * apertura (permiso de opener no concedido), se revela el archivo en Finder
 * con la ruta en el estado, para que la persona usuaria lo abra a mano.
 */

import { join, tempDir } from "@tauri-apps/api/path";
import { save } from "@tauri-apps/plugin-dialog";
import { openPath, revealItemInDir } from "@tauri-apps/plugin-opener";
import { saveTextFile } from "@/lib/files";

export interface ExportFilter {
  name: string;
  extensions: string[];
}

export const HTML_EXPORT_FILTERS: ExportFilter[] = [{ name: "HTML", extensions: ["html"] }];

export const MARKDOWN_EXPORT_FILTERS: ExportFilter[] = [
  { name: "Markdown", extensions: ["md", "markdown", "txt"] },
];

/**
 * Diálogo «Guardar como» + escritura atómica. Devuelve la ruta escrita o `null`
 * si la persona usuaria cancela.
 */
export async function saveDocumentCopy(
  contents: string,
  fileName: string,
  filters: ExportFilter[],
): Promise<string | null> {
  const target = await save({ defaultPath: fileName, filters });
  if (typeof target !== "string") return null;
  await saveTextFile(target, contents);
  return target;
}

/**
 * Escribe un export en el directorio temporal del sistema con un nombre estable
 * (reimprimir sobrescribe, no acumula archivos).
 */
export async function writeTemporaryExport(contents: string, fileName: string): Promise<string> {
  const target = await join(await tempDir(), fileName);
  await saveTextFile(target, contents);
  return target;
}

export type BrowserOpen = "opened" | "revealed";

/** Abre el archivo en el navegador por defecto; degrada a revelarlo en Finder. */
export async function openInBrowser(path: string): Promise<BrowserOpen> {
  try {
    await openPath(path);
    return "opened";
  } catch {
    try {
      await revealItemInDir(path);
    } catch {
      // Sin permisos para abrir ni revelar: el estado ya informa de la ruta.
    }
    return "revealed";
  }
}
