import { describe, expect, it } from "vitest";
import { exportStandaloneHtml, exportStylesheet } from "./html";

/**
 * Documento sin cercas: el pipeline real de `render.ts` no necesita cargar
 * Shiki, así que el test valida el cuerpo renderizado de verdad (tabla GFM,
 * código inline, énfasis) sin motores asíncronos.
 */
const DOCUMENT = [
  "# Título del documento",
  "",
  "Un párrafo con `código` y **negrita**.",
  "",
  "| Campo | Valor |",
  "| --- | --- |",
  "| alpha | 1 |",
  "",
  "```mermaid",
  "flowchart LR",
  "  A --> B",
  "```",
].join("\n");

describe("exportStandaloneHtml", () => {
  it("produce un documento autónomo con título y cursor de idioma", async () => {
    const html = await exportStandaloneHtml(DOCUMENT, {
      theme: "dark",
      title: "Guía <rápida>",
    });

    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain('<html lang="es">');
    expect(html).toContain('<meta charset="utf-8">');
    expect(html).toContain("<title>Guía &lt;rápida&gt;</title>");
    expect(html).toContain("<style>");
    expect(html).toContain("</style>");
  });

  it("incluye el cuerpo completo del pipeline de render", async () => {
    const html = await exportStandaloneHtml(DOCUMENT, {
      theme: "light",
      title: "guia.md",
    });

    expect(html).toContain('<article class="inkline-readable">');
    expect(html).toContain('<div class="inkline-table"');
    expect(html).toContain("<table>");
    expect(html).toContain("<code>código</code>");
    expect(html).toContain("<strong>negrita</strong>");
  });

  it("no depende de recursos de red ni de scripts", async () => {
    const html = await exportStandaloneHtml(DOCUMENT, {
      theme: "dark",
      title: "guia.md",
    });

    expect(html).not.toMatch(/<link\b/i);
    expect(html).not.toMatch(/<script\b/i);
    expect(html).not.toMatch(/(?:src|href)="https?:/i);
    expect(html).not.toContain("@import");
  });

  it("bakea la paleta del tema pedido y declara el esquema de color", async () => {
    const dark = await exportStandaloneHtml(DOCUMENT, { theme: "dark", title: "a.md" });
    const light = await exportStandaloneHtml(DOCUMENT, { theme: "light", title: "a.md" });

    expect(dark).toContain('<meta name="color-scheme" content="dark">');
    expect(dark).toContain("#d1ff65");
    expect(dark).not.toContain("#769f21");

    expect(light).toContain('<meta name="color-scheme" content="light">');
    expect(light).toContain("#769f21");
    expect(light).not.toContain("#d1ff65");
  });

  it("deja la fuente del diagrama Mermaid visible en lugar del placeholder", async () => {
    const html = await exportStandaloneHtml(DOCUMENT, { theme: "dark", title: "a.md" });

    expect(html).not.toContain("Generando diagrama…");
    expect(html).toContain('<figure class="inkline-diagram" data-inkline-diagram>');
    expect(html).toMatch(/<pre class="inkline-diagram__source"[^>]*>/);
    expect(html).not.toMatch(/data-inkline-diagram-source[^>]*\bhidden\b/);
    expect(html).toContain("flowchart LR");
  });
});

describe("exportStylesheet", () => {
  it("reproduce la tipografía de lectura de Inkline", () => {
    const css = exportStylesheet("dark");

    expect(css).toContain(".inkline-readable");
    expect(css).toContain("max-width: 770px");
    expect(css).toContain("line-height: 1.8");
    expect(css).toContain("overflow-wrap: anywhere");
    expect(css).toContain(".inkline-readable h1");
    expect(css).toContain(".inkline-readable h2");
    expect(css).toContain(".inkline-pre");
    expect(css).toContain(".inkline-lang");
    expect(css).toContain(".inkline-diagram");
  });

  it("bakea los valores de la paleta de cada tema", () => {
    const dark = exportStylesheet("dark");
    expect(dark).toContain("--bg: #0c0f10");
    expect(dark).toContain("--text: #e8eee9");
    expect(dark).toContain("--accent: #d1ff65");
    expect(dark).toContain("--code: #182020");
    expect(dark).toContain("color-scheme: dark");

    const light = exportStylesheet("light");
    expect(light).toContain("--bg: #f6f8f4");
    expect(light).toContain("--text: #263127");
    expect(light).toContain("--accent: #769f21");
    expect(light).toContain("--code: #f0f5ed");
    expect(light).toContain("color-scheme: light");
  });

  it("trae un bloque de impresión apto para A4", () => {
    const css = exportStylesheet("dark");

    expect(css).toContain("@media print");
    expect(css).toContain("@page");
    expect(css).toContain("size: A4");
    expect(css).toContain("margin: 18mm");
    expect(css).toContain("break-inside: avoid");
    expect(css).toContain("break-after: avoid");
  });

  it("no referencia hojas ni fuentes externas", () => {
    for (const theme of ["dark", "light"] as const) {
      const css = exportStylesheet(theme);
      expect(css).not.toContain("@import");
      expect(css).not.toMatch(/url\(\s*["']?https?:/i);
    }
  });
});
