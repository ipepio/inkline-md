/**
 * Exportación e impresión del shell (ODD editor groups · T1).
 *
 * El menú de exportación expone un handle imperativo (⌘E) y la ventana de
 * preferencias pide imprimir/guardar PDF del documento activo: se escribe el
 * HTML autónomo en un temporal y se abre en el navegador del sistema.
 *
 * `handlePrintFromSettings` es costura estable: la rama hermana
 * `feat/web-demo-mode` añade ahí su guarda de modo demo.
 */

import { useCallback, useRef, type RefObject } from "react";
import type { ExportMenuHandle } from "@/components/export/ExportMenu";
import type { Theme } from "@/hooks/useTheme";
import type { OpenDocument } from "@/lib/documents";
import { exportStandaloneHtml } from "@/lib/export/html";
import { htmlExportFileName } from "@/lib/export/names";
import { openInBrowser, writeTemporaryExport } from "@/lib/export/operations";
import type { PageSize } from "@/lib/settings";
import { displayName } from "./untitled";

export interface ExportActionsOptions {
  /** Documento activo: es el que se exporta o imprime. */
  active: OpenDocument | null;
  theme: Theme;
  pageSize: PageSize;
  setStatus: (status: string) => void;
}

export interface ExportActionsResult {
  exportRef: RefObject<ExportMenuHandle>;
  handlePrintFromSettings: () => Promise<void>;
}

export function useExportActions({
  active,
  theme,
  pageSize,
  setStatus,
}: ExportActionsOptions): ExportActionsResult {
  const exportRef = useRef<ExportMenuHandle>(null);

  const handlePrintFromSettings = useCallback(async (): Promise<void> => {
    if (!active) {
      setStatus("No hay ningún documento que exportar");
      return;
    }
    try {
      const title = displayName(active.path);
      const html = await exportStandaloneHtml(active.contents, {
        theme,
        title,
        pageSize,
      });
      const target = await writeTemporaryExport(html, htmlExportFileName(title));
      const opened = await openInBrowser(target);
      setStatus(
        opened === "opened"
          ? `Impresión: el documento se abrió en tu navegador (${target}).`
          : `Documento listo para imprimir: ${target}.`,
      );
    } catch (err) {
      setStatus(`Error al exportar: ${String(err)}`);
    }
  }, [active, theme, pageSize, setStatus]);

  return { exportRef, handlePrintFromSettings };
}
