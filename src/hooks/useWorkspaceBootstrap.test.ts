import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { listTree, loadWorkspaceConfig, setWorkspace } from "@/lib/workspace";
import { useWorkspaceBootstrap } from "./useWorkspaceBootstrap";

vi.mock("@/lib/workspace", () => ({
  loadWorkspaceConfig: vi.fn(),
  listTree: vi.fn(),
  setWorkspace: vi.fn(),
}));

const openDialog = vi.fn();
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: openDialog }));

const recent = { path: "/notas/diario.md", name: "diario.md", openedAt: 1 };
const node = { name: "notas", path: "/notas", isDir: true, children: [] };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(loadWorkspaceConfig).mockResolvedValue({ root: null, recents: [] });
  vi.mocked(listTree).mockResolvedValue([]);
  vi.mocked(setWorkspace).mockResolvedValue(undefined);
  openDialog.mockResolvedValue(null);
});

describe("useWorkspaceBootstrap", () => {
  it("carga los recientes sin raíz recordada y no lista ningún árbol", async () => {
    vi.mocked(loadWorkspaceConfig).mockResolvedValue({ root: null, recents: [recent] });

    const { result } = renderHook(() => useWorkspaceBootstrap());

    await waitFor(() => expect(result.current.recents).toEqual([recent]));
    expect(result.current.root).toBeNull();
    expect(result.current.tree).toEqual([]);
    expect(result.current.status).toBe("Listo");
    expect(listTree).not.toHaveBeenCalled();
  });

  it("carga la raíz recordada y su árbol", async () => {
    vi.mocked(loadWorkspaceConfig).mockResolvedValue({ root: "/notas", recents: [recent] });
    vi.mocked(listTree).mockResolvedValue([node]);

    const { result } = renderHook(() => useWorkspaceBootstrap());

    await waitFor(() => expect(result.current.root).toBe("/notas"));
    await waitFor(() => expect(result.current.tree).toEqual([node]));
    expect(result.current.recents).toEqual([recent]);
    expect(listTree).toHaveBeenCalledWith("/notas");
  });

  it("informa del fallo de carga en la barra de estado", async () => {
    vi.mocked(loadWorkspaceConfig).mockRejectedValue(new Error("sin disco"));

    const { result } = renderHook(() => useWorkspaceBootstrap());

    await waitFor(() =>
      expect(result.current.status).toBe(
        "No se pudo cargar el espacio de trabajo: Error: sin disco",
      ),
    );
    expect(result.current.root).toBeNull();
  });

  it("elige carpeta raíz: la recuerda y lista su árbol", async () => {
    openDialog.mockResolvedValue("/elegida");
    vi.mocked(listTree).mockResolvedValue([node]);

    const { result } = renderHook(() => useWorkspaceBootstrap());
    await waitFor(() => expect(loadWorkspaceConfig).toHaveBeenCalled());

    await act(async () => {
      await result.current.handleChooseRoot();
    });

    expect(openDialog).toHaveBeenCalledWith({ directory: true, multiple: false });
    expect(setWorkspace).toHaveBeenCalledWith("/elegida");
    expect(result.current.root).toBe("/elegida");
    expect(result.current.tree).toEqual([node]);
  });

  it("no cambia nada si el diálogo de carpeta se cancela", async () => {
    openDialog.mockResolvedValue(null);

    const { result } = renderHook(() => useWorkspaceBootstrap());
    await waitFor(() => expect(loadWorkspaceConfig).toHaveBeenCalled());

    await act(async () => {
      await result.current.handleChooseRoot();
    });

    expect(setWorkspace).not.toHaveBeenCalled();
    expect(listTree).not.toHaveBeenCalled();
    expect(result.current.root).toBeNull();
  });

  it("deja el árbol vacío si listar la carpeta elegida falla", async () => {
    openDialog.mockResolvedValue("/rota");
    vi.mocked(listTree).mockRejectedValue(new Error("sin permisos"));

    const { result } = renderHook(() => useWorkspaceBootstrap());
    await waitFor(() => expect(loadWorkspaceConfig).toHaveBeenCalled());

    await act(async () => {
      await result.current.handleChooseRoot();
    });

    expect(result.current.root).toBe("/rota");
    expect(result.current.tree).toEqual([]);
  });
});
