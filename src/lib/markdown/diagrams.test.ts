import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hydrateDiagrams } from "./diagrams";

/**
 * Mermaid se mockea siempre: los tests nunca cargan el bundle real ni
 * necesitan un layout de SVG.
 */
const mermaid = vi.hoisted(() => {
  const render = vi.fn(async (id: string, code: string) => ({
    svg: `<svg id="${id}" data-source="${code.trim()}"></svg>`,
    bindFunctions: vi.fn(),
  }));
  const initialize = vi.fn();
  return { render, initialize };
});

vi.mock("mermaid", () => ({ default: { render: mermaid.render, initialize: mermaid.initialize } }));

/** Fixture alineado con el contrato de placeholder de `render.ts`. */
function diagramFigure(source: string): HTMLElement {
  const root = document.createElement("div");
  const figure = document.createElement("figure");
  figure.setAttribute("data-inkline-diagram", "");

  const panel = document.createElement("div");
  panel.setAttribute("data-inkline-diagram-panel", "");
  const pending = document.createElement("span");
  pending.className = "inkline-diagram__pending";
  pending.textContent = "Generando diagrama…";
  panel.append(pending);

  const caption = document.createElement("figcaption");
  caption.setAttribute("data-inkline-diagram-caption", "");
  caption.textContent = "Mermaid";

  const pre = document.createElement("pre");
  pre.setAttribute("data-inkline-diagram-source", "");
  pre.hidden = true;
  const code = document.createElement("code");
  code.className = "language-mermaid";
  code.textContent = source;
  pre.append(code);

  figure.append(panel, caption, pre);
  root.append(figure);
  document.body.append(root);
  roots.push(root);
  return root;
}

const roots: HTMLElement[] = [];

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  for (const root of roots.splice(0)) root.remove();
});

describe("hydrateDiagrams", () => {
  it("inyecta el SVG en el panel y marca el diagrama como listo", async () => {
    const root = diagramFigure("graph TD; A-->B");

    await hydrateDiagrams(root, { theme: "dark" });

    const figure = root.querySelector("[data-inkline-diagram]") as HTMLElement;
    expect(mermaid.render).toHaveBeenCalledTimes(1);
    expect(mermaid.render.mock.calls[0][1]).toBe("graph TD; A-->B");
    expect(figure.dataset.inklineDiagramState).toBe("ready");
    expect(figure.querySelector("[data-inkline-diagram-panel] svg")).toBeInTheDocument();
    expect(figure.querySelector(".inkline-diagram__pending")).toBeNull();
    expect(figure.querySelector("[data-inkline-diagram-source]")).toHaveAttribute("hidden");
  });

  it("degrada al código fuente cuando Mermaid falla, sin lanzar", async () => {
    mermaid.render.mockRejectedValueOnce(new Error("boom"));
    const root = diagramFigure("graph TD; roto");

    await expect(hydrateDiagrams(root, { theme: "dark" })).resolves.toBeUndefined();

    const figure = root.querySelector("[data-inkline-diagram]") as HTMLElement;
    expect(figure.dataset.inklineDiagramState).toBe("error");
    expect(figure.querySelector("[data-inkline-diagram-source]")).not.toHaveAttribute("hidden");
    expect(figure.querySelector("[data-inkline-diagram-source] code")?.textContent).toBe(
      "graph TD; roto",
    );
    expect(figure.querySelector("[data-inkline-diagram-caption]")?.textContent).toContain(
      "no se pudo renderizar",
    );
  });

  it("vuelve a renderizar cuando cambia el tema", async () => {
    const root = diagramFigure("graph TD; A-->B");

    await hydrateDiagrams(root, { theme: "dark" });
    await hydrateDiagrams(root, { theme: "light" });

    expect(mermaid.render).toHaveBeenCalledTimes(2);
    expect(mermaid.initialize).toHaveBeenLastCalledWith(
      expect.objectContaining({ theme: "default" }),
    );
    const figure = root.querySelector("[data-inkline-diagram]") as HTMLElement;
    expect(figure.dataset.inklineDiagramTheme).toBe("light");
  });

  it("no re-renderiza un diagrama ya listo en el mismo tema", async () => {
    const root = diagramFigure("graph TD; A-->B");

    await hydrateDiagrams(root, { theme: "dark" });
    await hydrateDiagrams(root, { theme: "dark" });

    expect(mermaid.render).toHaveBeenCalledTimes(1);
  });

  it("ignora un diagrama con fuente vacía en lugar de romper el panel", async () => {
    const root = diagramFigure("   ");

    await hydrateDiagrams(root, { theme: "dark" });

    expect(mermaid.render).not.toHaveBeenCalled();
    const figure = root.querySelector("[data-inkline-diagram]") as HTMLElement;
    expect(figure.dataset.inklineDiagramState).toBe("error");
  });

  it("respeta la señal de aborto antes de escribir en el DOM", async () => {
    const root = diagramFigure("graph TD; A-->B");
    const controller = new AbortController();

    const pending = hydrateDiagrams(root, { theme: "dark", signal: controller.signal });
    controller.abort();
    await pending;

    const figure = root.querySelector("[data-inkline-diagram]") as HTMLElement;
    expect(figure.querySelector("[data-inkline-diagram-panel] svg")).toBeNull();
  });
});
