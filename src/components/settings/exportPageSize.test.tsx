/**
 * El menú de exportación y la preferencia de tamaño de página (ODD T6 · S4).
 *
 * Aquí se comprueba el contrato de enchufe: `ExportMenu` recibe `pageSize` y lo
 * pasa a las dos salidas que generan HTML (exportar e imprimir). La hoja de
 * estilos real se cubre en `pageSize.test.ts`.
 */

import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ExportMenu } from "@/components/export/ExportMenu";

const html = vi.hoisted(() => ({
  exportStandaloneHtml: vi.fn(async () => "<html></html>"),
}));
const operations = vi.hoisted(() => ({
  saveDocumentCopy: vi.fn(async () => "/tmp/guia.html"),
  writeTemporaryExport: vi.fn(async () => "/tmp/guia.html"),
  openInBrowser: vi.fn(async () => "opened" as const),
  HTML_EXPORT_FILTERS: [{ name: "HTML", extensions: ["html"] }],
  MARKDOWN_EXPORT_FILTERS: [{ name: "Markdown", extensions: ["md"] }],
}));

vi.mock("@/lib/export/html", () => html);
vi.mock("@/lib/export/operations", () => operations);

beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("PointerEvent", class PointerEvent extends MouseEvent {});
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const props = {
  markdown: "# Guía",
  docTitle: "guia.md",
  theme: "dark" as const,
  onStatus: vi.fn(),
};

async function openMenu() {
  fireEvent.click(screen.getByRole("button", { name: /Exportar/ }));
  return screen.findByRole("menu");
}

describe("ExportMenu y el tamaño de página", () => {
  it("pasa la preferencia a la exportación HTML", async () => {
    render(<ExportMenu {...props} pageSize="letter" />);
    await openMenu();

    fireEvent.click(screen.getByText("Exportar HTML"));

    await waitFor(() =>
      expect(html.exportStandaloneHtml).toHaveBeenCalledWith("# Guía", {
        theme: "dark",
        title: "guia.md",
        pageSize: "letter",
      }),
    );
  });

  it("pasa la preferencia a la impresión y usa A4 cuando no se indica", async () => {
    render(<ExportMenu {...props} />);
    await openMenu();

    fireEvent.click(screen.getByText("Imprimir / Guardar PDF"));

    await waitFor(() => expect(operations.openInBrowser).toHaveBeenCalled());
    expect(html.exportStandaloneHtml).toHaveBeenCalledWith("# Guía", {
      theme: "dark",
      title: "guia.md",
      pageSize: "A4",
    });
  });
});
