/**
 * Reparto del divisor de la vista dividida (ODD editor groups · T1).
 *
 * `viewState` es un objeto plano compartido por todas las vistas de un
 * documento, así que el reparto recordado se lee con un guardián: cualquier
 * valor que no sea un par de números finitos se descarta y el editor usa su
 * reparto por defecto.
 */

export interface SplitLayout {
  editor: number;
  preview: number;
}

export function readSplitLayout(
  viewState: Record<string, unknown> | undefined,
): SplitLayout | undefined {
  const raw = viewState?.splitLayout as { editor?: unknown; preview?: unknown } | undefined;
  if (!raw || typeof raw.editor !== "number" || typeof raw.preview !== "number") {
    return undefined;
  }
  if (!Number.isFinite(raw.editor) || !Number.isFinite(raw.preview)) return undefined;
  return { editor: raw.editor, preview: raw.preview };
}
