import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MarkdownView } from "./MarkdownView";

const shiki = vi.hoisted(() => {
  const escapeHtml = (value: string) =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const codeToHtml = vi.fn(
    async (code: string, options: { lang: string; theme: string }) =>
      `<pre class="shiki ${options.theme}"><code class="language-${options.lang}">${escapeHtml(code)}</code></pre>`,
  );
  const loadLanguage = vi.fn(async () => {});
  const getLoadedLanguages = vi.fn((): string[] => []);
  return {
    codeToHtml,
    loadLanguage,
    getLoadedLanguages,
    createHighlighter: vi.fn(async () => ({ codeToHtml, loadLanguage, getLoadedLanguages })),
  };
});

const mermaid = vi.hoisted(() => {
  const render = vi.fn(async (id: string) => ({ svg: `<svg id="${id}"></svg>`, bindFunctions: vi.fn() }));
  return { render, initialize: vi.fn() };
});

vi.mock("shiki", () => ({ createHighlighter: shiki.createHighlighter }));
vi.mock("mermaid", () => ({ default: { render: mermaid.render, initialize: mermaid.initialize } }));

describe("MarkdownView", () => {
  it("muestra el documento en el contenedor de lectura", () => {
    const { container } = render(
      <MarkdownView markdown={"# Hola\n\nUn párrafo con `código` y **negrita**."} />,
    );

    const readable = container.querySelector(".inkline-readable");
    expect(readable).toBeInTheDocument();
    expect(readable).toHaveClass("inkline-readable");
    expect(screen.getByRole("heading", { level: 1, name: "Hola" })).toBeInTheDocument();
    expect(readable?.querySelector("p code")).toHaveTextContent("código");
    expect(readable?.querySelector("strong")).toHaveTextContent("negrita");
  });

  it("aplica el className adicional del consumidor", () => {
    const { container } = render(<MarkdownView markdown={"texto"} className="pane" />);
    expect(container.querySelector(".inkline-readable")?.classList.contains("pane")).toBe(true);
  });

  it("mejora las cercas con Shiki después del primer render", async () => {
    const { container } = render(<MarkdownView markdown={"```ts\nconst a = 1;\n```"} theme="light" />);

    // El contenido estático aparece de forma síncrona...
    expect(container.querySelector("figure.inkline-code")).toBeInTheDocument();

    // ...y Shiki lo enriquece de forma asíncrona.
    await waitFor(() => expect(container.querySelector("pre.shiki")).toBeInTheDocument());
    expect(shiki.codeToHtml).toHaveBeenCalledWith("const a = 1;\n", {
      lang: "ts",
      theme: "catppuccin-latte",
    });
  });

  it("hidrata los diagramas Mermaid del documento", async () => {
    const { container } = render(<MarkdownView markdown={"```mermaid\ngraph TD; A-->B\n```"} />);

    await waitFor(() =>
      expect(container.querySelector("[data-inkline-diagram-panel] svg")).toBeInTheDocument(),
    );
    expect(mermaid.render).toHaveBeenCalled();
  });

  it("no rompe el render con markdown vacío", () => {
    const { container } = render(<MarkdownView markdown="" />);
    expect(container.querySelector(".inkline-readable")).toBeInTheDocument();
    expect(container.querySelector(".inkline-readable")?.textContent).toBe("");
  });

  it("aplica el tamaño de lectura recibido como estilo inline", () => {
    const { container } = render(<MarkdownView markdown="# h" fontSize={15} />);

    const article = container.querySelector(".inkline-readable") as HTMLElement;
    expect(article.style.fontSize).toBe("15px");
  });

  it("sin tamaño explícito no escribe estilo inline", () => {
    const { container } = render(<MarkdownView markdown="# h" />);

    const article = container.querySelector(".inkline-readable") as HTMLElement;
    expect(article.getAttribute("style")).toBeNull();
  });
});
