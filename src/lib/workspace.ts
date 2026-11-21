/**
 * Espacio de trabajo de Inkline (ODD T4 · S2 · S4).
 *
 * Envoltorios tipados sobre los comandos Rust de `src-tauri/src/workspace.rs`.
 * Los componentes nunca llaman a `invoke` directamente: piden estos helpers.
 * Rust habla snake_case por dentro y serializa camelCase hacia TS.
 */

import { invoke } from "@tauri-apps/api/core";

/** Nodo del árbol del drawer: carpetas con hijos y archivos sin ellos. */
export interface TreeNode {
  name: string;
  path: string;
  isDir: boolean;
  children: TreeNode[];
}

/** Archivo reciente recordado por la app (el más nuevo primero). */
export interface RecentFile {
  path: string;
  name: string;
  /** Milisegundos desde la época Unix. */
  openedAt: number;
}

/** Estado persistido del espacio de trabajo. */
export interface WorkspaceConfig {
  root: string | null;
  recents: RecentFile[];
}

/** Tope de recientes que aplica el backend; se repite aquí para la UI. */
export const MAX_RECENTS = 10;

/** Árbol completo de la carpeta raíz (máx. 8 niveles, sin ruido). */
export async function listTree(root: string): Promise<TreeNode[]> {
  return invoke<TreeNode[]>("list_tree", { root });
}

/** Carpeta raíz recordada, o `null` si todavía no hay ninguna. */
export async function getWorkspace(): Promise<string | null> {
  return invoke<string | null>("get_workspace");
}

/** Recuerda la carpeta raíz del drawer. */
export async function setWorkspace(root: string): Promise<void> {
  await invoke("set_workspace", { root });
}

export async function getRecents(): Promise<RecentFile[]> {
  return invoke<RecentFile[]>("get_recents");
}

/** Registra un archivo como reciente y devuelve la lista ya actualizada. */
export async function pushRecent(path: string): Promise<RecentFile[]> {
  return invoke<RecentFile[]>("push_recent", { path });
}

/** Carga la raíz y los recientes en una sola espera. */
export async function loadWorkspaceConfig(): Promise<WorkspaceConfig> {
  const [root, recents] = await Promise.all([getWorkspace(), getRecents()]);
  return { root, recents };
}

/** Aplana el árbol en la lista de archivos Markdown que verá la paleta ⌘K. */
export function flattenFiles(tree: TreeNode[]): TreeNode[] {
  const files: TreeNode[] = [];
  for (const node of tree) {
    if (node.isDir) {
      files.push(...flattenFiles(node.children));
    } else {
      files.push(node);
    }
  }
  return files;
}

/** Rutas de todos los archivos del árbol, en el orden del drawer. */
export function filePaths(tree: TreeNode[]): string[] {
  return flattenFiles(tree).map((node) => node.path);
}

/** Último segmento de una ruta, sin depender del separador del sistema. */
export function fileNameOf(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : path;
}

/** Nombre visible de la raíz para la tarjeta `.ws` del mockup. */
export function workspaceName(root: string | null): string {
  if (!root) return "Sin carpeta raíz";
  return fileNameOf(root);
}
