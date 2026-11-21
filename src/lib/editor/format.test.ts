import { describe, expect, it } from "vitest";
import {
  applyFormat,
  insertInlineCode,
  insertLink,
  insertMermaidFence,
  insertTable,
  minimalChange,
  toggleLinePrefix,
  wrapSelection,
  type FormatState,
} from "./format";

/**
 * Comodidad: estado a partir de una selección marcada con `|`.
 * Un solo `|` es un cursor; dos `|` delimitan la selección.
 */
function at(marked: string): FormatState {
  const first = marked.indexOf("|");
  const second = marked.indexOf("|", first + 1);
  const text = marked.replace(/\|/g, "");
  if (second < 0) return { text, selectionStart: first, selectionEnd: first };
  return { text, selectionStart: first, selectionEnd: second - 1 };
}

/** Comodidad: expresa el resultado con marcadores para compararlo entero. */
function marked(state: FormatState): string {
  const before = state.text.slice(0, state.selectionStart);
  const inside = state.text.slice(state.selectionStart, state.selectionEnd);
  const after = state.text.slice(state.selectionEnd);
  return `${before}|${inside}|${after}`;
}

describe("wrapSelection", () => {
  it("negrita sin selección inserta el marcador y deja seleccionado el texto de ejemplo", () => {
    expect(marked(wrapSelection("bold", at("|")))).toBe("**|texto|**");
  });

  it("negrita envuelve la selección y la mantiene seleccionada", () => {
    expect(marked(wrapSelection("bold", at("hola |mundo|")))).toBe("hola **|mundo|**");
  });

  it("negrita sobre una selección ya envuelta deshace el marcado", () => {
    expect(marked(wrapSelection("bold", at("hola **|mundo|**")))).toBe("hola |mundo|");
  });

  it("negrita deshace el marcado cuando la selección incluye los marcadores", () => {
    expect(marked(wrapSelection("bold", at("hola |**mundo**|")))).toBe("hola |mundo|");
  });

  it("cursiva usa un asterisco y respeta los marcadores de negrita vecinos", () => {
    expect(marked(wrapSelection("italic", at("**|a|**")))).toBe("***|a|***");
  });

  it("cursiva deshace su propio marcado", () => {
    expect(marked(wrapSelection("italic", at("un *|texto|* aquí")))).toBe("un |texto| aquí");
  });

  it("tachado usa dos tildes y alterna", () => {
    expect(marked(wrapSelection("strike", at("|fuera|")))).toBe("~~|fuera|~~");
    expect(marked(wrapSelection("strike", at("~~|fuera|~~")))).toBe("|fuera|");
  });

  it("inserta al final del documento sin comerse el texto previo", () => {
    expect(marked(wrapSelection("bold", at("abc|")))).toBe("abc**|texto|**");
  });
});

describe("toggleLinePrefix", () => {
  it("H2 pone el prefijo en la línea del cursor y deja el cursor tras él", () => {
    expect(marked(toggleLinePrefix("h2", at("|Título")))).toBe("## ||Título");
  });

  it("H2 normaliza otra cabecera en lugar de acumular numerales", () => {
    expect(toggleLinePrefix("h2", at("# Título")).text).toBe("## Título");
  });

  it("H2 quita el prefijo cuando ya está", () => {
    expect(marked(toggleLinePrefix("h2", at("|## Título")))).toBe("||Título");
  });

  it("lista con el cursor en medio de la línea conserva la columna", () => {
    expect(marked(toggleLinePrefix("list", at("un|o\ndos")))).toBe("- un||o\ndos");
  });

  it("lista numera todas las líneas de una selección múltiple", () => {
    expect(marked(toggleLinePrefix("list", at("|a\nb|")))).toBe("- |a\n- b|");
  });

  it("lista alterna: quita el prefijo de todas las líneas", () => {
    expect(marked(toggleLinePrefix("list", at("|- a\n- b|")))).toBe("|a\nb|");
  });

  it("lista completa una selección mixta en lugar de mezclar viñetas", () => {
    expect(marked(toggleLinePrefix("list", at("|- a\nb|")))).toBe("|- a\n- b|");
  });

  it("lista alterna sobre cualquier viñeta", () => {
    expect(toggleLinePrefix("list", at("* a")).text).toBe("a");
  });

  it("task lista con casilla sin marcar", () => {
    expect(marked(toggleLinePrefix("task", at("|pendiente")))).toBe("- [ ] ||pendiente");
  });

  it("task quita el prefijo de una casilla sin marcar", () => {
    expect(marked(toggleLinePrefix("task", at("|- [ ] pendiente|")))).toBe("|pendiente|");
  });

  it("task vuelve a marcar la casilla pendiente en lugar de quitarla", () => {
    expect(toggleLinePrefix("task", at("- [x] hecho")).text).toBe("- [ ] hecho");
  });

  it("respeta las líneas en blanco dentro de la selección", () => {
    expect(toggleLinePrefix("list", at("|a\n\nb|")).text).toBe("- a\n\n- b");
  });

  it("con todas las líneas en blanco sólo marca la primera", () => {
    expect(marked(toggleLinePrefix("list", at("|")))).toBe("- ||");
  });
});

describe("insertInlineCode", () => {
  it("sin selección inserta el ejemplo y lo deja seleccionado", () => {
    expect(marked(insertInlineCode(at("|")))).toBe("`|código|`");
  });

  it("envuelve la selección", () => {
    expect(marked(insertInlineCode(at("usa |esto| aquí")))).toBe("usa `|esto|` aquí");
  });

  it("alterna sobre un fragmento ya delimitado", () => {
    expect(marked(insertInlineCode(at("usa `|esto|` aquí")))).toBe("usa |esto| aquí");
  });
});

describe("insertLink", () => {
  it("sin selección inserta el ejemplo con el texto seleccionado", () => {
    expect(marked(insertLink(at("|")))).toBe("[|texto|](url)");
  });

  it("con selección deja el cursor en la url", () => {
    expect(marked(insertLink(at("|mi enlace|")))).toBe("[mi enlace](|url|)");
  });
});

describe("insertTable", () => {
  it("inserta una tabla GFM de 4 columnas y 3 filas", () => {
    const state = insertTable(at("|"));
    const lines = state.text.split("\n");
    expect(lines[0]).toBe("| Columna 1 | Columna 2 | Columna 3 | Columna 4 |");
    expect(lines[1]).toBe("| --- | --- | --- | --- |");
    expect(lines).toHaveLength(4);
    for (const line of lines.slice(2)) {
      expect(line).toBe("|  |  |  |  |");
    }
  });

  it("separa la tabla del texto que la rodea con una línea en blanco", () => {
    const state = insertTable(at("hola|"));
    expect(state.text.startsWith("hola\n\n| Columna 1 |")).toBe(true);
    expect(state.selectionStart).toBe(state.text.length);
  });
});

describe("insertMermaidFence", () => {
  it("inserta un bloque mermaid con un grafo mínimo", () => {
    const state = insertMermaidFence(at("|"));
    expect(state.text.startsWith("```mermaid\n")).toBe(true);
    expect(state.text).toContain("graph TD");
    expect(state.text.endsWith("```")).toBe(true);
  });
});

describe("applyFormat", () => {
  it("despacha cada botón a su función", () => {
    expect(marked(applyFormat("bold", at("|a|")))).toBe("**|a|**");
    expect(marked(applyFormat("task", at("|a|")))).toBe("- [ ] |a|");
    expect(marked(applyFormat("code", at("|a|")))).toBe("`|a|`");
    expect(applyFormat("table", at("|")).text).toContain("| --- |");
  });
});

describe("minimalChange", () => {
  it("describe el tramo mínimo que cambia entre dos textos", () => {
    expect(minimalChange("hola mundo", "hola **mundo**")).toEqual({
      from: 5,
      to: 10,
      insert: "**mundo**",
    });
  });

  it("no propone cambios cuando los textos son iguales", () => {
    expect(minimalChange("igual", "igual")).toEqual({ from: 5, to: 5, insert: "" });
  });
});
