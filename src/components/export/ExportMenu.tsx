/**
 * Menú de exportación de Inkline (ODD T5 · S4 «Exportación»).
 *
 * Reproduce el `.export-trigger` + `.export-menu` del mockup con el
 * DropdownMenu de shadcn: disparador «Exportar», tres acciones con icono,
 * título, descripción y el atajo ⌘E en «Exportar HTML».
 *
 * Tres salidas distintas:
 * - Descargar Markdown: copia del `.md` original en la ruta que se elija.
 * - Exportar HTML: un archivo autónomo (estilos embebidos) con el documento.
 * - Imprimir / Guardar PDF: escribe ese mismo HTML en un temporal y lo abre en
 *   el navegador del sistema. WKWebView en macOS no abre el diálogo de
 *   impresión de forma fiable, así que el PDF se obtiene desde el navegador;
 *   el mensaje de estado se lo dice a la persona usuaria en sus términos.
 *
 * Y, desde T7 (S4), un segundo grupo con dos formatos de oficina: Word (.docx)
 * y OpenDocument (.odt). El modelo estructural viaja al comando
 * `convert_to_office` de Rust, que genera los paquetes nativos sin binarios
 * externos (funciona en Windows, Linux y macOS).
 *
 * El atajo ⌘E lo registra el shell: este componente sólo expone
 * `exportHtml()` en su handle imperativo. Ninguna operación lanza al llamador:
 * todo el resultado se comunica por `onStatus`.
 */

import { forwardRef, useCallback, useImperativeHandle } from "react";
import { comboLabel } from "@/lib/platform";
import {
  ChevronDownIcon,
  CodeIcon,
  DownloadIcon,
  FileTextIcon,
  FileType2Icon,
  FileTypeIcon,
  PrinterIcon,
  type LucideIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { exportStandaloneHtml, type ExportTheme } from "@/lib/export/html";
import type { PageSize } from "@/lib/settings";
import { exportOfficeDocument, type OFFICE_FORMATS } from "@/lib/export/documents";
import { htmlExportFileName, markdownExportFileName } from "@/lib/export/names";
import {
  HTML_EXPORT_FILTERS,
  MARKDOWN_EXPORT_FILTERS,
  openInBrowser,
  saveDocumentCopy,
  writeTemporaryExport,
} from "@/lib/export/operations";

/** Mensajes de estado del menú; el shell los muestra tal cual en su barra. */export const EXPORT_STATUS = {
  noDocument: "No hay ningún documento que exportar",
  cancelled: "Exportación cancelada",
  saved: (path: string) => `Exportado: ${path}`,
  printInBrowser: (path: string) =>
    `Impresión: el documento se abrió en tu navegador (${path}). Elige Imprimir o Guardar como PDF ahí.`,
  printRevealed: (path: string) =>
    `Documento listo para imprimir: ${path}. Ábrelo en tu navegador y elige Imprimir.`,
  failed: (error: unknown) =>
    `Error al exportar: ${error instanceof Error ? error.message : String(error)}`,
} as const;

/**
 * Nota de impresión compartida con la ventana de preferencias (T6): en macOS
 * WKWebView no abre el diálogo de impresión de forma fiable, así que el PDF se
 * obtiene desde el navegador del sistema.
 */
export const PRINT_IN_BROWSER_NOTE =
  "La impresión abre el documento en el navegador del sistema: elige ahí Imprimir o Guardar como PDF.";

export interface ExportMenuHandle {
  /** Exporta el HTML autónomo; lo invoca el atajo ⌘E del shell. */
  exportHtml: () => Promise<void>;
}

export interface ExportMenuProps {
  /** Contenido del documento activo; `null` deshabilita las tres acciones. */
  markdown: string | null;
  /** Título del documento (nombre de archivo o etiqueta de pestaña). */
  docTitle: string;
  theme: ExportTheme;
  /** Tamaño de página del bloque `@page` de la exportación (T6). */
  pageSize?: PageSize;
  onStatus: (message: string) => void;
}

const TRIGGER_CLASS =
  "flex h-[29px] min-w-[100px] items-center justify-center gap-2 rounded-[7px] border border-border bg-card px-2.5 text-[11px] font-bold text-foreground transition-colors hover:bg-muted aria-expanded:border-muted-foreground aria-expanded:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

interface ExportItemProps {
  icon: LucideIcon;
  label: string;
  description: string;
  shortcut?: string;
  disabled: boolean;
  onClick: () => void;
}

function ExportItem({
  icon: Icon,
  label,
  description,
  shortcut,
  disabled,
  onClick,
}: ExportItemProps) {
  return (
    <DropdownMenuItem
      disabled={disabled}
      onClick={onClick}
      className="items-start gap-[11px] rounded-[8px] px-2.5 py-2.5"
    >
      <Icon aria-hidden className="mt-0.5 size-3.5 shrink-0 text-primary" />
      <span className="min-w-0 flex-1">
        <strong className="block text-[11px] font-bold">{label}</strong>
        <span className="mt-1 block text-[10px] font-normal text-muted-foreground">
          {description}
        </span>
      </span>
      {shortcut ? <DropdownMenuShortcut>{shortcut}</DropdownMenuShortcut> : null}
    </DropdownMenuItem>
  );
}

export const ExportMenu = forwardRef<ExportMenuHandle, ExportMenuProps>(function ExportMenu(
  { markdown, docTitle, theme, pageSize = "A4", onStatus },
  ref,
) {
  const downloadMarkdown = useCallback(async (): Promise<void> => {
    if (markdown === null) {
      onStatus(EXPORT_STATUS.noDocument);
      return;
    }
    try {
      const saved = await saveDocumentCopy(
        markdown,
        markdownExportFileName(docTitle),
        MARKDOWN_EXPORT_FILTERS,
      );
      onStatus(saved === null ? EXPORT_STATUS.cancelled : EXPORT_STATUS.saved(saved));
    } catch (error) {
      onStatus(EXPORT_STATUS.failed(error));
    }
  }, [docTitle, markdown, onStatus]);

  const exportHtml = useCallback(async (): Promise<void> => {
    if (markdown === null) {
      onStatus(EXPORT_STATUS.noDocument);
      return;
    }
    try {
      const html = await exportStandaloneHtml(markdown, { theme, title: docTitle, pageSize });
      const saved = await saveDocumentCopy(html, htmlExportFileName(docTitle), HTML_EXPORT_FILTERS);
      onStatus(saved === null ? EXPORT_STATUS.cancelled : EXPORT_STATUS.saved(saved));
    } catch (error) {
      onStatus(EXPORT_STATUS.failed(error));
    }
  }, [docTitle, markdown, onStatus, pageSize, theme]);

  const printDocument = useCallback(async (): Promise<void> => {
    if (markdown === null) {
      onStatus(EXPORT_STATUS.noDocument);
      return;
    }
    try {
      const html = await exportStandaloneHtml(markdown, { theme, title: docTitle, pageSize });
      const target = await writeTemporaryExport(html, htmlExportFileName(docTitle));
      const opened = await openInBrowser(target);
      onStatus(
        opened === "opened"
          ? EXPORT_STATUS.printInBrowser(target)
          : EXPORT_STATUS.printRevealed(target),
      );
    } catch (error) {
      onStatus(EXPORT_STATUS.failed(error));
    }
  }, [docTitle, markdown, onStatus, pageSize, theme]);

  /** Convierte a Word/OpenDocument en el backend; nunca lanza. */
  const exportOffice = useCallback(
    async (format: OFFICE_FORMATS): Promise<void> => {
      if (markdown === null) {
        onStatus(EXPORT_STATUS.noDocument);
        return;
      }
      try {
        const saved = await exportOfficeDocument(markdown, docTitle, format);
        onStatus(saved === null ? EXPORT_STATUS.cancelled : EXPORT_STATUS.saved(saved));
      } catch (error) {
        onStatus(EXPORT_STATUS.failed(error));
      }
    },
    [docTitle, markdown, onStatus],
  );

  useImperativeHandle(ref, () => ({ exportHtml }), [exportHtml]);
  const disabled = markdown === null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={TRIGGER_CLASS} title="Descargar, exportar e imprimir">
        <DownloadIcon aria-hidden className="size-3.5" />
        <span>Exportar</span>
        <ChevronDownIcon aria-hidden className="size-2.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[287px] p-[7px]">
        <ExportItem
          icon={FileTextIcon}
          label="Descargar Markdown"
          description="Copia .md del documento original"
          disabled={disabled}
          onClick={() => void downloadMarkdown()}
        />
        <DropdownMenuSeparator className="my-1.5" />
        <ExportItem
          icon={CodeIcon}
          label="Exportar HTML"
          description="Archivo autónomo con estilos embebidos"
          shortcut={comboLabel("E")}
          disabled={disabled}
          onClick={() => void exportHtml()}
        />
        <ExportItem
          icon={PrinterIcon}
          label="Imprimir / Guardar PDF"
          description="Abre el diálogo de impresión del sistema"
          disabled={disabled}
          onClick={() => void printDocument()}
        />
        <DropdownMenuSeparator className="my-1.5" />
        <ExportItem
          icon={FileTypeIcon}
          label="Exportar a Word (.docx)"
          description="Documento de Word moderno"
          disabled={disabled}
          onClick={() => void exportOffice("docx")}
        />
        <ExportItem
          icon={FileType2Icon}
          label="Exportar a OpenDocument (.odt)"
          description="Para LibreOffice y OpenOffice"
          disabled={disabled}
          onClick={() => void exportOffice("odt")}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
});
