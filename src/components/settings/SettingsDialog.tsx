/**
 * Ventana de preferencias de Inkline (ODD T6 / S4 · S6).
 *
 * Reproduce el `.settings-window` del mockup
 * (`design/inkline/inkline-markdown-studio.html`): barra de título con engranaje
 * y «Preferencias», navegación lateral de cinco secciones, filas `.setting`
 * (nombre + nota + control), cajas `.settings-info` y el pie local-first.
 *
 * El componente es de sólo lectura sobre las preferencias: recibe `settings` y
 * avisa con `onChange(partial)`; quien lo monta decide si persiste con
 * `updateSettings` (ver `lib/settings.ts`). Así la ventana se puede probar sin
 * almacén y el shell conserva la única escritura de preferencias.
 *
 * Las listas son el `Select` de `ui/` (Base UI) y los interruptores el `Switch`
 * del proyecto; la validación de los valores vive en `lib/settings`, cuyos
 * guardianes se usan aquí antes de emitir un cambio.
 */

import { useEffect, useState, type ReactNode } from "react";
import {
  DownloadIcon,
  FolderIcon,
  PencilIcon,
  SettingsIcon,
  SunIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { PRINT_IN_BROWSER_NOTE } from "@/components/export/ExportMenu";
import {
  EDITOR_FONT_SIZES,
  PREVIEW_FONT_SIZES,
  TAB_WIDTHS,
  ZOOM_LEVELS,
  isDefaultView,
  isEditorFontSize,
  isPageSize,
  isPreviewFont,
  isPreviewFontSize,
  isTabWidth,
  isThemeMode,
  isZoom,
  type Settings,
} from "@/lib/settings";
import { comboLabel } from "@/lib/platform";

export interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: Settings;
  onChange: (partial: Partial<Settings>) => void;
  /** Carpeta raíz del espacio de trabajo, o `null` si aún no hay ninguna. */
  currentRoot: string | null;
  onChooseRoot: () => void;
  onExportHtml: () => void;
  onOpenPrint: () => void;
}

export type SettingsSection = "appearance" | "editor" | "files" | "export" | "shortcuts";

interface SectionMeta {
  id: SettingsSection;
  label: string;
  icon: LucideIcon | "command";
}

/** Secciones de la navegación lateral, en el orden del mockup. */
export const SETTINGS_SECTIONS: readonly SectionMeta[] = [
  { id: "appearance", label: "Apariencia", icon: SunIcon },
  { id: "editor", label: "Editor", icon: PencilIcon },
  { id: "files", label: "Archivos", icon: FolderIcon },
  { id: "export", label: "Exportación", icon: DownloadIcon },
  { id: "shortcuts", label: "Atajos", icon: "command" },
];

export interface ShortcutRow {
  action: string;
  /** Teclas sin modificador; se pintan con el de la plataforma. */
  keys: readonly string[];
}

/** Tabla de atajos; el modificador se resuelve según la plataforma. */
export const SHORTCUTS: readonly ShortcutRow[] = [
  { action: "Buscar archivos y contenido", keys: ["K"] },
  { action: "Buscar en documento", keys: ["F"] },
  { action: "Mostrar / ocultar explorador", keys: ["\\"] },
  { action: "Preferencias", keys: [","] },
  { action: "Abrir archivo", keys: ["O"] },
  { action: "Guardar", keys: ["S"] },
  { action: "Exportar HTML", keys: ["E"] },
  { action: "Negrita / cursiva", keys: ["B", "I"] },
  { action: "Nuevo documento", keys: ["N"] },
  { action: "Aumentar / reducir zoom", keys: ["+", "−"] },
  { action: "Restablecer zoom", keys: ["0"] },
];

const NAV_BUTTON =
  "flex w-full items-center gap-2.5 rounded-lg px-3 py-[11px] text-left text-xs transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

const INFO_BOX =
  "mt-5 rounded-[10px] border border-border bg-ink-side p-[15px] text-[11px] leading-[1.7] text-muted-foreground";

interface SettingRowProps {
  name: string;
  note: string;
  children: ReactNode;
}

/** Una fila `.setting`: nombre y nota a la izquierda, control a la derecha. */
function SettingRow({ name, note, children }: SettingRowProps) {
  return (
    <div className="flex items-center justify-between gap-[25px] py-[17px]">
      <div className="min-w-0">
        <div className="text-xs font-bold">{name}</div>
        <div className="mt-[5px] max-w-[330px] text-[11px] leading-normal text-muted-foreground">
          {note}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">{children}</div>
    </div>
  );
}

/** Filas con la misma separación que el mockup. */
function SettingRows({ children }: { children: ReactNode }) {
  return <div className="divide-y divide-border/60 border-t border-border/60">{children}</div>;
}

interface SettingSelectProps {
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onValueChange: (value: string) => void;
}

function SettingSelect({ label, value, options, onValueChange }: SettingSelectProps) {
  return (
    <Select
      value={value}
      onValueChange={(next) => {
        if (next !== null) onValueChange(next);
      }}
    >
      <SelectTrigger aria-label={label} size="sm" className="h-8 min-w-[132px] text-[11px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function PanelHead({ title, intro }: { title: string; intro: string }) {
  return (
    <>
      <h3 className="m-0 text-[17px] font-bold tracking-[-0.4px]">{title}</h3>
      <p className="mt-0 mb-[25px] text-[11px] leading-[1.7] text-muted-foreground">{intro}</p>
    </>
  );
}

interface SettingSwitchProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function SettingSwitch({ label, checked, onChange }: SettingSwitchProps) {
  return (
    <Switch
      aria-label={label}
      checked={checked}
      onCheckedChange={(next) => onChange(next === true)}
    />
  );
}

export function SettingsDialog({
  open,
  onOpenChange,
  settings,
  onChange,
  currentRoot,
  onChooseRoot,
  onExportHtml,
  onOpenPrint,
}: SettingsDialogProps) {
  const [section, setSection] = useState<SettingsSection>("appearance");

  // El mockup abre siempre por Apariencia; al reabrir, se vuelve al principio.
  useEffect(() => {
    if (open) setSection("appearance");
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[calc(100dvh-55px)] w-[min(790px,100%)] flex-col gap-0 overflow-hidden rounded-[15px] border border-border bg-popover p-0 sm:max-w-[min(790px,100%)]"
      >
        <div className="flex items-center gap-[11px] border-b border-border px-[22px] py-[19px]">
          <SettingsIcon aria-hidden className="size-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <DialogTitle className="text-[17px] leading-tight font-bold tracking-[-0.6px]">
              Preferencias
            </DialogTitle>
            <DialogDescription className="mt-1 text-[10px] text-muted-foreground">
              Personaliza tu espacio de escritura
            </DialogDescription>
          </div>
          <button
            type="button"
            aria-label="Cerrar ajustes"
            onClick={() => onOpenChange(false)}
            className="ml-auto grid size-[29px] shrink-0 place-items-center rounded-[7px] border border-border bg-muted text-lg leading-none text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            ×
          </button>
        </div>

        <div className="flex min-h-0 flex-1">
          <nav
            aria-label="Secciones de preferencias"
            className="w-[176px] flex-none border-r border-border bg-ink-side px-2.5 py-[17px]"
          >
            {SETTINGS_SECTIONS.map((item) => {
              const active = item.id === section;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-current={active ? "true" : undefined}
                  onClick={() => setSection(item.id)}
                  className={cn(
                    NAV_BUTTON,
                    active
                      ? "bg-muted font-bold text-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {Icon === "command" ? (
                    <span aria-hidden className="w-3.5 text-center font-mono text-base leading-none">
                      ⌘
                    </span>
                  ) : (
                    <Icon
                      aria-hidden
                      className={cn("size-3.5 shrink-0", active && "text-primary")}
                    />
                  )}
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="min-w-0 flex-1 overflow-y-auto px-[31px] pt-[27px] pb-[38px]">
            {section === "appearance" ? (
              <section data-panel="appearance">
                <PanelHead
                  title="Apariencia"
                  intro="Un diseño limpio que respeta la apariencia de tu sistema operativo."
                />
                <SettingRows>
                  <SettingRow name="Tema" note="Automático sigue el tema del sistema.">
                    <SettingSelect
                      label="Tema"
                      value={settings.themeMode}
                      options={[
                        { value: "system", label: "Automático" },
                        { value: "dark", label: "Oscuro" },
                        { value: "light", label: "Claro" },
                      ]}
                      onValueChange={(value) => {
                        if (isThemeMode(value)) onChange({ themeMode: value });
                      }}
                    />
                  </SettingRow>
                  <SettingRow
                    name="Tipografía de lectura"
                    note="Solo afecta a la vista previa, no al contenido Markdown."
                  >
                    <SettingSelect
                      label="Tipografía de lectura"
                      value={settings.previewFont}
                      options={[
                        { value: "sans", label: "Sans serif" },
                        { value: "serif", label: "Serif editorial" },
                      ]}
                      onValueChange={(value) => {
                        if (isPreviewFont(value)) onChange({ previewFont: value });
                      }}
                    />
                  </SettingRow>
                  <SettingRow
                    name="Tamaño de lectura"
                    note="Escala todo el texto de lectura, títulos incluidos."
                  >
                    <SettingSelect
                      label="Tamaño de lectura"
                      value={String(settings.previewFontSize)}
                      options={PREVIEW_FONT_SIZES.map((size) => ({
                        value: String(size),
                        label: `${size} px`,
                      }))}
                      onValueChange={(value) => {
                        const size = Number(value);
                        if (isPreviewFontSize(size)) onChange({ previewFontSize: size });
                      }}
                    />
                  </SettingRow>
                  <SettingRow
                    name="Zoom de texto"
                    note={`Escala editor y vista previa; ${comboLabel("+")} / ${comboLabel("−")} / ${comboLabel("0")} cambian el nivel.`}
                  >
                    <SettingSelect
                      label="Zoom de texto"
                      value={String(settings.zoom)}
                      options={ZOOM_LEVELS.map((zoom) => ({
                        value: String(zoom),
                        label: `${zoom}%`,
                      }))}
                      onValueChange={(value) => {
                        const zoom = Number(value);
                        if (isZoom(zoom)) onChange({ zoom });
                      }}
                    />
                  </SettingRow>
                  <SettingRow
                    name="Vista al abrir"
                    note="Puedes cambiarla también desde la barra del editor."
                  >
                    <SettingSelect
                      label="Vista al abrir"
                      value={settings.defaultView}
                      options={[
                        { value: "split", label: "Dividida" },
                        { value: "editor", label: "Solo editor" },
                        { value: "preview", label: "Solo preview" },
                      ]}
                      onValueChange={(value) => {
                        if (isDefaultView(value)) onChange({ defaultView: value });
                      }}
                    />
                  </SettingRow>
                </SettingRows>
              </section>
            ) : null}

            {section === "editor" ? (
              <section data-panel="editor">
                <PanelHead
                  title="Editor"
                  intro="Ajustes que cambian la experiencia de escritura sin alterar el Markdown."
                />
                <SettingRows>
                  <SettingRow name="Tamaño de letra" note="Escala del texto fuente en píxeles.">
                    <SettingSelect
                      label="Tamaño de letra"
                      value={String(settings.editorFontSize)}
                      options={EDITOR_FONT_SIZES.map((size) => ({
                        value: String(size),
                        label: `${size} px`,
                      }))}
                      onValueChange={(value) => {
                        const size = Number(value);
                        if (isEditorFontSize(size)) onChange({ editorFontSize: size });
                      }}
                    />
                  </SettingRow>
                  <SettingRow
                    name="Indentación con Tab"
                    note="Espacios insertados al pulsar Tab."
                  >
                    <SettingSelect
                      label="Indentación con Tab"
                      value={String(settings.tabWidth)}
                      options={TAB_WIDTHS.map((width) => ({
                        value: String(width),
                        label: `${width} espacios`,
                      }))}
                      onValueChange={(value) => {
                        const width = Number(value);
                        if (isTabWidth(width)) onChange({ tabWidth: width });
                      }}
                    />
                  </SettingRow>
                  <SettingRow
                    name="Mostrar números de línea"
                    note="Gutter de numeración junto al Markdown."
                  >
                    <SettingSwitch
                      label="Mostrar números de línea"
                      checked={settings.lineNumbers}
                      onChange={(lineNumbers) => onChange({ lineNumbers })}
                    />
                  </SettingRow>
                  <SettingRow
                    name="Ajuste de línea"
                    note="Evita el desplazamiento horizontal en textos largos."
                  >
                    <SettingSwitch
                      label="Ajuste de línea"
                      checked={settings.wordWrap}
                      onChange={(wordWrap) => onChange({ wordWrap })}
                    />
                  </SettingRow>
                  <SettingRow
                    name="Corrección ortográfica"
                    note="Utiliza el diccionario instalado en el sistema."
                  >
                    <SettingSwitch
                      label="Corrección ortográfica"
                      checked={settings.spellcheck}
                      onChange={(spellcheck) => onChange({ spellcheck })}
                    />
                  </SettingRow>
                </SettingRows>
              </section>
            ) : null}

            {section === "files" ? (
              <section data-panel="files">
                <PanelHead
                  title="Archivos"
                  intro="Tu carpeta de trabajo y las operaciones con documentos locales."
                />
                <SettingRows>
                  <SettingRow
                    name="Carpeta raíz"
                    note="Cambia el workspace de Markdown visible en el explorador."
                  >
                    <span
                      title={currentRoot ?? undefined}
                      className="max-w-[240px] truncate font-mono text-[11px] text-muted-foreground"
                    >
                      {currentRoot ?? "Sin carpeta elegida"}
                    </span>
                    <Button variant="outline" size="sm" onClick={onChooseRoot}>
                      Elegir carpeta…
                    </Button>
                  </SettingRow>
                  <SettingRow
                    name="Confirmar al cerrar cambios"
                    note="Advertir si un documento tiene modificaciones sin guardar."
                  >
                    <SettingSwitch
                      label="Confirmar al cerrar cambios"
                      checked={settings.confirmClose}
                      onChange={(confirmClose) => onChange({ confirmClose })}
                    />
                  </SettingRow>
                </SettingRows>
                <div className={INFO_BOX}>
                  El espacio de trabajo y los archivos recientes se guardan en la configuración
                  del sistema de Inkline. Tus documentos siguen en tu disco: nada sale de este
                  equipo.
                </div>
              </section>
            ) : null}

            {section === "export" ? (
              <section data-panel="export">
                <PanelHead
                  title="Exportación"
                  intro="Diferenciamos guardar el archivo fuente, descargar una copia y publicar el resultado."
                />
                <SettingRows>
                  <SettingRow
                    name="Tamaño de página"
                    note="Se aplica al diálogo de impresión / Guardar PDF."
                  >
                    <SettingSelect
                      label="Tamaño de página"
                      value={settings.pageSize}
                      options={[
                        { value: "A4", label: "A4" },
                        { value: "letter", label: "US Letter" },
                      ]}
                      onValueChange={(value) => {
                        if (isPageSize(value)) onChange({ pageSize: value });
                      }}
                    />
                  </SettingRow>
                  <SettingRow
                    name="Exportar HTML"
                    note="Un solo archivo con estilos, código resaltado y diagramas renderizados."
                  >
                    <Button variant="outline" size="sm" onClick={onExportHtml}>
                      Exportar ahora
                    </Button>
                  </SettingRow>
                  <SettingRow
                    name="Imprimir / Guardar PDF"
                    note="Abre la ventana del sistema para imprimir o guardar como PDF."
                  >
                    <Button variant="outline" size="sm" onClick={onOpenPrint}>
                      Abrir impresión
                    </Button>
                  </SettingRow>
                </SettingRows>
                <div className={INFO_BOX}>
                  {PRINT_IN_BROWSER_NOTE} Descargar Markdown crea una copia .md; exportar no
                  sustituye al documento fuente.
                </div>
              </section>
            ) : null}

            {section === "shortcuts" ? (
              <section data-panel="shortcuts">
                <PanelHead
                  title="Atajos"
                  intro="Los atajos usan ⌘ en macOS y Ctrl en Windows y Linux."
                />
                <table className="w-full border-collapse text-xs">
                  <tbody>
                    {SHORTCUTS.map((row) => (
                      <tr key={row.action} className="border-b border-border/60">
                        <td className="py-[11px] pr-1 text-muted-foreground">{row.action}</td>
                        <td className="py-[11px] pl-1 text-right font-mono text-[11px] text-foreground">
                          {row.keys.map(comboLabel).join(" / ")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ) : null}
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-border px-[22px] py-[11px] text-[10px] text-ink-faint">
          <span className="tracking-[0.6px]">INKLINE / LOCAL-FIRST</span>
          <span>Preferencias guardadas en este equipo</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
