import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { EditorWorkspaceHandle } from "@/components/editor/EditorWorkspace";
import type { ExportMenuHandle } from "@/components/export/ExportMenu";
import { menuAction, menuIds } from "./nativeMenu";
import { useNativeMenu, type NativeMenuOptions } from "./useNativeMenu";

// El canal del menú nativo es Rust → webview: aquí se sustituye `listen` por un
// doble que guarda el manejador para poder «emitir» eventos desde el test.
const events = vi.hoisted(() => ({ listen: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({ listen: events.listen }));

interface MenuEventLike {
  payload: string;
}

function setup() {
  const listeners: ((event: MenuEventLike) => void)[] = [];
  const unlisten = vi.fn();
  events.listen.mockImplementation(
    (_name: string, handler: (event: MenuEventLike) => void) => {
      listeners.push(handler);
      return Promise.resolve(unlisten);
    },
  );

  const applyFormat = vi.fn();
  const exportHtml = vi.fn().mockResolvedValue(undefined);
  const options: NativeMenuOptions = {
    editorRef: { current: { applyFormat } as EditorWorkspaceHandle },
    exportRef: { current: { exportHtml } as ExportMenuHandle },
    handleSave: vi.fn().mockResolvedValue(undefined),
    handleOpenDialog: vi.fn().mockResolvedValue(undefined),
    handleNewDoc: vi.fn(),
    handleSplit: vi.fn(),
    handleClose: vi.fn(),
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    resetZoom: vi.fn(),
    setSettingsOpen: vi.fn(),
    setSidebarOpen: vi.fn(),
  };

  const hook = renderHook((props: NativeMenuOptions) => useNativeMenu(props), {
    initialProps: options,
  });

  /** Emite el evento del menú nativo con `payload` como id del ítem. */
  function emit(payload: string) {
    act(() => {
      for (const listener of listeners) listener({ payload });
    });
  }

  return { ...hook, options, emit, listeners, unlisten, applyFormat, exportHtml };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useNativeMenu", () => {
  it("escucha el evento del menú nativo", () => {
    const { listeners } = setup();

    expect(events.listen).toHaveBeenCalledWith("inkline://menu", expect.any(Function));
    expect(listeners).toHaveLength(1);
  });

  // T7: cada ítem del menú ejecuta la MISMA acción que su acelerador.
  it("enruta cada id a la acción del shell que le corresponde", async () => {
    const { emit, options, applyFormat, exportHtml } = setup();

    emit("inkline:new");
    emit("inkline:open");
    emit("inkline:save");
    emit("inkline:close");
    emit("inkline:export");
    emit("inkline:settings");
    emit("inkline:bold");
    emit("inkline:italic");
    emit("inkline:split");
    emit("inkline:zoom-in");
    emit("inkline:zoom-out");
    emit("inkline:zoom-reset");
    emit("inkline:sidebar");
    await vi.waitFor(() => expect(options.handleSave).toHaveBeenCalled());

    expect(options.handleNewDoc).toHaveBeenCalledTimes(1);
    expect(options.handleOpenDialog).toHaveBeenCalledTimes(1);
    expect(options.handleClose).toHaveBeenCalledTimes(1);
    expect(exportHtml).toHaveBeenCalledTimes(1);
    expect(options.setSettingsOpen).toHaveBeenCalledWith(true);
    expect(applyFormat.mock.calls).toEqual([["bold"], ["italic"]]);
    expect(options.handleSplit).toHaveBeenCalledTimes(1);
    expect(options.zoomIn).toHaveBeenCalledTimes(1);
    expect(options.zoomOut).toHaveBeenCalledTimes(1);
    expect(options.resetZoom).toHaveBeenCalledTimes(1);
    expect(options.setSidebarOpen).toHaveBeenCalledTimes(1);

    // El explorador se alterna igual que con ⌘\: el shell recibe el updater.
    const toggle = vi.mocked(options.setSidebarOpen).mock.calls[0][0] as (
      open: boolean,
    ) => boolean;
    expect(toggle(true)).toBe(false);
    expect(toggle(false)).toBe(true);
  });

  it("ignora ids que no son del menú (incluida la paleta, que no está)", () => {
    const { emit, options, applyFormat, exportHtml } = setup();

    emit("inkline:palette");
    emit("inkline:search");
    emit("quit");
    emit("");
    emit("constructor");

    expect(options.handleNewDoc).not.toHaveBeenCalled();
    expect(options.handleOpenDialog).not.toHaveBeenCalled();
    expect(options.handleSave).not.toHaveBeenCalled();
    expect(options.handleClose).not.toHaveBeenCalled();
    expect(exportHtml).not.toHaveBeenCalled();
    expect(applyFormat).not.toHaveBeenCalled();
    expect(options.setSettingsOpen).not.toHaveBeenCalled();
  });

  it("retira el escucha al desmontar", async () => {
    const { unlisten, unmount } = setup();

    unmount();

    // `listen` resuelve en un microtask: el hook llama a su `off` en cuanto
    // llega, porque ya no hay componente al que despachar.
    await vi.waitFor(() => expect(unlisten).toHaveBeenCalledTimes(1));
  });

  it("usa los manejadores del último render sin reabrir el canal", () => {
    const { rerender, emit, options } = setup();
    const next: NativeMenuOptions = {
      ...options,
      handleSplit: vi.fn(),
      zoomIn: vi.fn(),
    };

    rerender(next);
    emit("inkline:split");
    emit("inkline:zoom-in");

    expect(events.listen).toHaveBeenCalledTimes(1);
    expect(next.handleSplit).toHaveBeenCalledTimes(1);
    expect(next.zoomIn).toHaveBeenCalledTimes(1);
    expect(options.handleSplit).not.toHaveBeenCalled();
    expect(options.zoomIn).not.toHaveBeenCalled();
  });

  // Contrato con `src-tauri/src/menu.rs`: 13 ids, sin ⌘K.
  it("cubre exactamente la tabla de ids del menú nativo", () => {
    expect(menuIds()).toEqual([
      "inkline:new",
      "inkline:open",
      "inkline:save",
      "inkline:close",
      "inkline:export",
      "inkline:settings",
      "inkline:bold",
      "inkline:italic",
      "inkline:split",
      "inkline:zoom-in",
      "inkline:zoom-out",
      "inkline:zoom-reset",
      "inkline:sidebar",
    ]);
    expect(menuAction("inkline:palette")).toBeNull();
    expect(menuAction("inkline:new")).toBe("new");
  });
});
