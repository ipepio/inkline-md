/**
 * Modo demo web (ODD «landing bilingüe con demo embebida», S6).
 *
 * La landing sirve el build de Vite dentro de un iframe, sin el runtime de
 * Tauri. Sin puente nativo `invoke` no existe, así que la app no puede pedir el
 * espacio de trabajo al backend. En lugar de arrancar vacía y con un error en
 * la barra de estado, la demo abre un documento de ejemplo editable.
 *
 * Se activa sólo con una compilación explícita (`VITE_DEMO=1`) y sin puente
 * nativo: ni el WebView de la app, ni `pnpm dev`, ni los tests cambian de
 * comportamiento.
 */

/** Ruta ficticia del documento de ejemplo; no existe en disco. */
export const DEMO_DOC_PATH = "demo/README.md";

/** Aviso para las acciones que necesitan el backend de escritorio. */
export const DEMO_NOTICE =
  "Modo demo: abrir, guardar y exportar archivos requiere la app de escritorio.";

/** ¿Corre este build como demo web, sin backend nativo? */
export function isDemoMode(): boolean {
  if (import.meta.env.VITE_DEMO !== "1") return false;
  return !hasNativeBridge();
}

function hasNativeBridge(): boolean {
  const internals = (globalThis as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  return typeof internals !== "undefined";
}

/** Markdown del documento de ejemplo (se importa sólo en modo demo). */
export async function loadDemoDocument(): Promise<string> {
  const module = await import("./sample.md?raw");
  return module.default;
}
