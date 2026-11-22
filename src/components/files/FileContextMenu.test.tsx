import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { FileContextMenu, type FileContextMenuState } from "./FileContextMenu";

function sampleMenu(onOpen = vi.fn(), onReveal = vi.fn()): FileContextMenuState {
  return {
    x: 120,
    y: 80,
    label: "Acciones para notas.md",
    returnFocusTo: null,
    items: [
      { id: "open", label: "Abrir", onSelect: onOpen },
      { id: "reveal", label: "Mostrar en Finder", separatorBefore: true, onSelect: onReveal },
    ],
  };
}

describe("FileContextMenu", () => {
  it("renderiza los comandos, el separador nativo y ejecuta la acción elegida", () => {
    const onOpen = vi.fn();
    const onReveal = vi.fn();
    const onClose = vi.fn();

    render(<FileContextMenu menu={sampleMenu(onOpen, onReveal)} onClose={onClose} />);

    expect(screen.getByRole("menu", { name: "Acciones para notas.md" })).toBeInTheDocument();
    expect(screen.getByRole("separator")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("menuitem", { name: "Mostrar en Finder" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onReveal).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("navega con flechas y cierra con Escape", () => {
    const onClose = vi.fn();
    render(<FileContextMenu menu={sampleMenu()} onClose={onClose} />);

    const openItem = screen.getByRole("menuitem", { name: "Abrir" });
    const revealItem = screen.getByRole("menuitem", { name: "Mostrar en Finder" });

    openItem.focus();
    fireEvent.keyDown(openItem, { key: "ArrowDown" });
    expect(document.activeElement).toBe(revealItem);

    fireEvent.keyDown(revealItem, { key: "Home" });
    expect(document.activeElement).toBe(openItem);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
