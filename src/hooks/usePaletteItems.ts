/**
 * Elementos de la paleta de comandos (ODD editor groups · T1).
 *
 * La paleta ⌘K lista los documentos abiertos y los archivos del árbol una sola
 * vez por cambio de fuente. Las rutas internas de los documentos sin archivo no
 * se ofrecen como ruta de disco (`""`), igual que hacía el shell.
 */

import { useMemo } from "react";
import type { OpenDocument } from "@/lib/documents";
import { flattenFiles, type TreeNode } from "@/lib/workspace";
import { displayName, isUntitled } from "./untitled";

/** Documento abierto tal y como lo consume la paleta. */
export interface PaletteDocument {
  id: string;
  name: string;
  path: string;
}

export function paletteDocuments(docs: OpenDocument[]): PaletteDocument[] {
  return docs.map((doc) => ({
    id: doc.id,
    name: displayName(doc.path),
    path: isUntitled(doc.path) ? "" : doc.path,
  }));
}

export interface PaletteItems {
  paletteFiles: string[];
  paletteDocs: PaletteDocument[];
}

export function usePaletteItems(tree: TreeNode[], docs: OpenDocument[]): PaletteItems {
  const paletteFiles = useMemo(() => flattenFiles(tree).map((node) => node.path), [tree]);
  const paletteDocs = useMemo(() => paletteDocuments(docs), [docs]);
  return { paletteFiles, paletteDocs };
}
