/**
 * Modo visualización de Inkline (ODD T2 / S2 · S4 · S6).
 *
 * Doble fase, por diseño:
 * 1. `renderToHtmlSync` (memo síncrono) → el documento se lee de inmediato, en la
 *    misma pintura en que se monta el componente.
 * 2. `renderToHtml` (Shiki) + `hydrateDiagrams` (Mermaid) tras montar → mejoran el
 *    resultado sin bloquear ni interrumpir la escritura del editor.
 *
 * El HTML se inserta con `DOMParser` + `importNode` en lugar de `innerHTML` o
 * `dangerouslySetInnerHTML`: el contenido ya viene escapado por el pipeline
 * (`html: false`), y así ninguna API de inyección directa toca el contenido.
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { cn } from "cn";
import { hydrateDiagrams } from "@/lib/markdown/diagrams";
import { renderToHtml, renderToHtmlSync, type ThemeMode } from "@/lib/markdown/render";

export interface MarkdownViewProps {
  markdown: string;
  /** Tema activo: decide el par de temas de Shiki y el tema de Mermaid. */
  theme?: ThemeMode;
  /** Tamaño base del texto de lectura en píxeles; ausente, el CSS usa 13px. */
  fontSize?: number;
  className?: string;
}

interface EnhancedHtml {
  markdown: string;
  theme: ThemeMode;
  html: string;
}

/** Nodos importables desde un documento HTML inerte (sin ejecutar scripts). */
function parseFragment(html: string): Node[] {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  return Array.from(parsed.body.childNodes, (node) => document.importNode(node, true));
}

export function MarkdownView({ markdown, theme = "dark", className, fontSize }: MarkdownViewProps) {
  const containerRef = useRef<HTMLElement | null>(null);
  const syncHtml = useMemo(() => renderToHtmlSync(markdown), [markdown]);
  const [enhanced, setEnhanced] = useState<EnhancedHtml | null>(null);

  const html =
    enhanced && enhanced.markdown === markdown && enhanced.theme === theme ? enhanced.html : syncHtml;

  // Pintura del HTML antes de que el navegador muestre el frame.
  useLayoutEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    node.replaceChildren(...parseFragment(html));
  }, [html]);

  // Enriquecido: resaltado de código asíncrono, nunca bloqueante.
  useEffect(() => {
    let cancelled = false;
    void renderToHtml(markdown, { theme })
      .then((nextHtml) => {
        if (!cancelled) setEnhanced({ markdown, theme, html: nextHtml });
      })
      .catch(() => {
        // El HTML estático ya está en pantalla: el fallo no rompe la lectura.
      });
    return () => {
      cancelled = true;
    };
  }, [markdown, theme]);

  // Post-proceso de diagramas sobre el DOM ya montado.
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const controller = new AbortController();
    void hydrateDiagrams(node, { theme, signal: controller.signal });
    return () => controller.abort();
  }, [html, theme]);

return (
    <article
      ref={containerRef}
      className={cn("inkline-readable", className)}
      style={fontSize === undefined ? undefined : { fontSize: `${fontSize}px` }}
    />
  );
}
