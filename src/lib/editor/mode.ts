/**
 * Vistas del área principal de Inkline (ODD T3 / S2 · S6).
 *
 * El mockup refina el «modo visualización y edición con vista previa» de S2 en
 * tres disposiciones exclusivas. Vive en `lib` para que la barra de formato, el
 * control segmentado y el espacio de trabajo compartan un único tipo.
 */

export type WorkspaceMode = "editor" | "split" | "preview";

/** Las tres vistas, en el orden del control segmentado del mockup. */
export const WORKSPACE_MODES: readonly WorkspaceMode[] = ["editor", "split", "preview"];

export function isWorkspaceMode(value: unknown): value is WorkspaceMode {
  return value === "editor" || value === "split" || value === "preview";
}
