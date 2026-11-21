/**
 * Nombres de archivo propuestos al exportar (ODD T5 · S4 «Exportación»).
 *
 * Helpers puros: el título del documento nunca llega al diálogo del sistema tal
 * cual. Se recortan los componentes de ruta y se normaliza el nombre para que
 * macOS/Windows no reciban separadores ni acentos problemáticos.
 */

/** Nombre usado cuando el título no aporta nada utilizable. */
const FALLBACK_STEM = "documento";

/** Extensiones que se consideran «ya tiene extensión Markdown». */
const MARKDOWN_EXTENSION = /\.(md|markdown|mdown|txt)$/i;

/** Slug ASCII: «Guía rápida.md» → «guia-rapida». */
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Último segmento del título, sin separadores de ruta. */
function baseNameOf(title: string): string {
  return title.trim().split(/[\\/]/).filter(Boolean).pop() ?? "";
}

/** «guia.md» → «guia.html»; el HTML exportado se nombra como el documento. */
export function htmlExportFileName(title: string): string {
  const stem = slugify(title.trim().replace(MARKDOWN_EXTENSION, ""));
  return `${stem || FALLBACK_STEM}.html`;
}

/** «Guía rápida.md» → «Guía rápida.md» (copia del original, sin renombrar). */
export function markdownExportFileName(title: string): string {
  const base = baseNameOf(title);
  const name = base === "" || base === "." || base === ".." ? FALLBACK_STEM : base;
  return MARKDOWN_EXTENSION.test(name) ? name : `${name}.md`;
}
