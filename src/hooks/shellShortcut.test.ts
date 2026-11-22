import { describe, expect, it } from "vitest";
import { shellShortcut } from "./shellShortcut";

const meta = (key: string, extra: Record<string, unknown> = {}) => ({
  metaKey: true,
  key,
  ...extra,
});

describe("shellShortcut", () => {
  it("traduce los atajos de archivo del shell", () => {
    expect(shellShortcut(meta("s"))).toBe("save");
    expect(shellShortcut(meta("o"))).toBe("open");
    expect(shellShortcut(meta("n"))).toBe("new");
    expect(shellShortcut(meta("e"))).toBe("export");
    // ⌘D divide el área en dos grupos (S1).
    expect(shellShortcut(meta("d"))).toBe("split");
    // La tecla no distingue mayúsculas: con Shift el atajo sigue siendo el mismo.
    expect(shellShortcut(meta("S"))).toBe("save");
  });

  it("traduce formato, paneles y zoom", () => {
    expect(shellShortcut(meta("b"))).toBe("bold");
    expect(shellShortcut(meta("i"))).toBe("italic");
    expect(shellShortcut(meta(","))).toBe("settings");
    expect(shellShortcut(meta("\\"))).toBe("sidebar");
    expect(shellShortcut(meta("="))).toBe("zoom-in");
    expect(shellShortcut(meta("+"))).toBe("zoom-in");
    expect(shellShortcut(meta("-"))).toBe("zoom-out");
    expect(shellShortcut(meta("0"))).toBe("zoom-reset");
  });

  it("acepta el teclado numérico por `code`", () => {
    expect(shellShortcut(meta("", { code: "NumpadAdd" }))).toBe("zoom-in");
    expect(shellShortcut(meta("", { code: "NumpadSubtract" }))).toBe("zoom-out");
  });

  it("acepta Ctrl además de ⌘", () => {
    expect(shellShortcut({ ctrlKey: true, key: "s" })).toBe("save");
  });

  it("ignora pulsaciones sin modificador, con Alt o sin significado", () => {
    expect(shellShortcut({ key: "s" })).toBeNull();
    expect(shellShortcut(meta("s", { altKey: true }))).toBeNull();
    expect(shellShortcut(meta("k"))).toBeNull();
    expect(shellShortcut(meta("z"))).toBeNull();
  });
});
