import { describe, expect, it } from "vitest";
import {
  UNTITLED_LABEL,
  UNTITLED_PREFIX,
  displayName,
  isUntitled,
  untitledPath,
} from "./untitled";

describe("untitled", () => {
  it("reconoce sólo las rutas internas sin archivo", () => {
    expect(isUntitled(`${UNTITLED_PREFIX}1-1`)).toBe(true);
    expect(isUntitled("/notas/diario.md")).toBe(false);
    expect(isUntitled("untitled")).toBe(false);
    expect(isUntitled("")).toBe(false);
  });

  it("muestra «Sin título.md» para lo que no es archivo y el nombre para lo demás", () => {
    expect(displayName(`${UNTITLED_PREFIX}7-2`)).toBe(UNTITLED_LABEL);
    expect(displayName("/home/persona/notas/diario.md")).toBe("diario.md");
  });

  it("genera rutas internas únicas por marca de tiempo y contador", () => {
    expect(untitledPath(1700000000000, 3)).toBe(`${UNTITLED_PREFIX}1700000000000-3`);
    expect(untitledPath(1700000000000, 4)).not.toBe(untitledPath(1700000000000, 3));
  });
});
