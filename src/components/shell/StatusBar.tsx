/**
 * Barra de estado de Inkline (ODD T6 · S6).
 *
 * Es el `.bottom` del mockup: nombre del archivo activo, «Ln X, Col Y» cuando
 * el editor conoce el cursor, el mensaje de estado del shell, y a la derecha
 * «N palabras · M líneas», la marca «● Markdown» en el acento y «LOCAL». Las
 * cifras las calcula `lib/text`; aquí sólo se componen.
 */

import { comboLabel } from "@/lib/platform";

export interface StatusBarProps {
  /** Nombre del archivo activo; `null` cuando no hay documento abierto. */
  fileName: string | null;
  /** Línea 1-based del cursor (la escribe el editor en el `viewState`). */
  line?: number;
  /** Columna 1-based del cursor. */
  column?: number;
  words: number;
  lines: number;
  /** Último mensaje de estado del shell (guardado, exportación…). */
  status: string;
  /** Zoom del texto en porcentaje; se muestra sólo cuando no es 100. */
  zoom?: number;
}

/** Texto que ocupa el hueco del archivo cuando no hay documento. */
export const NO_DOCUMENT_LABEL = "Sin documento";

export function StatusBar({ fileName, line, column, words, lines, status, zoom }: StatusBarProps) {
  const hasPosition = line !== undefined && column !== undefined;

  return (
    <footer
      aria-label="Estado del documento"
      className="flex h-[31px] min-h-[31px] shrink-0 items-center gap-5 border-t border-border bg-ink-side px-[17px] font-mono text-[10px] text-muted-foreground"
    >
      <span data-slot="file" className="max-w-[220px] truncate" title={fileName ?? undefined}>
        {fileName ?? NO_DOCUMENT_LABEL}
      </span>
      {hasPosition ? (
        <span data-slot="position" className="shrink-0">
          Ln {line}, Col {column}
        </span>
      ) : null}
      {status ? (
        <span data-slot="status" role="status" className="truncate text-ink-faint" title={status}>
          {status}
        </span>
      ) : null}
      <span className="flex-1" />
      <span data-slot="stats" className="shrink-0">
        {words} palabras · {lines} líneas
      </span>
      {zoom !== undefined && zoom !== 100 ? (
        <span
          data-slot="zoom"
          className="shrink-0"
          title={`Zoom de texto (${comboLabel("+")} / ${comboLabel("−")} / ${comboLabel("0")})`}
        >
          {zoom}%
        </span>
      ) : null}
      <span className="flex shrink-0 items-center gap-1.5">
        <span aria-hidden className="text-primary">
          ●
        </span>
        <span>Markdown</span>
      </span>
      <span className="shrink-0">LOCAL</span>
    </footer>
  );
}
