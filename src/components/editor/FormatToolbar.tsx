/**
 * Barra de formato de Inkline (ODD T3 / S4 · S6).
 *
 * Los diez controles del `.toolbar` del mockup, agrupados por tema y separados
 * con `.sep`. Cada botón es una acción única sobre el editor (no guarda estado
 * propio: el formato se aplica sobre la selección real), así que no llevan
 * `aria-pressed`; el estado deshabilitado usa `aria-disabled` para no sacarlos
 * del recorrido de teclado.
 *
 * La barra es un `role="toolbar"` con `focusgroup` nativo y un recorrido de
 * teclado propio cuando el motor aún no lo soporta (WKWebView del runtime Tauri).
 */

import { useEffect, useRef } from "react";
import { Code2Icon, Link2Icon, type LucideIcon } from "lucide-react";
import { cn } from "cn";
import type { FormatKind } from "@/lib/editor/format";

export interface FormatToolbarProps {
  onFormat: (kind: FormatKind) => void;
  /** En modo sólo vista previa no hay editor que formatear. */
  disabled?: boolean;
}

interface Tool {
  kind: FormatKind;
  label: string;
  title: string;
  glyph?: string;
  Icon?: LucideIcon;
  className?: string;
}

interface ToolGroup {
  label: string;
  tools: readonly Tool[];
}

const GROUPS: readonly ToolGroup[] = [
  {
    label: "Énfasis",
    tools: [
      { kind: "bold", label: "Negrita (⌘B)", title: "Negrita (⌘B)", glyph: "B", className: "font-bold" },
      {
        kind: "italic",
        label: "Cursiva (⌘I)",
        title: "Cursiva (⌘I)",
        glyph: "I",
        className: "font-bold italic",
      },
      {
        kind: "strike",
        label: "Tachado",
        title: "Tachado",
        glyph: "S",
        className: "font-bold line-through",
      },
    ],
  },
  {
    label: "Bloques en línea",
    tools: [
      { kind: "h2", label: "Título H2", title: "Título H2", glyph: "H2" },
      { kind: "link", label: "Enlace", title: "Enlace", Icon: Link2Icon },
      { kind: "code", label: "Código en línea", title: "Código en línea", Icon: Code2Icon },
    ],
  },
  {
    label: "Estructura",
    tools: [
      { kind: "list", label: "Lista", title: "Lista", glyph: "☷" },
      { kind: "task", label: "Lista de tareas", title: "Lista de tareas", glyph: "☑" },
      { kind: "table", label: "Tabla", title: "Tabla", glyph: "▦" },
      { kind: "mermaid", label: "Diagrama Mermaid", title: "Diagrama Mermaid", glyph: "◇" },
    ],
  },
];

/**
 * Recorrido de teclado con un único tab stop cuando `focusgroup` no existe
 * (Safari / WKWebView). El navegador que sí lo soporta no entra aquí.
 */
function useRovingFocus(barRef: React.RefObject<HTMLDivElement | null>): void {
  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    if ("focusGroup" in HTMLElement.prototype) return;

    const items = (): HTMLButtonElement[] =>
      Array.from(bar.querySelectorAll<HTMLButtonElement>("[data-tool]"));

    const activate = (active: HTMLButtonElement | null): void => {
      for (const item of items()) item.tabIndex = item === active ? 0 : -1;
    };

    activate(items()[0] ?? null);

    const onFocusIn = (event: FocusEvent): void => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest?.("[data-tool]");
      if (button instanceof HTMLButtonElement) activate(button);
    };

    const onKeyDown = (event: KeyboardEvent): void => {
      const list = items();
      const index = list.indexOf(event.target as HTMLButtonElement);
      if (index < 0 || list.length === 0) return;
      const rtl = getComputedStyle(bar).direction === "rtl";
      const step = rtl ? -1 : 1;
      let next: number;
      switch (event.key) {
        case "ArrowRight":
          next = (index + step + list.length) % list.length;
          break;
        case "ArrowLeft":
          next = (index - step + list.length) % list.length;
          break;
        case "Home":
          next = 0;
          break;
        case "End":
          next = list.length - 1;
          break;
        default:
          return;
      }
      event.preventDefault();
      activate(list[next] ?? null);
      list[next]?.focus();
    };

    bar.addEventListener("focusin", onFocusIn);
    bar.addEventListener("keydown", onKeyDown);
    return () => {
      bar.removeEventListener("focusin", onFocusIn);
      bar.removeEventListener("keydown", onKeyDown);
    };
  }, [barRef]);
}

const TOOL_BUTTON =
  "grid h-[31px] min-w-[31px] place-items-center rounded-[6px] px-1 text-[12px] font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none aria-disabled:opacity-40 aria-disabled:hover:bg-transparent";

export function FormatToolbar({ onFormat, disabled = false }: FormatToolbarProps) {
  const barRef = useRef<HTMLDivElement>(null);
  useRovingFocus(barRef);

  return (
    <div
      ref={barRef}
      role="toolbar"
      aria-label="Formato de Markdown"
      aria-disabled={disabled || undefined}
      {...({ focusgroup: "toolbar wrap" } as Record<string, string>)}
      className="flex items-center gap-[3px]"
    >
      {GROUPS.map((group, groupIndex) => (
        <fieldset
          key={group.label}
          aria-label={group.label}
          className="flex min-w-0 items-center gap-[3px]"
        >
          {groupIndex > 0 ? (
            <hr aria-orientation="vertical" className="mx-2 h-[18px] w-px border-0 bg-border" />
          ) : null}
          {group.tools.map(({ kind, label, title, glyph, Icon, className }) => (
            <button
              key={kind}
              type="button"
              data-tool={kind}
              aria-label={label}
              title={title}
              aria-disabled={disabled ? "true" : undefined}
              onClick={disabled ? undefined : () => onFormat(kind)}
              className={cn(TOOL_BUTTON, className)}
            >
              {Icon ? <Icon aria-hidden className="size-3.5" /> : glyph}
            </button>
          ))}
        </fieldset>
      ))}
    </div>
  );
}
