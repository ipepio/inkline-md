import { describe, expect, it } from "vitest";
import { cursorPosition, documentStats } from "./text";

describe("documentStats", () => {
  it("cuenta 0 palabras y 1 línea en un documento vacío", () => {
    expect(documentStats("")).toEqual({ words: 0, lines: 1 });
  });

  it("cuenta palabras separadas por espacios", () => {
    expect(documentStats("Hola mundo  del markdown")).toEqual({ words: 4, lines: 1 });
  });

  it("cuenta una línea por cada salto de línea", () => {
    expect(documentStats("uno\ndos\ntres")).toEqual({ words: 3, lines: 3 });
  });

  it("el salto de línea final añade una línea vacía", () => {
    expect(documentStats("uno\ndos\n")).toEqual({ words: 2, lines: 3 });
  });

  it("no cuenta espacios ni líneas en blanco como palabras", () => {
    expect(documentStats("  \n\n  ")).toEqual({ words: 0, lines: 3 });
  });
});

describe("cursorPosition", () => {
  it("empieza en la línea 1, columna 1", () => {
    expect(cursorPosition("hola", 0)).toEqual({ line: 1, column: 1 });
  });

  it("cuenta la columna dentro de la línea actual", () => {
    expect(cursorPosition("hola mundo", 5)).toEqual({ line: 1, column: 6 });
  });

  it("cuenta las líneas anteriores al desplazamiento", () => {
    expect(cursorPosition("uno\ndos\ntres", 9)).toEqual({ line: 3, column: 2 });
  });

  it("recorta un desplazamiento fuera del documento", () => {
    expect(cursorPosition("uno", 99)).toEqual({ line: 1, column: 4 });
    expect(cursorPosition("uno", -5)).toEqual({ line: 1, column: 1 });
  });
});
