/**
 * Paleta de comandos ⌘K de Inkline (ODD T4 · S2 · S6).
 *
 * El componente registra su propio atajo global (⌘K / Ctrl+K) y se dibuja con
 * los componentes `ui/command` ya instalados. El filtrado no se delega a cmdk:
 * `filterPalette` es una función pura, probada aparte, y la lista se renderiza
 * con `shouldFilter={false}` para que exista una sola fuente de verdad sobre
 * qué coincide. Las acciones fijas siempre están disponibles, incluso cuando la
 * consulta no coincide con ningún archivo.
 */

import { useEffect, useState } from "react";
import { FileTextIcon, PlusIcon, FolderOpenIcon, SunMoonIcon } from "lucide-react";
import {
  Command,
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { fileNameOf } from "@/lib/workspace";

/** Texto exacto del mockup; también es la clave que buscan los tests. */
export const PALETTE_PLACEHOLDER = "Buscar archivos, contenido o >comandos…";

export interface PaletteDoc {
  id: string;
  name: string;
  path: string;
}

export type PaletteActionId = "open" | "new" | "theme";

export interface PaletteActionItem {
  id: PaletteActionId;
  label: string;
  shortcut?: string;
}

export interface PaletteFileItem {
  id: string;
  label: string;
  path: string;
}

export interface PaletteGroups {
  docs: PaletteFileItem[];
  files: PaletteFileItem[];
  actions: PaletteActionItem[];
}

export interface CommandPaletteProps {
  /** Documentos ya abiertos, buscables por nombre y por ruta. */
  docs: PaletteDoc[];
  /** Rutas del árbol del drawer, buscables por subcadena de ruta. */
  files: string[];
  onSelectDoc: (id: string) => void;
  onOpenFile: (path: string) => void;
  onOpenDialog: () => void;
  onNewDoc: () => void;
  onToggleTheme: () => void;
}

/** Acciones fijas de la paleta, en el orden en que se muestran. */
export const PALETTE_ACTIONS: readonly PaletteActionItem[] = [
  { id: "open", label: "Abrir archivo…", shortcut: "⌘O" },
  { id: "new", label: "Nuevo documento", shortcut: "⌘N" },
  { id: "theme", label: "Alternar tema" },
];

/**
 * Filtra documentos y archivos por la consulta y devuelve siempre las acciones.
 *
 * Los documentos se buscan por nombre y ruta; los archivos sólo por ruta. Un
 * archivo ya abierto no se repite en la lista de archivos sueltos.
 */
export function filterPalette(
  query: string,
  docs: PaletteDoc[],
  files: string[],
): PaletteGroups {
  const needle = query.trim().toLowerCase();
  const matches = (value: string) => !needle || value.toLowerCase().includes(needle);
  const openPaths = new Set(docs.map((doc) => doc.path));

  return {
    docs: docs
      .filter((doc) => matches(doc.name) || matches(doc.path))
      .map((doc) => ({ id: doc.id, label: doc.name, path: doc.path })),
    files: files
      .filter((path) => !openPaths.has(path) && matches(path))
      .map((path) => ({ id: path, label: fileNameOf(path), path })),
    actions: PALETTE_ACTIONS.map((action) => ({ ...action })),
  };
}

export function CommandPalette({
  docs,
  files,
  onSelectDoc,
  onOpenFile,
  onOpenDialog,
  onNewDoc,
  onToggleTheme,
}: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k") return;
      event.preventDefault();
      setOpen((current) => !current);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setQuery("");
  }

  function run(action: () => void) {
    handleOpenChange(false);
    action();
  }

  function actionFor(id: PaletteActionId): () => void {
    if (id === "open") return onOpenDialog;
    if (id === "new") return onNewDoc;
    return onToggleTheme;
  }

  const groups = filterPalette(query, docs, files);

  return (
    <CommandDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Paleta de comandos"
      description="Busca un documento abierto, un archivo del espacio de trabajo o una acción de Inkline."
    >
      <Command shouldFilter={false} label="Buscar archivos, documentos y comandos">
        <CommandInput
          autoFocus
          value={query}
          onValueChange={setQuery}
          placeholder={PALETTE_PLACEHOLDER}
          aria-label="Buscar archivos, documentos y comandos"
        />
        <CommandList>
          {groups.docs.length > 0 ? (
            <CommandGroup heading="DOCUMENTOS">
              {groups.docs.map((item) => (
                <CommandItem
                  key={item.id}
                  value={`doc:${item.id}`}
                  onSelect={() => run(() => onSelectDoc(item.id))}
                >
                  <FileTextIcon aria-hidden className="text-primary" />
                  <span className="truncate">{item.label}</span>
                  <CommandShortcut className="max-w-[45%] truncate normal-case">
                    {item.path}
                  </CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}
          {groups.files.length > 0 ? (
            <CommandGroup heading="ARCHIVOS">
              {groups.files.map((item) => (
                <CommandItem
                  key={item.id}
                  value={`file:${item.id}`}
                  onSelect={() => run(() => onOpenFile(item.path))}
                >
                  <FileTextIcon aria-hidden />
                  <span className="truncate">{item.label}</span>
                  <CommandShortcut className="max-w-[45%] truncate normal-case">
                    {item.path}
                  </CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}
          <CommandGroup heading="ACCIONES">
            {groups.actions.map((action) => (
              <CommandItem
                key={action.id}
                value={`action:${action.id}`}
                onSelect={() => run(actionFor(action.id))}
              >
                {action.id === "open" ? (
                  <FolderOpenIcon aria-hidden />
                ) : action.id === "new" ? (
                  <PlusIcon aria-hidden />
                ) : (
                  <SunMoonIcon aria-hidden />
                )}
                <span className="truncate">{action.label}</span>
                {action.shortcut ? (
                  <CommandShortcut>{action.shortcut}</CommandShortcut>
                ) : null}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
        <div className="flex items-center gap-2 border-t border-border px-3 py-2 text-[10px] text-muted-foreground">
          <span className="rounded-[5px] border border-border px-1.5 py-0.5 font-mono">
            ↑↓ navegar
          </span>
          <span aria-hidden>·</span>
          <span className="rounded-[5px] border border-border px-1.5 py-0.5 font-mono">
            ↵ abrir
          </span>
          <span aria-hidden>·</span>
          <span className="rounded-[5px] border border-border px-1.5 py-0.5 font-mono">
            esc cerrar
          </span>
        </div>
      </Command>
    </CommandDialog>
  );
}
