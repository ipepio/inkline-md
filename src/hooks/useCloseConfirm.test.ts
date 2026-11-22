import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { closeDoc, type OpenDocument } from "@/lib/documents";
import { useCloseConfirm } from "./useCloseConfirm";

vi.mock("@/lib/documents", () => ({ closeDoc: vi.fn() }));

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

function setup(docs: OpenDocument[], confirmEnabled = true) {
  return renderHook(() => useCloseConfirm({ docs, confirmEnabled }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useCloseConfirm", () => {
  it("cierra directamente un documento limpio", () => {
    const { result } = setup([doc()]);

    act(() => {
      result.current.handleCloseDoc("doc-1");
    });

    expect(closeDoc).toHaveBeenCalledWith("doc-1");
    expect(result.current.confirmClose).toBeNull();
  });

  it("pide confirmación si el documento está sucio y la preferencia está activa", () => {
    const { result } = setup([doc({ dirty: true })]);

    act(() => {
      result.current.handleCloseDoc("doc-1");
    });

    expect(closeDoc).not.toHaveBeenCalled();
    expect(result.current.confirmClose).toEqual({ id: "doc-1", name: "diario.md" });
  });

  it("cierra sin preguntar cuando la confirmación está desactivada", () => {
    const { result } = setup([doc({ dirty: true })], false);

    act(() => {
      result.current.handleCloseDoc("doc-1");
    });

    expect(closeDoc).toHaveBeenCalledWith("doc-1");
    expect(result.current.confirmClose).toBeNull();
  });

  it("ignora ids que no están abiertos", () => {
    const { result } = setup([doc()]);

    act(() => {
      result.current.handleCloseDoc("doc-404");
    });

    expect(closeDoc).not.toHaveBeenCalled();
    expect(result.current.confirmClose).toBeNull();
  });

  it("al confirmar cierra el documento pendiente y cierra el diálogo", () => {
    const { result } = setup([doc({ dirty: true })]);

    act(() => {
      result.current.handleCloseDoc("doc-1");
    });
    act(() => {
      result.current.handleConfirmClose();
    });

    expect(closeDoc).toHaveBeenCalledWith("doc-1");
    expect(result.current.confirmClose).toBeNull();
  });

  it("al cancelar no cierra nada y limpia el diálogo", () => {
    const { result } = setup([doc({ dirty: true })]);

    act(() => {
      result.current.handleCloseDoc("doc-1");
    });
    act(() => {
      result.current.handleCancelClose();
    });

    expect(closeDoc).not.toHaveBeenCalled();
    expect(result.current.confirmClose).toBeNull();
  });
});
