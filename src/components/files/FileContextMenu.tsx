/**
 * Menú contextual propio de Inkline para archivos, carpetas y pestañas.
 *
 * Implementado según la guía `menu` de modern-web-guidance:
 * - Usa `focusgroup="menu nomemory"` y `<hr>` nativos como separadores; cuando
 *   el motor no soporta `focusgroup` (WKWebView/Safari, Firefox, jsdom), aplica
 *   el fallback con `role="menu"`/`role="menuitem"` y navegación por flechas,
 *   `Home`/`End`, `Escape` y `Tab` sin atrapar el foco.
 * - Posicionado en las coordenadas del puntero, acotado al viewport para no
 *   recortarse en los bordes, y restaura el foco al cerrar.
 */

import { Fragment, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  destructive?: boolean;
  separatorBefore?: boolean;
  onSelect: () => void;
}

export interface FileContextMenuState {
  x: number;
  y: number;
  label: string;
  items: ContextMenuItem[];
  returnFocusTo: HTMLElement | null;
}

export interface FileContextMenuProps {
  menu: FileContextMenuState | null;
  onClose: () => void;
}

const VIEWPORT_MARGIN = 8;

function supportsNativeFocusGroup(): boolean {
  return typeof HTMLElement !== "undefined" && "focusGroup" in HTMLElement.prototype;
}

function restoreFocus(target: HTMLElement | null, fromPointer: boolean): void {
  if (!target || !target.isConnected) return;
  try {
    target.focus(fromPointer ? ({ focusVisible: false } as FocusOptions) : undefined);
  } catch {
    target.focus();
  }
}

export function FileContextMenu({ menu, onClose }: FileContextMenuProps) {
  const groupRef = useRef<HTMLDivElement | null>(null);
  const [coords, setCoords] = useState<{ left: number; top: number } | null>(null);
  const nativeFocusGroup = supportsNativeFocusGroup();

  // Posiciona el menú junto al puntero sin salirse del viewport.
  useLayoutEffect(() => {
    if (!menu) {
      setCoords(null);
      return;
    }
    const el = groupRef.current;
    const width = el?.offsetWidth || 220;
    const height = el?.offsetHeight || 160;
    const maxLeft = Math.max(VIEWPORT_MARGIN, window.innerWidth - width - VIEWPORT_MARGIN);
    const maxTop = Math.max(VIEWPORT_MARGIN, window.innerHeight - height - VIEWPORT_MARGIN);
    setCoords({
      left: Math.min(Math.max(VIEWPORT_MARGIN, menu.x), maxLeft),
      top: Math.min(Math.max(VIEWPORT_MARGIN, menu.y), maxTop),
    });
  }, [menu]);

  // Cierre por clic fuera, pérdida de foco o redimensionado.
  useEffect(() => {
    if (!menu) return;

    function closeWithPointer() {
      const target = menu?.returnFocusTo ?? null;
      onClose();
      restoreFocus(target, true);
    }

    function onPointerDown(event: PointerEvent) {
      if (groupRef.current?.contains(event.target as Node)) return;
      closeWithPointer();
    }

    function onFocusIn(event: FocusEvent) {
      if (groupRef.current?.contains(event.target as Node)) return;
      onClose();
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        const target = menu?.returnFocusTo ?? null;
        onClose();
        restoreFocus(target, false);
        return;
      }
      if (event.key === "Tab") {
        onClose();
      }
    }

    window.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("focusin", onFocusIn);
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("resize", closeWithPointer);
    window.addEventListener("blur", closeWithPointer);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("focusin", onFocusIn);
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("resize", closeWithPointer);
      window.removeEventListener("blur", closeWithPointer);
    };
  }, [menu, onClose]);

  // Fallback de teclado cuando `focusgroup` nativo no existe (WKWebView/Firefox/jsdom).
  useEffect(() => {
    if (!menu || nativeFocusGroup) return;
    const group = groupRef.current;
    if (!group) return;

    function onKeyDown(event: KeyboardEvent) {
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
      const items = Array.from(group?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []);
      if (items.length === 0) return;
      const current = items.indexOf(document.activeElement as HTMLButtonElement);
      let next: number;
      if (event.key === "Home") {
        next = 0;
      } else if (event.key === "End") {
        next = items.length - 1;
      } else if (current < 0) {
        next = event.key === "ArrowUp" ? items.length - 1 : 0;
      } else {
        next = (current + (event.key === "ArrowUp" ? -1 : 1) + items.length) % items.length;
      }
      event.preventDefault();
      event.stopPropagation();
      items[next].focus({ preventScroll: true });
    }

    group.addEventListener("keydown", onKeyDown, true);
    return () => group.removeEventListener("keydown", onKeyDown, true);
  }, [menu, nativeFocusGroup]);

  if (!menu) return null;

  const position = coords ?? { left: menu.x, top: menu.y };

  return (
    <div
      ref={groupRef}
      data-slot="file-context-menu"
      aria-label={menu.label}
      {...({ focusgroup: "menu nomemory" } as Record<string, string>)}
      role={nativeFocusGroup ? undefined : "menu"}
      onContextMenu={(event) => event.preventDefault()}
      style={{ left: `${position.left}px`, top: `${position.top}px` }}
      className="fixed z-50 min-w-[200px] rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg ring-1 ring-foreground/10 outline-none"
    >
      {menu.items.map((item) => (
        <Fragment key={item.id}>
          {item.separatorBefore ? <hr className="-mx-1 my-1 border-0 border-t border-border" /> : null}
          <button
            type="button"
            disabled={item.disabled}
            role={nativeFocusGroup ? undefined : "menuitem"}
            onPointerMove={(event) => {
              if (item.disabled) return;
              const target = event.currentTarget;
              if (document.activeElement !== target) {
                try {
                  target.focus({ focusVisible: false } as FocusOptions);
                } catch {
                  target.focus();
                }
              }
            }}
            onClick={(event) => {
              if (item.disabled) return;
              const fromPointer = event.detail !== 0;
              const returnTarget = menu.returnFocusTo;
              onClose();
              item.onSelect();
              restoreFocus(returnTarget, fromPointer);
            }}
            className={
              item.destructive
                ? "flex w-full cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-destructive outline-none select-none hover:bg-destructive/10 focus:bg-destructive/10 disabled:pointer-events-none disabled:opacity-50"
                : "flex w-full cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-popover-foreground outline-none select-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
            }
          >
            <span aria-hidden className="grid size-3.5 shrink-0 place-items-center text-muted-foreground">
              {item.icon}
            </span>
            <span className="truncate">{item.label}</span>
          </button>
        </Fragment>
      ))}
    </div>
  );
}
