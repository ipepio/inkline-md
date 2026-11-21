import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { FormatKind } from "@/lib/editor/format";
import { FormatToolbar } from "./FormatToolbar";

const BUTTONS: Array<[string, FormatKind]> = [
  ["Negrita (⌘B)", "bold"],
  ["Cursiva (⌘I)", "italic"],
  ["Tachado", "strike"],
  ["Título H2", "h2"],
  ["Enlace", "link"],
  ["Código en línea", "code"],
  ["Lista", "list"],
  ["Lista de tareas", "task"],
  ["Tabla", "table"],
  ["Diagrama Mermaid", "mermaid"],
];

afterEach(() => cleanup());

describe("FormatToolbar", () => {
  it("es una barra de herramientas con nombre accesible", () => {
    render(<FormatToolbar onFormat={() => {}} />);

    expect(screen.getByRole("toolbar", { name: "Formato de Markdown" })).toBeInTheDocument();
  });

  it.each(BUTTONS)("el botón «%s» aplica el formato %s", (label, kind) => {
    const onFormat = vi.fn();
    render(<FormatToolbar onFormat={onFormat} />);

    fireEvent.click(screen.getByRole("button", { name: label }));

    expect(onFormat).toHaveBeenCalledTimes(1);
    expect(onFormat).toHaveBeenCalledWith(kind);
  });

  it("separa los grupos con separadores y mantiene un solo tab stop", () => {
    const { container } = render(<FormatToolbar onFormat={() => {}} />);

    expect(screen.getAllByRole("separator")).toHaveLength(2);
    expect(screen.getAllByRole("group")).toHaveLength(3);

    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>("[data-tool]"));
    expect(buttons.filter((button) => button.tabIndex === 0)).toHaveLength(1);
    expect(buttons[0]).toHaveAttribute("tabindex", "0");
    expect(buttons[1]).toHaveAttribute("tabindex", "-1");
  });

  it("mueve el foco con las flechas sin salir de la barra", () => {
    const { container } = render(<FormatToolbar onFormat={() => {}} />);
    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>("[data-tool]"));

    buttons[0]?.focus();
    fireEvent.keyDown(buttons[0] as HTMLButtonElement, { key: "ArrowRight" });

    expect(buttons[1]).toHaveFocus();
    expect(buttons[1]).toHaveAttribute("tabindex", "0");
    expect(buttons[0]).toHaveAttribute("tabindex", "-1");
  });

  it("desactiva los botones sin sacarlos del foco cuando no hay editor", () => {
    const onFormat = vi.fn();
    render(<FormatToolbar onFormat={onFormat} disabled />);

    const button = screen.getByRole("button", { name: "Negrita (⌘B)" });
    expect(button).toHaveAttribute("aria-disabled", "true");

    fireEvent.click(button);
    expect(onFormat).not.toHaveBeenCalled();
  });
});
