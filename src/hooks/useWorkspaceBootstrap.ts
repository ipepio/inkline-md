/**
 * Arranque del espacio de trabajo de Inkline (ODD editor groups · T1).
 *
 * Único responsable de la carga inicial: la raíz recordada y los recientes
 * persistidos. Se mantiene como un hook propio y con este orden interno porque
 * la rama hermana `feat/web-demo-mode` engancha ahí su guarda de modo demo; los
 * manejadores y el orden no deben cambiar de forma.
 */

import { useCallback, useEffect, useState } from "react";
import {
  listTree,
  loadWorkspaceConfig,
  setWorkspace,
  type RecentFile,
  type TreeNode,
} from "@/lib/workspace";

/** Estado compartido del shell que nace con el espacio de trabajo. */
export interface WorkspaceBootstrapResult {
  root: string | null;
  tree: TreeNode[];
  recents: RecentFile[];
  status: string;
  setStatus: (status: string) => void;
  setRecents: (recents: RecentFile[]) => void;
  handleChooseRoot: () => Promise<void>;
}

export function useWorkspaceBootstrap(): WorkspaceBootstrapResult {
  const [root, setRoot] = useState<string | null>(null);
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [recents, setRecents] = useState<RecentFile[]>([]);
  const [status, setStatus] = useState("Listo");

  // Carga inicial: raíz recordada + recientes persistidos.
  useEffect(() => {
    void (async () => {
      try {
        const config = await loadWorkspaceConfig();
        setRecents(config.recents);
        if (config.root) {
          setRoot(config.root);
          setTree(await listTree(config.root));
        }
      } catch (err) {
        setStatus(`No se pudo cargar el espacio de trabajo: ${String(err)}`);
      }
    })();
  }, []);

  const handleChooseRoot = useCallback(async (): Promise<void> => {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const picked = await open({ directory: true, multiple: false });
    if (typeof picked !== "string") return;
    setRoot(picked);
    try {
      await setWorkspace(picked);
      setTree(await listTree(picked));
    } catch {
      setTree([]);
    }
  }, []);

  return { root, tree, recents, status, setStatus, setRecents, handleChooseRoot };
}
