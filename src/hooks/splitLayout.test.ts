import { describe, expect, it } from "vitest";
import { readSplitLayout } from "./splitLayout";

describe("readSplitLayout", () => {
  it("devuelve el reparto recordado cuando ambos lados son números", () => {
    expect(readSplitLayout({ splitLayout: { editor: 40, preview: 60 } })).toEqual({
      editor: 40,
      preview: 60,
    });
    // El 0 es un reparto válido: no se descarta por ser falsy.
    expect(readSplitLayout({ splitLayout: { editor: 0, preview: 100 } })).toEqual({
      editor: 0,
      preview: 100,
    });
  });

  it("descarta lo que no es un reparto numérico", () => {
    expect(readSplitLayout(undefined)).toBeUndefined();
    expect(readSplitLayout({})).toBeUndefined();
    expect(readSplitLayout({ splitLayout: null })).toBeUndefined();
    expect(readSplitLayout({ splitLayout: {} })).toBeUndefined();
    expect(readSplitLayout({ splitLayout: { editor: 40 } })).toBeUndefined();
    expect(readSplitLayout({ splitLayout: { editor: "40", preview: 60 } })).toBeUndefined();
  });

  it("descarta los números no finitos", () => {
    expect(readSplitLayout({ splitLayout: { editor: Number.NaN, preview: 60 } })).toBeUndefined();
    expect(
      readSplitLayout({ splitLayout: { editor: 40, preview: Number.POSITIVE_INFINITY } }),
    ).toBeUndefined();
  });
});
