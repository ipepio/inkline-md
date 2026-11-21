import { describe, expect, it } from "vitest";
import { htmlExportFileName, markdownExportFileName, slugify } from "./names";

describe("htmlExportFileName", () => {
  it("cambia la extensión del documento por .html", () => {
    expect(htmlExportFileName("guia.md")).toBe("guia.html");
    expect(htmlExportFileName("notas.markdown")).toBe("notas.html");
    expect(htmlExportFileName("README.txt")).toBe("readme.html");
  });

  it("normaliza acentos, espacios y mayúsculas del título", () => {
    expect(htmlExportFileName("Guía rápida de Markdown.md")).toBe(
      "guia-rapida-de-markdown.html",
    );
  });

  it("usa un nombre por defecto cuando no hay título utilizable", () => {
    expect(htmlExportFileName("")).toBe("documento.html");
    expect(htmlExportFileName("   ")).toBe("documento.html");
    expect(htmlExportFileName(".md")).toBe("documento.html");
  });

  it("no deja componentes de ruta en el nombre propuesto", () => {
    expect(htmlExportFileName("../../etc/passwd.md")).toBe("etc-passwd.html");
    expect(slugify("a/b\\c")).toBe("a-b-c");
  });
});

describe("markdownExportFileName", () => {
  it("conserva el nombre original del documento", () => {
    expect(markdownExportFileName("Guía rápida.md")).toBe("Guía rápida.md");
  });

  it("añade la extensión .md cuando falta", () => {
    expect(markdownExportFileName("notas")).toBe("notas.md");
  });

  it("cae al nombre por defecto y nunca propone una ruta", () => {
    expect(markdownExportFileName("")).toBe("documento.md");
    expect(markdownExportFileName("../secreto.md")).toBe("secreto.md");
  });
});
