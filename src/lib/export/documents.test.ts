import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * El diálogo del sistema y el puente IPC se mockean: el contrato de la
 * exportación a Word/OpenDocument (nombre propuesto, filtro, formato y carga
 * HTML) se verifica en jsdom sin abrir ventanas ni ejecutar textutil.
 */
const dialog = vi.hoisted(() => ({ save: vi.fn() }));
const core = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("@tauri-apps/plugin-dialog", () => ({ save: dialog.save }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: core.invoke }));

import {
  OFFICE_FORMATS,
  exportOfficeDocument,
  officeExportFileName,
  officeHtml,
} from "./documents";

const DOCUMENT = [
  "# Título del documento",
  "",
  "Un párrafo con `código` y **negrita**.",
  "",
  "- uno",
  "- dos",
].join("\n");

afterEach(() => {
  vi.clearAllMocks();
  dialog.save.mockResolvedValue(null);
  core.invoke.mockResolvedValue("/Users/yo/guia.docx");
});

describe("officeHtml", () => {
  it("produce un documento mínimo con idioma, título y el cuerpo renderizado", () => {
    const html = officeHtml(DOCUMENT, "Guía <rápida>");

    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain('<html lang="es">');
    expect(html).toContain('<meta charset="utf-8">');
    expect(html).toContain("<title>Guía &lt;rápida&gt;</title>");
    expect(html).toContain("<h1>Título del documento</h1>");
    expect(html).toContain("<li>uno</li>");
    expect(html).toContain("<code>código</code>");
  });

  it("no arrastra la hoja de estilos ni scripts de la app", () => {
    const html = officeHtml(DOCUMENT, "guia.md");

    // textutil sólo entiende estructura: la estética Inkline no viaja al .docx.
    expect(html).not.toContain("<style");
    expect(html).not.toMatch(/<script\b/i);
    expect(html).not.toMatch(/<link\b/i);
  });

  it("exporta la fuente de un diagrama Mermaid en vez del aviso de espera", () => {
    const html = officeHtml(
      ["```mermaid", "flowchart LR", "  A --> B", "```"].join("\n"),
      "diagrama.md",
    );

    expect(html).not.toContain("Generando diagrama");
    expect(html).toContain("flowchart LR");
    // Sin hidratación no hay SVG: la fuente es lo único exportable.
    expect(html).toContain("<pre class=\"inkline-diagram__source\" data-inkline-diagram-source>");
  });
});

describe("officeExportFileName", () => {
  it("cambia la extensión del documento por la del formato", () => {
    expect(officeExportFileName("guia.md", "docx")).toBe("guia.docx");
    expect(officeExportFileName("guia.md", "odt")).toBe("guia.odt");
  });

  it("normaliza acentos y no deja componentes de ruta", () => {
    expect(officeExportFileName("Guía rápida.md", "docx")).toBe("guia-rapida.docx");
    expect(officeExportFileName("../../etc/passwd.md", "odt")).toBe("etc-passwd.odt");
  });

  it("cae al nombre por defecto cuando no hay título utilizable", () => {
    expect(officeExportFileName("", "docx")).toBe("documento.docx");
  });
});

describe("OFFICE_FORMATS", () => {
  it("declara los dos formatos que ofrece el menú", () => {
    expect([...OFFICE_FORMATS]).toEqual(["docx", "odt"]);
  });
});

describe("exportOfficeDocument", () => {
  it("pide la ruta con filtro de Word y convierte el HTML del documento", async () => {
    dialog.save.mockResolvedValue("/Users/yo/guia.docx");
    core.invoke.mockResolvedValue("/Users/yo/guia.docx");

    const saved = await exportOfficeDocument(DOCUMENT, "guia.md", "docx");

    expect(saved).toBe("/Users/yo/guia.docx");
    expect(dialog.save).toHaveBeenCalledWith({
      defaultPath: "guia.docx",
      filters: [{ name: "Word", extensions: ["docx"] }],
    });

    const [command, args] = core.invoke.mock.calls[0] as [string, Record<string, unknown>];
    expect(command).toBe("convert_to_office");
    expect(args.format).toBe("docx");
    expect(args.target).toBe("/Users/yo/guia.docx");
    expect(typeof args.html).toBe("string");
    expect(args.html as string).toContain("<h1>Título del documento</h1>");
  });

  it("pide la ruta con filtro de OpenDocument y formato odt", async () => {
    dialog.save.mockResolvedValue("/Users/yo/guia.odt");
    core.invoke.mockResolvedValue("/Users/yo/guia.odt");

    const saved = await exportOfficeDocument(DOCUMENT, "guia.md", "odt");

    expect(saved).toBe("/Users/yo/guia.odt");
    expect(dialog.save).toHaveBeenCalledWith({
      defaultPath: "guia.odt",
      filters: [{ name: "OpenDocument", extensions: ["odt"] }],
    });
    expect(core.invoke).toHaveBeenCalledWith(
      "convert_to_office",
      expect.objectContaining({ format: "odt", target: "/Users/yo/guia.odt" }),
    );
  });

  it("no convierte nada cuando se cancela el diálogo", async () => {
    dialog.save.mockResolvedValue(null);

    const saved = await exportOfficeDocument(DOCUMENT, "guia.md", "docx");

    expect(saved).toBeNull();
    expect(core.invoke).not.toHaveBeenCalled();
  });

  it("propaga el error del backend para que el menú lo cuente", async () => {
    dialog.save.mockResolvedValue("/Users/yo/guia.docx");
    core.invoke.mockRejectedValue(
      new Error("no se pudo convertir a docx: The folder doesn’t exist."),
    );

    await expect(exportOfficeDocument(DOCUMENT, "guia.md", "docx")).rejects.toThrow(
      "no se pudo convertir a docx",
    );
  });
});
