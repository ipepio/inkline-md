import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { isBlockedBrowserShortcut, useAppHardening } from "./useAppHardening";

describe("isBlockedBrowserShortcut", () => {
  it("bloquea F12, F5 y atajos de DevTools / código fuente / recarga", () => {
    expect(isBlockedBrowserShortcut({ key: "F12" })).toBe(true);
    expect(isBlockedBrowserShortcut({ key: "F5" })).toBe(true);
    expect(isBlockedBrowserShortcut({ key: "i", metaKey: true, altKey: true })).toBe(true);
    expect(isBlockedBrowserShortcut({ key: "J", metaKey: true, altKey: true })).toBe(true);
    expect(isBlockedBrowserShortcut({ key: "c", metaKey: true, altKey: true })).toBe(true);
    expect(isBlockedBrowserShortcut({ key: "I", ctrlKey: true, shiftKey: true })).toBe(true);
    expect(isBlockedBrowserShortcut({ key: "u", metaKey: true })).toBe(true);
    expect(isBlockedBrowserShortcut({ key: "r", metaKey: true })).toBe(true);
    expect(isBlockedBrowserShortcut({ key: "r", ctrlKey: true })).toBe(true);
  });

  it("no interfiere con los atajos propios de Inkline", () => {
    expect(isBlockedBrowserShortcut({ key: "i", metaKey: true })).toBe(false);
    expect(isBlockedBrowserShortcut({ key: "b", metaKey: true })).toBe(false);
    expect(isBlockedBrowserShortcut({ key: "d", metaKey: true })).toBe(false);
    expect(isBlockedBrowserShortcut({ key: "w", metaKey: true })).toBe(false);
    expect(isBlockedBrowserShortcut({ key: "k", metaKey: true })).toBe(false);
    expect(isBlockedBrowserShortcut({ key: "s", metaKey: true })).toBe(false);
  });
});

describe("useAppHardening", () => {
  it("cancela el evento global contextmenu y los atajos de inspección", () => {
    const { unmount } = renderHook(() => useAppHardening());

    const ctx = new MouseEvent("contextmenu", { cancelable: true });
    window.dispatchEvent(ctx);
    expect(ctx.defaultPrevented).toBe(true);

    const inspect = new KeyboardEvent("keydown", {
      key: "i",
      metaKey: true,
      altKey: true,
      cancelable: true,
    });
    window.dispatchEvent(inspect);
    expect(inspect.defaultPrevented).toBe(true);

    unmount();
  });
});
