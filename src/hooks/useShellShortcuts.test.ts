import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import type { EditorWorkspaceHandle } from "@/components/editor/EditorWorkspace";
import type { ExportMenuHandle } from "@/components/export/ExportMenu";
import { useShellShortcuts, type ShellShortcutsOptions } from "./useShellShortcuts";

function setup() {
  const applyFormat = vi.fn();
  const exportHtml = vi.fn().mockResolvedValue(undefined);
  const options = {
    editorRef: { current: { applyFormat } as EditorWorkspaceHandle },
    exportRef: { current: { exportHtml } as ExportMenuHandle },
    handleSave: vi.fn().mockResolvedValue(undefined),
    handleOpenDialog: vi.fn().mockResolvedValue(undefined),
    handleNewDoc: vi.fn(),
    handleSplit: vi.fn(),
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    resetZoom: vi.fn(),
    setSettingsOpen: vi.fn(),
    setSidebarOpen: vi.fn(),
  } satisfies ShellShortcutsOptions;

  const hook = renderHook(() => useShellShortcuts(options));
  return { ...hook, options, applyFormat, exportHtml };
}

function press(init: KeyboardEventInit): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { cancelable: true, ...init });
  window.dispatchEvent(event);
  return event;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useShellShortcuts", () => {
  it("enruta ⌘S, ⌘O y ⌘N a las acciones del shell", async () => {
    const { options } = setup();

    const save = press({ metaKey: true, key: "s" });
    const open = press({ metaKey: true, key: "o" });
    press({ metaKey: true, key: "n" });
    await vi.waitFor(() => expect(options.handleSave).toHaveBeenCalled());

    expect(save.defaultPrevented).toBe(true);
    expect(open.defaultPrevented).toBe(true);
    expect(options.handleOpenDialog).toHaveBeenCalledTimes(1);
    expect(options.handleNewDoc).toHaveBeenCalledTimes(1);
  });

  // S1: ⌘D divide el área de trabajo (el enrutado por grupo llega en T5).
  it("divide el área con ⌘D", () => {
    const { options } = setup();

    const split = press({ metaKey: true, key: "d" });

    expect(split.defaultPrevented).toBe(true);
    expect(options.handleSplit).toHaveBeenCalledTimes(1);
  });

  it("aplica formato en el editor y exporta desde el menú", () => {
    const { applyFormat, exportHtml } = setup();

    press({ metaKey: true, key: "b" });
    press({ metaKey: true, key: "i" });
    press({ metaKey: true, key: "e" });

    expect(applyFormat.mock.calls).toEqual([["bold"], ["italic"]]);
    expect(exportHtml).toHaveBeenCalledTimes(1);
  });

  it("abre preferencias y alterna el explorador", () => {
    const { options } = setup();

    press({ metaKey: true, key: "," });
    press({ metaKey: true, key: "\\" });

    expect(options.setSettingsOpen).toHaveBeenCalledWith(true);
    expect(options.setSidebarOpen).toHaveBeenCalledWith(expect.any(Function));
    const toggle = vi.mocked(options.setSidebarOpen).mock.calls[0][0] as (
      open: boolean,
    ) => boolean;
    expect(toggle(true)).toBe(false);
    expect(toggle(false)).toBe(true);
  });

  it("escala el texto con el zoom global", () => {
    const { options } = setup();

    press({ metaKey: true, key: "=" });
    press({ metaKey: true, key: "+" });
    press({ metaKey: true, key: "-" });
    press({ metaKey: true, key: "0" });

    expect(options.zoomIn).toHaveBeenCalledTimes(2);
    expect(options.zoomOut).toHaveBeenCalledTimes(1);
    expect(options.resetZoom).toHaveBeenCalledTimes(1);
  });

  it("ignora pulsaciones sin ⌘/Ctrl o con Alt", () => {
    const { options } = setup();

    press({ key: "s" });
    press({ metaKey: true, altKey: true, key: "s" });

    expect(options.handleSave).not.toHaveBeenCalled();
  });

  it("retira el escucha al desmontar", () => {
    const { options, unmount } = setup();

    unmount();
    press({ metaKey: true, key: "s" });

    expect(options.handleSave).not.toHaveBeenCalled();
  });
});
