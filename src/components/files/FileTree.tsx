/**
 * Árbol del drawer de Inkline (ODD T4 · S2 · S4).
 *
 * Reproduce el `.tree` del mockup: filas de 32px, carpetas plegables y una
 * fila seleccionada con el acento. Todo se abre por defecto (como el mockup),
 * así que el estado local guarda lo **plegado**, nunca lo desplegado: un árbol
 * que llega después del montaje ya aparece abierto sin efectos de sincronía.
 */

import { useState, type MouseEvent } from "react";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  FileTextIcon,
  FolderIcon,
  FolderOpenIcon,
} from "lucide-react";
import { cn } from "cn";
import type { TreeNode } from "@/lib/workspace";

export interface FileTreeContextTarget {
  path: string;
  name: string;
  isDir: boolean;
}

export interface FileTreeProps {
  tree: TreeNode[];
  activePath?: string;
  onOpenFile: (path: string) => void;
  onContextMenuItem?: (target: FileTreeContextTarget, event: MouseEvent<HTMLButtonElement>) => void;
}

interface TreeLevelProps {
  nodes: TreeNode[];
  depth: number;
  activePath?: string;
  collapsed: ReadonlySet<string>;
  onToggle: (path: string) => void;
  onOpenFile: (path: string) => void;
  onContextMenuItem?: (target: FileTreeContextTarget, event: MouseEvent<HTMLButtonElement>) => void;
}

const ROW_CLASS =
  "flex h-8 w-full items-center gap-2 rounded-[7px] pr-2.5 text-left text-xs whitespace-nowrap text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

/** Sangría del mockup: 10px base + 11px por nivel. */
function indent(depth: number, extra = 0) {
  return { paddingLeft: `${10 + depth * 11 + extra}px` };
}

export function FileTree({ tree, activePath, onOpenFile, onContextMenuItem }: FileTreeProps) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());

  function toggle(path: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }

  if (tree.length === 0) {
    return (
      <p className="px-3 py-2 text-[11px] text-muted-foreground">
        No hay archivos Markdown en esta carpeta.
      </p>
    );
  }

  return (
    <TreeLevel
      nodes={tree}
      depth={0}
      activePath={activePath}
      collapsed={collapsed}
      onToggle={toggle}
      onOpenFile={onOpenFile}
      onContextMenuItem={onContextMenuItem}
    />
  );
}

function TreeLevel({
  nodes,
  depth,
  activePath,
  collapsed,
  onToggle,
  onOpenFile,
  onContextMenuItem,
}: TreeLevelProps) {
  return (
    // `role="list"` restaura la semántica que WebKit quita a las listas con
    // `list-style: none` / flex, y el motor real aquí es WKWebView.
    <ul role="list" className="flex flex-col gap-px">
      {nodes.map((node) =>
        node.isDir ? (
          <li key={node.path}>
            <button
              type="button"
              aria-expanded={!collapsed.has(node.path)}
              onClick={() => onToggle(node.path)}
              onContextMenu={
                onContextMenuItem
                  ? (event) =>
                      onContextMenuItem({ path: node.path, name: node.name, isDir: true }, event)
                  : undefined
              }
              className={ROW_CLASS}
              style={indent(depth)}
              title={node.path}
            >
              {collapsed.has(node.path) ? (
                <ChevronRightIcon aria-hidden className="size-3 shrink-0 text-ink-faint" />
              ) : (
                <ChevronDownIcon aria-hidden className="size-3 shrink-0 text-ink-faint" />
              )}
              {collapsed.has(node.path) ? (
                <FolderIcon aria-hidden className="size-3.5 shrink-0" />
              ) : (
                <FolderOpenIcon aria-hidden className="size-3.5 shrink-0" />
              )}
              <span className="truncate font-medium">{node.name}</span>
            </button>
            {!collapsed.has(node.path) && node.children.length > 0 ? (
              <TreeLevel
                nodes={node.children}
                depth={depth + 1}
                activePath={activePath}
                collapsed={collapsed}
                onToggle={onToggle}
                onOpenFile={onOpenFile}
                onContextMenuItem={onContextMenuItem}
              />
            ) : null}
          </li>
        ) : (
          <li key={node.path}>
            <button
              type="button"
              aria-current={node.path === activePath ? "true" : undefined}
              onClick={() => onOpenFile(node.path)}
              onContextMenu={
                onContextMenuItem
                  ? (event) =>
                      onContextMenuItem({ path: node.path, name: node.name, isDir: false }, event)
                  : undefined
              }
              className={cn(
                ROW_CLASS,
                node.path === activePath && "bg-accent text-foreground",
              )}
              style={indent(depth, 14)}
              title={node.path}
            >
              <FileTextIcon
                aria-hidden
                className={cn(
                  "size-3.5 shrink-0",
                  node.path === activePath && "text-primary",
                )}
              />
              <span className="truncate">{node.name}</span>
            </button>
          </li>
        ),
      )}
    </ul>
  );
}
