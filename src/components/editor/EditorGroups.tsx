/**
 * Shell de los grupos de edición de Inkline (ODD editor groups · T3).
 *
 * El área de trabajo puede estar dividida en dos grupos (S1). Este componente
 * sólo pinta lo que el modelo de `hooks/editorGroups` decide: los documentos
 * siguen viviendo en el almacén único de `lib/documents` y cada grupo sólo
 * apunta a su documento activo, así que el mismo `.md` puede estar en los dos
 * con el contenido sincronizado (S7).
 *
 * Reglas de pintado:
 * - Un grupo: ocupa el área tal y como estaba antes (mismo estado vacío).
 * - Dos grupos: grupo redimensionable con un panel por grupo, 50/50 inicial y
 *   SIN persistencia (la división es de sesión, S7).
 * - El grupo vacío explica cómo llenarlo (S4) y cada grupo lleva su cruz
 *   mientras haya dos (S5).
 * - Pulsar en un grupo le da el foco, que se marca con una barra superior
 *   (regla en `index.css`) y decide a quién van los atajos del shell.
 *
 * La vista (editor/preview/split) es de cada grupo (S3): el control segmentado
 * de su `EditorWorkspace` despacha `SET_MODE` para SU grupo.
 */

import { Fragment, type ReactNode } from "react";
import { XIcon } from "lucide-react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import {
  EditorWorkspace,
  type EditorWorkspaceHandle,
} from "@/components/editor/EditorWorkspace";
import type { EditorConfig } from "@/components/editor/EditorPane";
import { ErrorBoundary } from "@/components/shell/ErrorBoundary";
import type { Group, GroupId } from "@/hooks/editorGroups";
import { readSplitLayout } from "@/hooks/splitLayout";
import type { Theme } from "@/hooks/useTheme";
import type { OpenDocument, ViewState } from "@/lib/documents";
import type { WorkspaceMode } from "@/lib/editor/mode";
import { comboLabel } from "@/lib/platform";

/** Handles de los editores, uno por grupo; los atajos usan el del grupo con foco. */
export type EditorGroupRefs = Partial<Record<GroupId, EditorWorkspaceHandle | null>>;

export interface EditorGroupsProps {
  groups: Group[];
  focusedGroupId: GroupId;
  /** Almacén único de documentos; los grupos sólo guardan ids. */
  docs: OpenDocument[];
  theme: Theme;
  /** Preferencias de escritura; las mismas para todos los editores. */
  editorConfig?: EditorConfig;
  zoom?: number;
  /** Nodo de lectura de cada grupo: el shell lo construye como siempre. */
  previewFor: (doc: OpenDocument) => ReactNode;
  onModeChange: (groupId: GroupId, mode: WorkspaceMode) => void;
  onFocus: (groupId: GroupId) => void;
  onCloseGroup: (groupId: GroupId) => void;
  onContents: (id: string, contents: string) => void;
  onViewState: (id: string, viewState: ViewState) => void;
  /** Ref compartida por el shell: aquí se publica el handle de cada grupo. */
  editorRefs?: { current: EditorGroupRefs };
}

/**
 * Reparto inicial entre grupos: mitad y mitad y sin `onLayoutChange`, porque la
 * división no se persiste (S7). Es una constante para no reiniciar el divisor
 * en cada render.
 */
const GROUP_LAYOUT: Record<string, number> = { "group-1": 50, "group-2": 50 };

export function EditorGroups({
  groups,
  focusedGroupId,
  docs,
  theme,
  editorConfig,
  zoom,
  previewFor,
  onModeChange,
  onFocus,
  onCloseGroup,
  onContents,
  onViewState,
  editorRefs,
}: EditorGroupsProps) {
  const split = groups.length > 1;

  const docFor = (group: Group): OpenDocument | null =>
    group.activeDocId ? docs.find((doc) => doc.id === group.activeDocId) ?? null : null;

  const renderGroup = (group: Group, index: number): ReactNode => {
    const doc = docFor(group);
    return (
      <section
        key={group.id}
        data-editor-group={group.id}
        data-focused={group.id === focusedGroupId ? "true" : undefined}
        aria-label={`Grupo de edición ${index + 1}`}
        onPointerDown={() => onFocus(group.id)}
        className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
      >
        {/* Cruz de cierre por grupo: sólo mientras haya dos (S5). Va en su
            propia franja para no tapar el control de vista del editor. */}
        {split ? (
          <div className="flex h-[29px] min-h-[29px] shrink-0 items-center justify-end border-b border-border bg-ink-side px-2">
            <button
              type="button"
              aria-label="Cerrar grupo"
              title="Cerrar grupo"
              onClick={() => onCloseGroup(group.id)}
              className="grid size-[22px] place-items-center rounded-[6px] text-ink-faint transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <XIcon aria-hidden className="size-3" />
            </button>
          </div>
        ) : null}

        {/* Frontera por documento: un fallo del editor no tumba el shell ni el
            otro grupo, y se reinicia al cambiar el documento del grupo. */}
        <ErrorBoundary area="el documento" key={doc?.id ?? "sin-documento"}>
          {doc ? (
            <EditorWorkspace
              ref={(handle) => {
                if (editorRefs) editorRefs.current[group.id] = handle;
              }}
              doc={{ id: doc.id, contents: doc.contents, viewState: doc.viewState }}
              theme={theme}
              mode={group.mode}
              onModeChange={(mode) => onModeChange(group.id, mode)}
              onContents={onContents}
              onViewState={onViewState}
              preview={previewFor(doc)}
              editorConfig={editorConfig}
              splitLayout={readSplitLayout(doc.viewState)}
              onSplitLayoutChange={(layout) =>
                onViewState(doc.id, { ...doc.viewState, splitLayout: layout })
              }
              zoom={zoom}
            />
          ) : (
            <GroupEmpty split={split} />
          )}
        </ErrorBoundary>
      </section>
    );
  };

  return (
    <div
      data-slot="editor-groups"
      data-split={split ? "true" : undefined}
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      {split ? (
        <ResizablePanelGroup
          orientation="horizontal"
          defaultLayout={GROUP_LAYOUT}
          className="min-h-0 flex-1"
        >
          {groups.map((group, index) => (
            <Fragment key={group.id}>
              <ResizablePanel id={`group-${group.id}`} minSize="20" className="min-w-0">
                {renderGroup(group, index)}
              </ResizablePanel>
              {index < groups.length - 1 ? (
                <ResizableHandle aria-label="Redimensionar grupos" />
              ) : null}
            </Fragment>
          ))}
        </ResizablePanelGroup>
      ) : (
        renderGroup(groups[0], 0)
      )}
    </div>
  );
}

/**
 * Área de un grupo sin documento.
 *
 * Con un solo grupo se mantiene exactamente el estado vacío de siempre. Con dos
 * grupos, el grupo nuevo nace vacío y dice dónde se abrirá lo que elija la
 * persona (S4), más el recordatorio de que ⌘D es lo que divide.
 */
function GroupEmpty({ split }: { split: boolean }) {
  if (!split) {
    return (
      <section className="flex min-h-0 flex-1 flex-col bg-ink-preview" data-slot="group-empty">
        <div className="grid h-full place-items-center text-center">
          <div>
            <h2 className="text-lg font-bold text-foreground">Ningún documento abierto</h2>
            <p className="mt-2 text-xs text-muted-foreground">
              Abre un archivo con {comboLabel("O")} o crea uno nuevo con {comboLabel("N")}.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div
      data-slot="group-empty"
      className="grid min-h-0 flex-1 place-items-center overflow-y-auto bg-ink-preview px-6 py-10"
    >
      <div className="w-full max-w-[320px] rounded-[14px] border border-dashed border-border bg-card/60 px-6 py-8 text-center">
        <p className="text-[13px] font-semibold text-foreground">Este editor está libre</p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Abre un archivo con {comboLabel("O")} o elige uno del explorador; se abrirá en este
          editor.
        </p>
        <p className="mt-3 text-[10px] tracking-[0.4px] text-ink-faint">
          {comboLabel("D")} divide el área en dos editores.
        </p>
      </div>
    </div>
  );
}
