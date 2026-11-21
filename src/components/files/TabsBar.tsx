/**
 * Pestañas de documentos abiertos (ODD T4 · S2).
 *
 * Cada pestaña muestra el nombre del archivo, el punto `.dirty` del mockup
 * cuando hay cambios sin guardar y un control de cierre con nombre accesible
 * propio — dos pestañas nunca comparten el nombre "Cerrar".
 *
 * No se usa `role="tablist"`: el panel del documento vive fuera de este
 * componente, así que la pestaña se anuncia como botón con `aria-current`, que
 * describe exactamente lo que hace (seleccionar el documento activo).
 */

import { FileTextIcon, XIcon } from "lucide-react";
import { cn } from "cn";

export interface TabDocument {
  id: string;
  name: string;
  dirty: boolean;
}

export interface TabsBarProps {
  docs: TabDocument[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
}

export function TabsBar({ docs, activeId, onSelect, onClose }: TabsBarProps) {
  return (
    <nav
      aria-label="Documentos abiertos"
      className="flex h-[45px] min-h-[45px] shrink-0 items-stretch border-b border-border bg-ink-side"
    >
      <div className="flex min-w-0 flex-1 overflow-x-auto">
        {docs.map((doc) => {
          const active = doc.id === activeId;
          return (
            <div
              key={doc.id}
              className={cn(
                "relative flex max-w-[212px] min-w-[134px] items-center border-r border-border/60",
                active ? "bg-background text-foreground" : "text-muted-foreground",
              )}
            >
              {active ? (
                <span aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-primary" />
              ) : null}
              <button
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => onSelect(doc.id)}
                title={doc.name}
                className="flex h-full min-w-0 flex-1 items-center gap-2 pr-1 pl-3 text-left transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:-ring-inset"
              >
                <FileTextIcon
                  aria-hidden
                  className={cn("size-3.5 shrink-0", active ? "text-primary" : "text-ink-faint")}
                />
                <span className="truncate text-[11px]">{doc.name}</span>
                {doc.dirty ? (
                  <>
                    <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-primary" />
                    <span className="sr-only">Cambios sin guardar</span>
                  </>
                ) : null}
              </button>
              <button
                type="button"
                aria-label={`Cerrar ${doc.name}`}
                onClick={() => onClose(doc.id)}
                className="mr-2 grid size-5 shrink-0 place-items-center rounded text-ink-faint hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <XIcon aria-hidden className="size-3" />
              </button>
            </div>
          );
        })}
      </div>
    </nav>
  );
}
