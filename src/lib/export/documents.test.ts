import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * El diálogo del sistema y el puente IPC se mockean: el contrato de la
 * exportación a Word/OpenDocument (nombre propuesto, filtro, formato y modelo
 * estructural `OfficeDoc`) se verifica en jsdom; la generación real de los
 * paquetes `.docx` y `.odt` se prueba en `src-tauri/src/export/mod.rs`.
 */
const dialog = vi.hoisted(() => ({ save: vi.fn() }));
const core = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("@tauri-apps/plugin-dialog", () => ({ save: dialog.save }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: core.invoke }));

import {
  OFFICE_FORMATS,
  exportOfficeDocument,
  markdownToOfficeDoc,
  officeExportFileName,
  type OfficeDoc,
} from "./documents";

const DOCUMENT = [
  "# Título del documento",
  "",
  "Un párrafo con `código`, **negrita**, *cursiva*, ~~tachado~~ y [enlace](https://inkline.dev).",
  "",
  "- uno",
  "- dos",
].join("\n");

afterEach(() => {
  vi.clearAllMocks();
  dialog.save.mockResolvedValue(null);
  core.invoke.mockResolvedValue("/Users/yo/guia.docx");
});

describe("markdownToOfficeDoc", () => {
  it("convierte encabezados, formato en línea y listas al modelo estructural", () => {
    const doc = markdownToOfficeDoc(DOCUMENT, "Guía rápida");

    expect(doc.title).toBe("Guía rápida");
    expect(doc.blocks).toHaveLength(3);
    expect(doc.blocks[0]).toEqual({
      kind: "heading",
      level: 1,
      runs: [{ kind: "text", text: "Título del documento" }],
    });
    expect(doc.blocks[1]).toEqual({
      kind: "paragraph",
      runs: [
        { kind: "text", text: "Un párrafo con " },
        { kind: "text", text: "código", code: true },
        { kind: "text", text: ", " },
        { kind: "text", text: "negrita", bold: true },
        { kind: "text", text: ", " },
        { kind: "text", text: "cursiva", italic: true },
        { kind: "text", text: ", " },
        { kind: "text", text: "tachado", strike: true },
        { kind: "text", text: " y " },
        { kind: "text", text: "enlace", href: "https://inkline.dev" },
        { kind: "text", text: "." },
      ],
    });
    expect(doc.blocks[2]).toEqual({
      kind: "list",
      ordered: false,
      items: [
        { blocks: [{ kind: "paragraph", runs: [{ kind: "text", text: "uno" }] }] },
        { blocks: [{ kind: "paragraph", runs: [{ kind: "text", text: "dos" }] }] },
      ],
    });
  });

  it("extrae listas de tareas, listas ordenadas con inicio, citas, código, tablas y separadores", () => {
    const md = [
      "- [x] Hecho",
      "- [ ] Pendiente",
      "",
      "3. Tercero",
      "",
      "> Cita",
      "",
      "```mermaid",
      "flowchart LR",
      "  A --> B",
      "```",
      "",
      "| Columna | Valor |",
      "| :--- | ---: |",
      "| A | 1 |",
      "",
      "---",
    ].join("\n");

    const doc = markdownToOfficeDoc(md, "completo.md");

    expect(doc.blocks).toEqual([
      {
        kind: "list",
        ordered: false,
        items: [
          { checked: true, blocks: [{ kind: "paragraph", runs: [{ kind: "text", text: "Hecho" }] }] },
          {
            checked: false,
            blocks: [{ kind: "paragraph", runs: [{ kind: "text", text: "Pendiente" }] }],
          },
        ],
      },
      {
        kind: "list",
        ordered: true,
        start: 3,
        items: [{ blocks: [{ kind: "paragraph", runs: [{ kind: "text", text: "Tercero" }] }] }],
      },
      {
        kind: "blockquote",
        blocks: [{ kind: "paragraph", runs: [{ kind: "text", text: "Cita" }] }],
      },
      {
        kind: "codeBlock",
        language: "mermaid",
        code: "flowchart LR\n  A --> B\n",
      },
      {
        kind: "table",
        headers: [
          { align: "left", runs: [{ kind: "text", text: "Columna" }] },
          { align: "right", runs: [{ kind: "text", text: "Valor" }] },
        ],
        rows: [
          [
            { align: "left", runs: [{ kind: "text", text: "A" }] },
            { align: "right", runs: [{ kind: "text", text: "1" }] },
          ],
        ],
      },
      { kind: "thematicBreak" },
    ]);
  });

  it("conserva el HTML crudo como texto literal y degrada imágenes a su texto alternativo", () => {
    const doc = markdownToOfficeDoc("<script>alert(1)</script> ![Logo](logo.png)", "seguro.md");

    expect(doc.blocks).toEqual([
      {
        kind: "paragraph",
        runs: [
          { kind: "text", text: "<script>alert(1)</script> " },
          { kind: "text", text: "[Imagen: Logo]", italic: true },
        ],
      },
    ]);
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
  it("pide la ruta con filtro de Word y envía el modelo OfficeDoc al backend", async () => {
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
    const doc = args.doc as OfficeDoc;
    expect(doc.title).toBe("guia.md");
    expect(doc.blocks[0]).toEqual({
      kind: "heading",
      level: 1,
      runs: [{ kind: "text", text: "Título del documento" }],
    });
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
