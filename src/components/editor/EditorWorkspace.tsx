/**
 * Espacio de trabajo de edición de Inkline (ODD T3 / S2 · S4 · S6).
 *
 * Compone la unidad que el shell monta: barra de formato + control segmentado +
 * las dos columnas del mockup (`.panes`). La vista previa no la construye este
 * componente: el shell la pasa como nodo, porque la lectura ya existe en T2 y
 * sólo se le da sitio aquí.
 *
 * Disposiciones:
 * - `editor`: una sola columna con el editor.
 * - `split`: editor y vista previa al 50/50, con el borde del `.edit-pane`.
 * - `preview`: una sola columna con la vista previa.
 */

import { forwardRef, useImperativeHandle, useRef, type ReactNode } from "react";
import { cn } from "cn";
import { FormatToolbar } from "@/components/editor/FormatToolbar";
import { ModeSwitch } from "@/components/editor/ModeSwitch";
import { EditorPane, type EditorDocument, type EditorPaneHandle } from "@/components/editor/EditorPane";
import type { FormatKind } from "@/lib/editor/format";
import type { WorkspaceMode } from "@/lib/editor/mode";
import type { Theme } from "@/hooks/useTheme";

export interface EditorWorkspaceProps {
  doc: EditorDocument;
  theme: Theme;
  mode: WorkspaceMode;
  onModeChange: (mode: WorkspaceMode) => void;
  onContents: (id: string, contents: string) => void;
  onViewState: (id: string, viewState: Record<string, unknown>) => void;
  /** Nodo de lectura que el shell aporta (p. ej. `<MarkdownView />`). */
  preview?: ReactNode;
}

export interface EditorWorkspaceHandle {
  applyFormat: (kind: FormatKind) => void;
}

/** Clases de la rejilla de paneles del mockup, por vista. */
const PANES: Record<WorkspaceMode, string> = {
  editor: "grid-cols-[minmax(0,1fr)]",
  split: "grid-cols-[minmax(0,1fr)_minmax(0,1fr)]",
  preview: "grid-cols-[minmax(0,1fr)]",
};

const PANE_HEAD =
  "flex h-[53px] min-h-[53px] items-center justify-between border-b border-border/60 px-6 text-[10px] font-extrabold tracking-[1.35px] text-muted-foreground";

/** Tamaño en bytes reales (UTF-8), sin depender de `TextEncoder`. */
export function utf8Bytes(text: string): number {
  let bytes = 0;
  for (const character of text) {
    const code = character.codePointAt(0) ?? 0;
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
  }
  return bytes;
}

function sizeLabel(contents: string): string {
  const bytes = utf8Bytes(contents);
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

export const EditorWorkspace = forwardRef<EditorWorkspaceHandle, EditorWorkspaceProps>(
  function EditorWorkspace(
    { doc, theme, mode, onModeChange, onContents, onViewState, preview },
    ref,
  ) {
    const paneRef = useRef<EditorPaneHandle>(null);
    const showEditor = mode !== "preview";
    const showPreview = mode !== "editor";

    useImperativeHandle(
      ref,
      () => ({
        applyFormat(kind: FormatKind) {
          paneRef.current?.applyFormat(kind);
        },
      }),
      [],
    );

    return (
      <div className="flex min-h-0 flex-1 flex-col" data-mode={mode}>
        <div className="flex h-[49px] min-h-[49px] items-center gap-[3px] border-b border-border px-[17px]">
          <FormatToolbar
            onFormat={(kind) => paneRef.current?.applyFormat(kind)}
            disabled={!showEditor}
          />
          <div className="ml-auto">
            <ModeSwitch mode={mode} onModeChange={onModeChange} />
          </div>
        </div>

        <div
          data-panes={PANES[mode]}
          className={cn("grid min-h-0 flex-1", PANES[mode])}
        >
          {showEditor ? (
            <section
              data-pane="editor"
              aria-label="Editor de Markdown"
              className={cn(
                "flex min-w-0 flex-col",
                mode === "split" && "border-r border-border",
              )}
            >
              <div className={PANE_HEAD}>
                <span>
                  <span aria-hidden className="mr-2 text-primary">
                    ●
                  </span>
                  FUENTE / MARKDOWN
                </span>
                <span className="font-normal tracking-normal text-ink-faint">
                  UTF-8 · {sizeLabel(doc.contents)}
                </span>
              </div>
              <div className="min-h-0 flex-1">
                <EditorPane
                  ref={paneRef}
                  doc={doc}
                  theme={theme}
                  onContents={onContents}
                  onViewState={onViewState}
                />
              </div>
            </section>
          ) : null}

          {showPreview ? (
            <section
              data-pane="preview"
              aria-label="Vista previa"
              className="flex min-w-0 flex-col bg-ink-preview"
            >
              <div className={PANE_HEAD}>
                <span>
                  <span aria-hidden className="mr-2 text-primary">
                    ◉
                  </span>
                  VISTA PREVIA
                </span>
                <span className="font-normal tracking-normal text-ink-faint">
                  <span aria-hidden className="text-[#94cd75]">
                    ●
                  </span>{" "}
                  GFM + Mermaid
                </span>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-8 pb-20">{preview}</div>
            </section>
          ) : null}
        </div>
      </div>
    );
  },
);
