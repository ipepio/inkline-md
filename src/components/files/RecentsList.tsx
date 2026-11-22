/**
 * Lista RECIENTES del drawer (ODD T4 · S4).
 *
 * El mockup la coloca bajo el árbol, con cabecera en versalitas. Cada fila
 * muestra el nombre y, como pista, la ruta: dos archivos homónimos en carpetas
 * distintas siguen siendo distinguibles.
 */

import type { MouseEvent } from "react";
import { HistoryIcon } from "lucide-react";
import type { RecentFile } from "@/lib/workspace";

export interface RecentsListProps {
  recents: RecentFile[];
  onOpenFile: (path: string) => void;
  onContextMenuFile?: (
    file: { path: string; name: string },
    event: MouseEvent<HTMLButtonElement>,
  ) => void;
}

export function RecentsList({ recents, onOpenFile, onContextMenuFile }: RecentsListProps) {
  return (
    <section aria-labelledby="recientes-heading" className="mt-7 px-2.5">
      <div className="flex items-center justify-between px-1.5 pb-2">
        <h2
          id="recientes-heading"
          className="text-[10px] font-bold tracking-[1.4px] text-muted-foreground uppercase"
        >
          Recientes
        </h2>
        <HistoryIcon aria-hidden className="size-3 text-ink-faint" />
      </div>
      {recents.length === 0 ? (
        <p className="px-3 py-2 text-[11px] text-muted-foreground">
          Aún no hay archivos recientes.
        </p>
      ) : (
        <ul role="list" className="flex flex-col gap-px">
          {recents.map((recent) => (
            <li key={recent.path}>
              <button
                type="button"
                onClick={() => onOpenFile(recent.path)}
                onContextMenu={
                  onContextMenuFile
                    ? (event) =>
                        onContextMenuFile({ path: recent.path, name: recent.name }, event)
                    : undefined
                }
                title={recent.path}
                className="flex h-9 w-full flex-col justify-center rounded-[7px] px-3 text-left text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <span className="w-full truncate text-[11px] text-foreground">
                  {recent.name}
                </span>
                <span className="w-full truncate text-[10px] text-ink-faint">
                  {recent.path}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
