import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TreeNode } from "./workspace";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

import { invoke } from "@tauri-apps/api/core";
import {
  fileNameOf,
  filePaths,
  flattenFiles,
  getRecents,
  getWorkspace,
  listTree,
  loadWorkspaceConfig,
  pushRecent,
  setWorkspace,
  workspaceName,
} from "./workspace";

const invokeMock = vi.mocked(invoke);

const tree: TreeNode[] = [
  {
    name: "docs",
    path: "/ws/docs",
    isDir: true,
    children: [
      { name: "guia.md", path: "/ws/docs/guia.md", isDir: false, children: [] },
      { name: "notas.txt", path: "/ws/docs/notas.txt", isDir: false, children: [] },
    ],
  },
  { name: "README.md", path: "/ws/README.md", isDir: false, children: [] },
];

beforeEach(() => {
  invokeMock.mockReset();
});

describe("workspace wrappers", () => {
  it("pide el árbol con el nombre de comando y el argumento camelCase", async () => {
    invokeMock.mockResolvedValue(tree);

    await expect(listTree("/ws")).resolves.toEqual(tree);
    expect(invokeMock).toHaveBeenCalledWith("list_tree", { root: "/ws" });
  });

  it("lee y escribe la carpeta raíz recordada", async () => {
    invokeMock.mockResolvedValueOnce(null).mockResolvedValueOnce(undefined);

    await expect(getWorkspace()).resolves.toBeNull();
    await setWorkspace("/ws");

    expect(invokeMock).toHaveBeenNthCalledWith(1, "get_workspace");
    expect(invokeMock).toHaveBeenNthCalledWith(2, "set_workspace", { root: "/ws" });
  });

  it("empuja un reciente y devuelve la lista actualizada", async () => {
    const recents = [{ path: "/ws/README.md", name: "README.md", openedAt: 7 }];
    invokeMock.mockResolvedValue(recents);

    await expect(pushRecent("/ws/README.md")).resolves.toEqual(recents);
    await expect(getRecents()).resolves.toEqual(recents);

    expect(invokeMock).toHaveBeenNthCalledWith(1, "push_recent", {
      path: "/ws/README.md",
    });
    expect(invokeMock).toHaveBeenNthCalledWith(2, "get_recents");
  });

  it("une raíz y recientes en la carga inicial", async () => {
    invokeMock
      .mockResolvedValueOnce("/ws")
      .mockResolvedValueOnce([{ path: "/ws/a.md", name: "a.md", openedAt: 1 }]);

    await expect(loadWorkspaceConfig()).resolves.toEqual({
      root: "/ws",
      recents: [{ path: "/ws/a.md", name: "a.md", openedAt: 1 }],
    });
  });
});

describe("workspace helpers", () => {
  it("aplana el árbol a rutas de archivos en orden de drawer", () => {
    expect(filePaths(tree)).toEqual([
      "/ws/docs/guia.md",
      "/ws/docs/notas.txt",
      "/ws/README.md",
    ]);
    expect(flattenFiles(tree).every((node) => !node.isDir)).toBe(true);
    expect(flattenFiles([])).toEqual([]);
  });

  it("extrae el nombre visible de una ruta", () => {
    expect(fileNameOf("/ws/docs/guia.md")).toBe("guia.md");
    expect(fileNameOf("suelto.md")).toBe("suelto.md");
    expect(fileNameOf("/ws/docs/")).toBe("docs");
  });

  it("nombra la raíz del drawer con un texto en español cuando falta", () => {
    expect(workspaceName("/Users/yo/espacio")).toBe("espacio");
    expect(workspaceName(null)).toBe("Sin carpeta raíz");
  });
});
