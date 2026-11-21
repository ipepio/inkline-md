import { afterEach, describe, expect, it } from "vitest";
import { comboLabel, isMacPlatform, modifierLabel } from "./platform";

/**
 * La plataforma se sobreescribe por test: en el WebView real nunca cambia,
 * pero los tests deben poder cubrir las dos caras del modificador.
 */
function withPlatform(platform: string): void {
  Object.defineProperty(window.navigator, "platform", {
    value: platform,
    configurable: true,
  });
}

afterEach(() => {
  withPlatform("MacIntel");
});

describe("platform", () => {
  it("en Apple muestra ⌘ y combina compacto", () => {
    withPlatform("MacIntel");

    expect(isMacPlatform()).toBe(true);
    expect(modifierLabel()).toBe("⌘");
    expect(comboLabel("K")).toBe("⌘K");
    expect(comboLabel("+")).toBe("⌘+");
  });

  it("en Windows muestra Ctrl y combina con +", () => {
    withPlatform("Win32");

    expect(isMacPlatform()).toBe(false);
    expect(modifierLabel()).toBe("Ctrl");
    expect(comboLabel("N")).toBe("Ctrl+N");
    expect(comboLabel("\\")).toBe("Ctrl+\\");
  });

  it("en Linux muestra Ctrl igual que Windows", () => {
    withPlatform("Linux x86_64");

    expect(modifierLabel()).toBe("Ctrl");
    expect(comboLabel("0")).toBe("Ctrl+0");
  });
});
