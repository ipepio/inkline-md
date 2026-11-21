import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Los wrappers de Tauri se mockean: el contrato de cada operación (diálogo,
 * escritura, apertura externa) se verifica en jsdom sin IPC real.
 */
const dialog = vi.hoisted(() => ({ save: vi.fn() }));
const opener = vi.hoisted(() => ({ openPath: vi.fn(), revealItemInDir: vi.fn() }));
const path = vi.hoisted(() => ({
  tempDir: vi.fn(async () => "/tmp/"),
  join: vi.fn(async (...parts: string[]) => parts.join("").replace(/\/+/g, "/")),
}));
const files = vi.hoisted(() => ({ saveTextFile: vi.fn(async () => {}) }));

vi.mock("@tauri-apps/plugin-dialog", () => ({ save: dialog.save }));
vi.mock("@tauri-apps/plugin-opener", () => ({
  openPath: opener.openPath,
  revealItemInDir: opener.revealItemInDir,
}));
vi.mock("@tauri-apps/api/path", () => ({ tempDir: path.tempDir, join: path.join }));
vi.mock("@/lib/files", () => ({ saveTextFile: files.saveTextFile }));

import {
  HTML_EXPORT_FILTERS,
  MARKDOWN_EXPORT_FILTERS,
  openInBrowser,
  saveDocumentCopy,
  writeTemporaryExport,
} from "./operations";

afterEach(() => {
  vi.clearAllMocks();
  path.tempDir.mockResolvedValue("/tmp/");
  path.join.mockImplementation(async (...parts: string[]) =>
    parts.join("").replace(/\/+/g, "/"),
  );
  files.saveTextFile.mockResolvedValue(undefined);
});

describe("saveDocumentCopy", () => {
  it("escribe en la ruta elegida y la devuelve", async () => {
    dialog.save.mockResolvedValue("/Users/yo/guia.html");

    const saved = await saveDocumentCopy("<html></html>", "guia.html", HTML_EXPORT_FILTERS);

    expect(saved).toBe("/Users/yo/guia.html");
    expect(dialog.save).toHaveBeenCalledWith({
      defaultPath: "guia.html",
      filters: HTML_EXPORT_FILTERS,
    });
    expect(files.saveTextFile).toHaveBeenCalledWith("/Users/yo/guia.html", "<html></html>");
  });

  it("no escribe nada cuando se cancela el diálogo", async () => {
    dialog.save.mockResolvedValue(null);

    const saved = await saveDocumentCopy("texto", "guia.md", MARKDOWN_EXPORT_FILTERS);

    expect(saved).toBeNull();
    expect(files.saveTextFile).not.toHaveBeenCalled();
  });
});

describe("writeTemporaryExport", () => {
  it("escribe el export en el directorio temporal del sistema", async () => {
    const written = await writeTemporaryExport("<html></html>", "guia.html");

    expect(path.tempDir).toHaveBeenCalled();
    expect(written).toBe("/tmp/guia.html");
    expect(files.saveTextFile).toHaveBeenCalledWith("/tmp/guia.html", "<html></html>");
  });
});

describe("openInBrowser", () => {
  it("abre el archivo con la aplicación por defecto", async () => {
    opener.openPath.mockResolvedValue(undefined);

    await expect(openInBrowser("/tmp/guia.html")).resolves.toBe("opened");
    expect(opener.openPath).toHaveBeenCalledWith("/tmp/guia.html");
    expect(opener.revealItemInDir).not.toHaveBeenCalled();
  });

  it("si el sistema rechaza la apertura, revela el archivo para no perderlo", async () => {
    opener.openPath.mockRejectedValue(new Error("forbidden path"));
    opener.revealItemInDir.mockResolvedValue(undefined);

    await expect(openInBrowser("/tmp/guia.html")).resolves.toBe("revealed");
    expect(opener.revealItemInDir).toHaveBeenCalledWith("/tmp/guia.html");
  });

  it("no propaga el fallo cuando tampoco puede revelar el archivo", async () => {
    opener.openPath.mockRejectedValue(new Error("forbidden path"));
    opener.revealItemInDir.mockRejectedValue(new Error("sin permisos"));

    await expect(openInBrowser("/tmp/guia.html")).resolves.toBe("revealed");
  });
});
