/**
 * Barra de pestañas dividida, «tipo Chrome» (ODD editor groups · T4 · S6).
 *
 * UNA sola barra con una sección por grupo de edición (máximo dos) y un divisor
 * vertical visible entre ellas. Cada sección lista las pestañas de SU grupo,
 * resalta su `activeDocId` y lleva la marca de acento cuando es la sección del
 * grupo con foco — la misma marca (`data-focused`, barra superior de 2 px) que
 * usa el área de trabajo.
 *
 * Por qué las pestañas NO pasan por el almacén: `lib/documents` tiene un único
 * `activeId` y `useEditorGroups` tiene un puente que abre cada documento nuevo
 * en el grupo ENFOCADO (es el camino correcto para ⌘O/⌘N/explorador/recientes/
 * paleta). Si un clic de pestaña seleccionase en el almacén, el puente se
 * llevaría el documento al grupo con foco: pulsar una pestaña del grupo de al
 * lado la movería al otro y la sección de origen se quedaría sin nada. Por eso
 * el clic no toca el almacén: entrega el grupo de la PESTAÑA (`onSelectTab(grupo,
 * documento)`, que el shell traduce a `ACTIVATE_DOC` + `FOCUS_GROUP`) y el
 * puente del almacén queda reservado a «abrir» documentos, nunca a activarlos.
 *
 * El cierre sí es del almacén, porque un documento es uno solo aunque viva en
 * los dos grupos (S7): la cruz llama a `onClose(docId)` y el shell ejecuta el
 * MISMO flujo de siempre (confirmación si está sucio, `closeDoc`), tras lo cual
 * poda el id de todas las secciones.
 *
 * No se usa `role="tablist"`: el panel del documento vive fuera de este
 * componente, así que la pestaña se anuncia como botón con `aria-current`, que
 * describe exactamente lo que hace (seleccionar el documento activo de su grupo).
 * Los nombres accesibles del cierre incluyen el grupo sólo cuando hay dos
 * secciones posibles; con una sola barra se conservan los de siempre.
 */

import { Fragment } from "react";
import { FileTextIcon, XIcon } from "lucide-react";
import { cn } from "cn";
import type { GroupId } from "@/hooks/editorGroups";
import { comboLabel } from "@/lib/platform";

export interface TabDocument {
  id: string;
  name: string;
  dirty: boolean;
}

/** Una sección de la barra: las pestañas de un grupo y cuál está activa. */
export interface TabSection {
  groupId: GroupId;
  /** Documentos del grupo, ya resueltos contra el almacén y en su orden. */
  docs: TabDocument[];
  activeDocId: string | null;
}

export interface TabsBarProps {
  sections: TabSection[];
  focusedGroupId: GroupId;
  /** Clic en una pestaña: ese documento pasa a activo en SU grupo. */
  onSelectTab: (groupId: GroupId, docId: string) => void;
  /** Foco a un grupo, sin tocar qué documento tiene activo. */
  onFocusGroup: (groupId: GroupId) => void;
  /** Cierre del almacén: el documento es único aunque esté en dos grupos. */
  onClose: (docId: string) => void;
}

/** Texto de la sección vacía (S4): explica dónde se abrirá el próximo documento. */
const EMPTY_SECTION_LABEL = `Vacío · ${comboLabel("O")} abre aquí`;

export function TabsBar({
  sections,
  focusedGroupId,
  onSelectTab,
  onFocusGroup,
  onClose,
}: TabsBarProps) {
  const split = sections.length > 1;

  return (
    <nav
      aria-label="Documentos abiertos"
      data-slot="tabs-bar"
      data-split={split ? "true" : undefined}
      className="flex h-[45px] min-h-[45px] shrink-0 items-stretch border-b border-border bg-ink-side"
    >
      {sections.map((section, index) => {
        const focused = section.groupId === focusedGroupId;
        return (
          <Fragment key={section.groupId}>
            {/* Divisor entre secciones: una línea visible, nunca detrás de la
                última. */}
            {index > 0 ? (
              <span
                aria-hidden
                data-slot="tabs-divider"
                className="w-px shrink-0 self-stretch bg-border"
              />
            ) : null}
            <div
              role="group"
              aria-label={`Pestañas del grupo ${index + 1}`}
              data-slot="tabs-section"
              data-group={section.groupId}
              data-focused={focused ? "true" : undefined}
              onPointerDown={() => onFocusGroup(section.groupId)}
              className="relative flex min-w-0 flex-1 items-stretch"
            >
              {/* Marca de foco: mismo acento superior de 2 px que el área de
                  trabajo del grupo (`data-focused` en el shell), y con
                  `pointer-events: none` para no comerse clics de las pestañas. */}
              {focused ? (
                <span
                  aria-hidden
                  data-slot="tabs-focus-mark"
                  className="pointer-events-none absolute inset-x-0 top-0 z-10 h-0.5 bg-primary"
                />
              ) : null}

              <div className="flex min-w-0 flex-1 items-stretch overflow-x-auto">
                {section.docs.length === 0 ? (
                  <div className="flex items-center pl-2">
                    <button
                      type="button"
                      data-slot="tabs-empty"
                      onClick={() => onFocusGroup(section.groupId)}
                      title={`${comboLabel("O")} abre el próximo documento en este grupo`}
                      className="flex h-[27px] shrink-0 items-center rounded-[7px] border border-dashed border-border px-2.5 text-[10px] text-ink-faint transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      {EMPTY_SECTION_LABEL}
                    </button>
                  </div>
                ) : (
                  section.docs.map((doc) => {
                    const active = doc.id === section.activeDocId;
                    return (
                      <div
                        key={doc.id}
                        data-slot="tab"
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
                          onClick={() => {
                            // Foco explícito además del `pointerdown` de la
                            // sección: activar con teclado (Enter/Espacio)
                            // dispara `click` sin pointer, y el grupo de la
                            // pestaña debe quedar enfocado para el siguiente
                            // atajo (⌘W/⌘S de T5).
                            onFocusGroup(section.groupId);
                            onSelectTab(section.groupId, doc.id);
                          }}
                          title={doc.name}
                          className="flex h-full min-w-0 flex-1 items-center gap-2 pr-1 pl-3 text-left transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:-ring-inset"
                        >
                          <FileTextIcon
                            aria-hidden
                            className={cn(
                              "size-3.5 shrink-0",
                              active ? "text-primary" : "text-ink-faint",
                            )}
                          />
                          <span className="truncate text-[11px]">{doc.name}</span>
                          {doc.dirty ? (
                            <>
                              <span
                                aria-hidden
                                className="size-1.5 shrink-0 rounded-full bg-primary"
                              />
                              <span className="sr-only">Cambios sin guardar</span>
                            </>
                          ) : null}
                        </button>
                        <button
                          type="button"
                          aria-label={closeLabel(doc.name, index, split)}
                          onClick={() => onClose(doc.id)}
                          className="mr-2 grid size-5 shrink-0 place-items-center rounded text-ink-faint hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                        >
                          <XIcon aria-hidden className="size-3" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </Fragment>
        );
      })}
    </nav>
  );
}

/**
 * Nombre accesible del cierre. Con dos secciones el mismo documento puede estar
 * en las dos, así que el grupo forma parte del nombre; con una sola se mantiene
 * el nombre de siempre.
 */
function closeLabel(name: string, index: number, split: boolean): string {
  return split ? `Cerrar ${name} en el grupo ${index + 1}` : `Cerrar ${name}`;
}
