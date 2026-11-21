/**
 * Tamaño de página del HTML exportado (ODD T6 · S4 «Exportación»).
 *
 * La preferencia vive en `lib/settings` y llega al `@page` del archivo
 * exportado. Aquí se prueba el extremo del pipeline con la implementación real
 * de `lib/export/html`; el menú de exportación se cubre en
 * `exportPageSize.test.tsx` con su módulo simulado.
 */

import { describe, expect, it } from "vitest";
import { exportStandaloneHtml, exportStylesheet } from "@/lib/export/html";

describe("exportStylesheet y el tamaño de página", () => {
  it("usa A4 por defecto", () => {
    const css = exportStylesheet("dark");

    expect(css).toContain("@page");
    expect(css).toContain("size: A4");
    expect(css).toContain("margin: 18mm");
  });

  it("respeta el tamaño de página elegido", () => {
    expect(exportStylesheet("dark", "A4")).toContain("size: A4");
    expect(exportStylesheet("light", "letter")).toContain("size: letter");
  });

  it("el HTML exportado lleva el tamaño de página a la impresión", async () => {
    const letter = await exportStandaloneHtml("# Guía", {
      theme: "light",
      title: "guia.md",
      pageSize: "letter",
    });

    expect(letter).toContain("size: letter");
    expect(letter).not.toContain("size: A4");

    const a4 = await exportStandaloneHtml("# Guía", { theme: "light", title: "guia.md" });

    expect(a4).toContain("size: A4");
  });
});
