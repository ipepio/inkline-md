import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToHtml, renderToHtmlSync } from "./render";

/**
 * Shiki se mockea en los tests: el pipeline no debe depender de oniguruma/wasm
 * para validar estructura. El resaltado real se prueba a mano en la app.
 */
const shiki = vi.hoisted(() => {
  const escape = (value: string) =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const codeToHtml = vi.fn(
    async (code: string, options: { lang: string; theme: string }) =>
      `<pre class="shiki ${options.theme}" style="background-color:#111111;color:#eeeeee" tabindex="0"><code class="language-${options.lang}">${escape(code)}</code></pre>`,
  );
  const loadLanguage = vi.fn(async (lang: string) => {
    if (lang === "nope") throw new Error(`Language \`${lang}\` is not included in this bundle`);
  });
  const getLoadedLanguages = vi.fn((): string[] => []);
  const createHighlighter = vi.fn(async () => ({
    codeToHtml,
    loadLanguage,
    getLoadedLanguages,
  }));
  return { codeToHtml, loadLanguage, getLoadedLanguages, createHighlighter };
});

vi.mock("shiki", () => ({ createHighlighter: shiki.createHighlighter }));

/**
 * Contenedor de parseo para inspeccionar el HTML con selectores reales.
 * DOMParser no ejecuta scripts y los nodos se importan al documento del test
 * para que los matchers de jest-dom vean elementos del mismo realm.
 */
const containers: HTMLElement[] = [];

function dom(html: string): HTMLElement {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  const container = document.createElement("div");
  container.replaceChildren(
    ...Array.from(parsed.body.childNodes, (node) => document.importNode(node, true)),
  );
  document.body.append(container);
  containers.push(container);
  return container;
}

afterEach(() => {
  for (const container of containers.splice(0)) container.remove();
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("renderToHtmlSync — bloques GFM", () => {
  it("convierte una tabla GFM en table con thead y tbody desplazables", () => {
    const html = renderToHtmlSync("| a | b |\n| - | - |\n| 1 | 2 |");
    const root = dom(html);

    const wrapper = root.querySelector("div.inkline-table");
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).toHaveAttribute("role", "region");
    expect(wrapper).toHaveAttribute("tabindex", "0");
    expect(wrapper).toHaveAttribute("aria-label", "Tabla desplazable");

    const table = wrapper?.querySelector("table");
    expect(table).toBeInTheDocument();
    expect(table?.querySelector("thead th")?.textContent).toBe("a");
    expect(table?.querySelector("tbody td")?.textContent).toBe("1");
  });

  it("convierte ~~texto~~ en <del>", () => {
    const root = dom(renderToHtmlSync("un ~~tachado~~ aquí"));
    expect(root.querySelector("del")?.textContent).toBe("tachado");
  });

  it("convierte una task list en checkbox deshabilitado con el estilo de tarea", () => {
    const root = dom(renderToHtmlSync("- [x] hecha\n- [ ] pendiente"));
    const items = root.querySelectorAll("li.task-list-item");
    expect(items).toHaveLength(2);

    const checkbox = items[0]?.querySelector('input[type="checkbox"]');
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).toHaveAttribute("disabled");
    expect((checkbox as HTMLInputElement).checked).toBe(true);
  });

  it("respeta los niveles de encabezado h1, h2 y h3", () => {
    const root = dom(renderToHtmlSync("# Uno\n\n## Dos\n\n### Tres"));
    expect(root.querySelector("h1")?.textContent).toBe("Uno");
    expect(root.querySelector("h2")?.textContent).toBe("Dos");
    expect(root.querySelector("h3")?.textContent).toBe("Tres");
  });

  it("convierte el código inline en <code>", () => {
    const root = dom(renderToHtmlSync("usa `pnpm test` para verificar"));
    const code = root.querySelector("p > code");
    expect(code?.textContent).toBe("pnpm test");
    expect(root.querySelector("pre")).toBeNull();
  });

  it("mantiene el HTML crudo como texto: <script> nunca se ejecuta", () => {
    const html = renderToHtmlSync('<script>alert("xss")</script>\n\nok');
    const root = dom(html);

    expect(html).toContain("&lt;script&gt;");
    expect(root.querySelector("script")).toBeNull();
    expect(root.textContent).toContain('<script>alert("xss")</script>');
  });

  it("añade target y rel a los enlaces externos y los deja intactos en los internos", () => {
    const root = dom(renderToHtmlSync("[externo](https://example.com) y [interno](#seccion)"));

    const [external, internal] = Array.from(root.querySelectorAll("a"));
    expect(external).toHaveAttribute("href", "https://example.com");
    expect(external).toHaveAttribute("target", "_blank");
    expect(external).toHaveAttribute("rel", "noopener noreferrer");

    expect(internal).toHaveAttribute("href", "#seccion");
    expect(internal).not.toHaveAttribute("target");
  });
});

describe("renderToHtmlSync — cercas de código", () => {
  it("envuelve el código con badge de lenguaje en mayúsculas", () => {
    const root = dom(renderToHtmlSync("```ts\nconst a = 1;\n```"));

    const figure = root.querySelector("figure.inkline-code");
    expect(figure).toBeInTheDocument();
    expect(figure?.querySelector("figcaption.inkline-lang")?.textContent).toBe("TS");

    const pre = figure?.querySelector("pre.inkline-pre");
    expect(pre?.querySelector("code")?.textContent).toBe("const a = 1;\n");
    // El HTML del fence nunca se inserta crudo.
    expect(root.querySelector("script")).toBeNull();
  });

  it("no muestra badge cuando la cerca no declara lenguaje", () => {
    const root = dom(renderToHtmlSync("```\nsin lenguaje\n```"));

    const figure = root.querySelector("figure.inkline-code");
    expect(figure?.querySelector("figcaption.inkline-lang")).toBeNull();
    expect(figure?.querySelector("pre.inkline-pre code")?.textContent).toBe("sin lenguaje\n");
  });

  it("envuelve el bloque de código indentado igual que una cerca", () => {
    const root = dom(renderToHtmlSync("    sangrado\n"));
    expect(root.querySelector("figure.inkline-code pre.inkline-pre code")).toBeInTheDocument();
  });
});

describe("renderToHtmlSync — diagramas Mermaid", () => {
  it("trata ```mermaid como panel de diagrama, no como código resaltado", () => {
    const root = dom(renderToHtmlSync("```mermaid\ngraph TD; A-->B\n```"));

    const figure = root.querySelector("figure[data-inkline-diagram]");
    expect(figure).toBeInTheDocument();
    expect(figure?.querySelector("[data-inkline-diagram-panel]")?.textContent).toMatch(
      /Generando diagrama/,
    );
    expect(figure?.querySelector("[data-inkline-diagram-caption]")?.textContent).toBe("Mermaid");

    const source = figure?.querySelector("[data-inkline-diagram-source]");
    expect(source).toHaveAttribute("hidden");
    expect(source?.querySelector("code")?.textContent).toBe("graph TD; A-->B\n");

    // Nunca se resalta como código ni se muestra badge de lenguaje.
    expect(root.querySelector("pre.shiki")).toBeNull();
    expect(root.querySelector(".inkline-lang")).toBeNull();
  });

  it("muestra el placeholder de Mermaid también en el primer render", () => {
    const root = dom(renderToHtmlSync("antes\n\n```mermaid\nflowchart LR\n```\n\ndespués"));
    expect(root.querySelectorAll("figure[data-inkline-diagram]")).toHaveLength(1);
    expect(root.querySelector("p")?.textContent).toBe("antes");
  });
});

describe("renderToHtml — resaltado asíncrono con Shiki", () => {
  it("resalta la cerca con Shiki y elimina el fondo inline del tema", async () => {
    const html = await renderToHtml("```ts\nconst a = 1;\n```", { theme: "dark" });
    const root = dom(html);

    expect(shiki.codeToHtml).toHaveBeenCalledWith("const a = 1;\n", {
      lang: "ts",
      theme: "catppuccin-mocha",
    });

    const pre = root.querySelector("figure.inkline-code pre.shiki");
    expect(pre).toHaveClass("inkline-pre");
    expect(pre?.querySelector("code")?.textContent).toBe("const a = 1;\n");
    // El color de fondo lo define Inkline (--ink-code), no el tema de Shiki.
    expect(html).not.toContain("background-color");
    // El badge se conserva encima del bloque resaltado.
    expect(root.querySelector("figure.inkline-code figcaption.inkline-lang")?.textContent).toBe("TS");
  });

  it("usa el par de temas claro cuando se pide el tema light", async () => {
    await renderToHtml("```ts\nconst a = 1;\n```", { theme: "light" });
    expect(shiki.codeToHtml).toHaveBeenCalledWith("const a = 1;\n", {
      lang: "ts",
      theme: "catppuccin-latte",
    });
  });

  it("degrada a código escapado cuando Shiki no soporta el lenguaje", async () => {
    const html = await renderToHtml("```nope\n<no & vale>\n```", { theme: "dark" });
    const root = dom(html);

    expect(root.querySelector("pre.shiki")).toBeNull();
    const pre = root.querySelector("figure.inkline-code pre.inkline-pre");
    expect(pre?.querySelector("code")?.textContent).toBe("<no & vale>\n");
    expect(root.querySelector("script")).toBeNull();
  });

  it("no resalta los bloques mermaid ni rompe el render sin cercas", async () => {
    const withDiagram = await renderToHtml("```mermaid\ngraph TD; A-->B\n```", { theme: "dark" });
    expect(shiki.codeToHtml).not.toHaveBeenCalled();
    expect(dom(withDiagram).querySelector("figure[data-inkline-diagram]")).toBeInTheDocument();

    const plain = await renderToHtml("solo texto", { theme: "dark" });
    expect(plain).toContain("<p>solo texto</p>");
  });
});
