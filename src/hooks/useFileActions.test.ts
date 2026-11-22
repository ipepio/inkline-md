import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { closeDoc, markSaved, openDoc, setViewState, type OpenDocument } from "@/lib/documents";
import { openTextFile, readTextFile, saveTextFile, saveTextFileAs } from "@/lib/files";
import { pushRecent } from "@/lib/workspace";
import type { DefaultView } from "@/lib/settings";
import { UNTITLED_PREFIX } from "./untitled";
import { useFileActions } from "./useFileActions";

vi.mock("@/lib/documents", () => ({
  openDoc: vi.fn(),
  closeDoc: vi.fn(),
  markSaved: vi.fn(),
  setViewState: vi.fn(),
}));

vi.mock("@/lib/files", () => ({
  openTextFile: vi.fn(),
  readTextFile: vi.fn(),
  saveTextFile: vi.fn(),
  saveTextFileAs: vi.fn(),
}));

vi.mock("@/lib/workspace", () => ({
  pushRecent: vi.fn(),
  fileNameOf: (path: string) => path.split(/[\\/]/).pop() ?? path,
}));

function doc(overrides: Partial<OpenDocument> = {}): OpenDocument {
  return {
    id: "doc-1",
    path: "/notas/diario.md",
    name: "diario.md",
    contents: "# diario",
    dirty: false,
    viewState: {},
    ...overrides,
  };
}

function setup(active: OpenDocument | null, defaultView: DefaultView = "split") {
  const setStatus = vi.fn();
  const setRecents = vi.fn();
  const hook = renderHook(() =>
    useFileActions({ active, defaultView, setStatus, setRecents }),
  );
  return { ...hook, setStatus, setRecents };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(openDoc).mockReturnValue("doc-9");
  vi.mocked(pushRecent).mockResolvedValue([]);
  vi.mocked(saveTextFile).mockResolvedValue(undefined);
});

describe("useFileActions · abrir", () => {
  it("abre el documento elegido en el diálogo, lo registra y anuncia la ruta", async () => {
    vi.mocked(openTextFile).mockResolvedValue({ path: "/notas/idea.md", contents: "# idea" });

    const { result, setStatus, setRecents } = setup(null);
    await act(async () => {
      await result.current.handleOpenDialog();
    });

    expect(openDoc).toHaveBeenCalledWith("/notas/idea.md", "# idea");
    expect(pushRecent).toHaveBeenCalledWith("/notas/idea.md");
    expect(setRecents).toHaveBeenCalledWith([]);
    expect(setStatus).toHaveBeenCalledWith("Abierto: /notas/idea.md");
  });

  it("no hace nada si el diálogo de apertura se cancela", async () => {
    vi.mocked(openTextFile).mockResolvedValue(null);

    const { result, setStatus, setRecents } = setup(null);
    await act(async () => {
      await result.current.handleOpenDialog();
    });

    expect(openDoc).not.toHaveBeenCalled();
    expect(setRecents).not.toHaveBeenCalled();
    expect(setStatus).not.toHaveBeenCalled();
  });

  it("ignora las rutas internas sin archivo", async () => {
    const { result } = setup(null);

    await act(async () => {
      await result.current.handleOpenFile(`${UNTITLED_PREFIX}1-1`);
    });

    expect(readTextFile).not.toHaveBeenCalled();
    expect(openDoc).not.toHaveBeenCalled();
  });

  it("informa del error al abrir un archivo del explorador", async () => {
    vi.mocked(readTextFile).mockRejectedValue(new Error("ilegible"));

    const { result, setStatus } = setup(null);
    await act(async () => {
      await result.current.handleOpenFile("/notas/roto.md");
    });

    expect(setStatus).toHaveBeenCalledWith("Error al abrir: Error: ilegible");
  });

  it("crea documentos sin título en la vista por defecto", () => {
    const { result } = setup(null, "preview");

    act(() => {
      result.current.handleNewDoc();
    });

    const [path, contents] = vi.mocked(openDoc).mock.calls[0];
    expect(path.startsWith(UNTITLED_PREFIX)).toBe(true);
    expect(contents).toBe("");
    expect(setViewState).toHaveBeenCalledWith("doc-9", { mode: "preview" });
  });
});

describe("useFileActions · guardar", () => {
  it("no hace nada sin documento activo", async () => {
    const { result, setStatus } = setup(null);

    await act(async () => {
      await result.current.handleSave();
    });

    expect(saveTextFile).not.toHaveBeenCalled();
    expect(setStatus).not.toHaveBeenCalled();
  });

  it("guarda en la ruta actual y marca el documento como limpio", async () => {
    const { result, setStatus } = setup(doc({ dirty: true }));

    await act(async () => {
      await result.current.handleSave();
    });

    expect(saveTextFile).toHaveBeenCalledWith("/notas/diario.md", "# diario");
    expect(markSaved).toHaveBeenCalledWith("doc-1");
    expect(setStatus).toHaveBeenCalledWith("Guardado: /notas/diario.md");
  });

  it("«Guardar como» reabre el documento en la ruta elegida", async () => {
    vi.mocked(saveTextFileAs).mockResolvedValue("/notas/final.md");
    const active = doc({ id: "doc-3", path: `${UNTITLED_PREFIX}123-1`, contents: "hola" });
    const { result, setStatus } = setup(active);

    await act(async () => {
      await result.current.handleSave();
    });

    expect(closeDoc).toHaveBeenCalledWith("doc-3");
    expect(openDoc).toHaveBeenCalledWith("/notas/final.md", "hola");
    expect(setStatus).toHaveBeenCalledWith("Guardado: /notas/final.md");
  });

  it("no toca nada si «Guardar como» se cancela", async () => {
    vi.mocked(saveTextFileAs).mockResolvedValue(null);
    const active = doc({ path: `${UNTITLED_PREFIX}123-2` });
    const { result, setStatus } = setup(active);

    await act(async () => {
      await result.current.handleSave();
    });

    expect(closeDoc).not.toHaveBeenCalled();
    expect(openDoc).not.toHaveBeenCalled();
    expect(setStatus).not.toHaveBeenCalled();
  });

  it("informa del error de escritura", async () => {
    vi.mocked(saveTextFile).mockRejectedValue(new Error("disco lleno"));

    const { result, setStatus } = setup(doc());
    await act(async () => {
      await result.current.handleSave();
    });

    expect(setStatus).toHaveBeenCalledWith("Error al guardar: Error: disco lleno");
    expect(markSaved).not.toHaveBeenCalled();
  });
});
