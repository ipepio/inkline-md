import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { OpenDocument } from "@/lib/documents";
import { exportStandaloneHtml } from "@/lib/export/html";
import { htmlExportFileName } from "@/lib/export/names";
import { openInBrowser, writeTemporaryExport } from "@/lib/export/operations";
import { useExportActions } from "./useExportActions";

vi.mock("@/lib/export/html", () => ({ exportStandaloneHtml: vi.fn() }));
vi.mock("@/lib/export/names", () => ({ htmlExportFileName: vi.fn() }));
vi.mock("@/lib/export/operations", () => ({
  writeTemporaryExport: vi.fn(),
  openInBrowser: vi.fn(),
}));

const active: OpenDocument = {
  id: "doc-1",
  path: "/notas/diario.md",
  name: "diario.md",
  contents: "# diario",
  dirty: true,
  viewState: {},
};

function setup(document: OpenDocument | null) {
  const setStatus = vi.fn();
  const hook = renderHook(() =>
    useExportActions({ active: document, theme: "dark", pageSize: "A4", setStatus }),
  );
  return { ...hook, setStatus };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(exportStandaloneHtml).mockResolvedValue("<html></html>");
  vi.mocked(htmlExportFileName).mockReturnValue("diario-md.html");
  vi.mocked(writeTemporaryExport).mockResolvedValue("/tmp/diario-md.html");
  vi.mocked(openInBrowser).mockResolvedValue("opened");
});

describe("useExportActions", () => {
  it("expone la referencia del menú de exportación", () => {
    const { result } = setup(active);

    expect(result.current.exportRef.current).toBeNull();
  });

  it("avisa cuando no hay documento que imprimir", async () => {
    const { result, setStatus } = setup(null);

    await act(async () => {
      await result.current.handlePrintFromSettings();
    });

    expect(setStatus).toHaveBeenCalledWith("No hay ningún documento que exportar");
    expect(exportStandaloneHtml).not.toHaveBeenCalled();
  });

  it("exporta el HTML con las preferencias y lo abre en el navegador", async () => {
    const { result, setStatus } = setup(active);

    await act(async () => {
      await result.current.handlePrintFromSettings();
    });

    expect(exportStandaloneHtml).toHaveBeenCalledWith("# diario", {
      theme: "dark",
      title: "diario.md",
      pageSize: "A4",
    });
    expect(writeTemporaryExport).toHaveBeenCalledWith("<html></html>", "diario-md.html");
    expect(setStatus).toHaveBeenCalledWith(
      "Impresión: el documento se abrió en tu navegador (/tmp/diario-md.html).",
    );
  });

  it("deja la ruta cuando el sistema no puede abrir el navegador", async () => {
    vi.mocked(openInBrowser).mockResolvedValue("revealed");

    const { result, setStatus } = setup(active);

    await act(async () => {
      await result.current.handlePrintFromSettings();
    });

    expect(setStatus).toHaveBeenCalledWith(
      "Documento listo para imprimir: /tmp/diario-md.html.",
    );
  });

  it("informa del error de exportación", async () => {
    vi.mocked(exportStandaloneHtml).mockRejectedValue(new Error("sin plantilla"));

    const { result, setStatus } = setup(active);

    await act(async () => {
      await result.current.handlePrintFromSettings();
    });

    expect(setStatus).toHaveBeenCalledWith("Error al exportar: Error: sin plantilla");
  });
});
