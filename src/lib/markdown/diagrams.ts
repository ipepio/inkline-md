/**
 * Post-proceso de diagramas Mermaid para el modo visualización (ODD T2 / S4).
 *
 * Contrato con `render.ts`: cada ```mermaid se emite como
 *
 *   <figure data-inkline-diagram>
 *     <div data-inkline-diagram-panel>placeholder</div>
 *     <figcaption data-inkline-diagram-caption>Mermaid</figcaption>
 *     <pre data-inkline-diagram-source hidden><code>…fuente escapada…</code></pre>
 *   </figure>
 *
 * `hydrateDiagrams(root, { theme, signal })` busca esos elementos, renderiza el
 * SVG con `mermaid.render` y lo inyecta en el panel. Nunca lanza: si Mermaid
 * falla, oculta el panel y muestra la fuente en su lugar.
 */

import type { ThemeMode } from "./render";

export interface HydrateDiagramsOptions {
  /** Tema Inkline activo; Mermaid se reinicializa cuando cambia. */
  theme: ThemeMode;
  /** Permite cancelar el trabajo pendiente al desmontar el componente. */
  signal?: AbortSignal;
}

type MermaidApi = typeof import("mermaid")["default"];

const PENDING_LABEL = "Generando diagrama…";
const DIAGRAM_LABEL = "Mermaid";
const FAILED_LABEL = "Mermaid · no se pudo renderizar";

let mermaidModule: Promise<MermaidApi> | null = null;
let initializedTheme: ThemeMode | null = null;
let renderToken = 0;

async function loadMermaid(theme: ThemeMode): Promise<MermaidApi> {
  mermaidModule ??= import("mermaid").then((module) => module.default);

  const mermaid = await mermaidModule;
  if (initializedTheme !== theme) {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: theme === "dark" ? "dark" : "default",
    });
    initializedTheme = theme;
  }

  return mermaid;
}

function resetPanel(panel: HTMLElement | null): void {
  if (!panel) return;
  panel.hidden = false;
  if (panel.querySelector("svg")) {
    panel.replaceChildren();
  }
  if (!panel.querySelector(".inkline-diagram__pending")) {
    const pending = document.createElement("span");
    pending.className = "inkline-diagram__pending";
    pending.textContent = PENDING_LABEL;
    panel.append(pending);
  }
}

/** Elimina los nodos temporales que Mermaid deja en el documento al fallar. */
function cleanupMermaidArtifacts(id: string): void {
  document.getElementById(id)?.remove();
  document.getElementById(`d${id}`)?.remove();
}

/**
 * Convierte el markup de Mermaid en un nodo vivo sin usar `innerHTML`.
 * El documento se parsea como HTML inerte (DOMParser no ejecuta scripts) y el
 * `<svg>` se importa al documento actual; el markup proviene del propio
 * renderizador de Mermaid con `securityLevel: "strict"`, que escapa el texto
 * del documento antes de generar el diagrama.
 */
function parseSvg(markup: string): SVGSVGElement | null {
  const parsed = new DOMParser().parseFromString(markup, "text/html");
  const svg = parsed.body.querySelector("svg");
  if (!svg) return null;
  return document.importNode(svg, true);
}

function markFailed(
  figure: HTMLElement,
  panel: HTMLElement | null,
  sourceBlock: HTMLElement | null,
  caption: HTMLElement | null,
): void {
  figure.dataset.inklineDiagramState = "error";
  if (panel) panel.hidden = true;
  if (sourceBlock) sourceBlock.removeAttribute("hidden");
  if (caption) caption.textContent = FAILED_LABEL;
}

async function renderDiagram(
  figure: HTMLElement,
  source: string,
  options: HydrateDiagramsOptions,
): Promise<void> {
  const theme = options.theme;
  const panel = figure.querySelector<HTMLElement>("[data-inkline-diagram-panel]");
  const sourceBlock = figure.querySelector<HTMLElement>("[data-inkline-diagram-source]");
  const caption = figure.querySelector<HTMLElement>("[data-inkline-diagram-caption]");

  const token = String(++renderToken);
  figure.dataset.inklineDiagramToken = token;
  figure.dataset.inklineDiagramTheme = theme;
  figure.dataset.inklineDiagramState = "rendering";
  resetPanel(panel);

  if (!source.trim()) {
    markFailed(figure, panel, sourceBlock, caption);
    return;
  }

  const id = `inkline-mermaid-${token}`;

  try {
    const mermaid = await loadMermaid(theme);
    const result = await mermaid.render(id, source);

    // Otro render (o un desmontaje) tomó el control mientras esperábamos.
    if (options.signal?.aborted || figure.dataset.inklineDiagramToken !== token) return;
    if (!panel) return;

    const svg = parseSvg(result.svg);
    if (!svg) {
      markFailed(figure, panel, sourceBlock, caption);
      return;
    }

    panel.replaceChildren(svg);
    result.bindFunctions?.(svg);
    figure.dataset.inklineDiagramState = "ready";
    if (sourceBlock) sourceBlock.setAttribute("hidden", "");
    if (caption) caption.textContent = DIAGRAM_LABEL;
  } catch {
    if (options.signal?.aborted || figure.dataset.inklineDiagramToken !== token) return;
    cleanupMermaidArtifacts(id);
    markFailed(figure, panel, sourceBlock, caption);
  }
}

/**
 * Renderiza todos los diagramas del subárbol. Idempotente para el mismo tema.
 */
export async function hydrateDiagrams(
  root: ParentNode,
  options: HydrateDiagramsOptions,
): Promise<void> {
  const figures = Array.from(root.querySelectorAll<HTMLElement>("[data-inkline-diagram]"));

  for (const figure of figures) {
    if (options.signal?.aborted) return;

    const sameTheme = figure.dataset.inklineDiagramTheme === options.theme;
    const settled =
      figure.dataset.inklineDiagramState === "ready" ||
      figure.dataset.inklineDiagramState === "error";
    if (sameTheme && settled) continue;

    const source =
      figure.querySelector("[data-inkline-diagram-source] code")?.textContent ??
      figure.querySelector("[data-inkline-diagram-source]")?.textContent ??
      "";

    await renderDiagram(figure, source, options);
  }
}
