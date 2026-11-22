/**
 * Barra de pestañas dividida (ODD editor groups · T4 · S6).
 *
 * Los casos verifican el contrato del componente puro: una sección por grupo con
 * su divisor, el documento activo de CADA grupo, la marca de foco, la llamada a
 * la acción del grupo vacío y el flujo de cierre tal y como funciona hoy (una
 * sola llamada al cierre del almacén, con el id del documento).
 *
 * El caso que importa para S6 es el del clic: la pestaña entrega el grupo de SU
 * sección, no el grupo con foco, y no hay ninguna otra vía de selección. Ese es
 * el motivo de que las pestañas no pasen por el almacén (`selectDoc`), que
 * abriría el documento en el grupo enfocado.
 */

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { comboLabel } from "@/lib/platform";
import { TabsBar, type TabSection, type TabsBarProps } from "./TabsBar";

const GUIA = { id: "doc-a", name: "guia.md", dirty: false };
const NOTAS = { id: "doc-b", name: "notas.md", dirty: true };

const twoGroups: TabSection[] = [
  { groupId: "1", activeDocId: GUIA.id, docs: [GUIA, NOTAS] },
  { groupId: "2", activeDocId: NOTAS.id, docs: [GUIA, NOTAS] },
];

const emptyWord = `Vacío · ${comboLabel("O")} abre aquí`;

function setup(overrides: Partial<TabsBarProps> = {}) {
  const onSelectTab = vi.fn();
  const onFocusGroup = vi.fn();
  const onClose = vi.fn();
  const props: TabsBarProps = {
    sections: twoGroups,
    focusedGroupId: "1",
    onSelectTab,
    onFocusGroup,
    onClose,
    ...overrides,
  };
  const view = render(<TabsBar {...props} />);
  return { ...view, props, onSelectTab, onFocusGroup, onClose };
}

function section(index: number): HTMLElement {
  return screen.getByRole("group", { name: `Pestañas del grupo ${index}` });
}

describe("TabsBar dividida (S6)", () => {
  it("pinta una sección por grupo, separadas por un divisor visible", () => {
    const { container } = setup();

    const nav = screen.getByRole("navigation", { name: "Documentos abiertos" });
    expect(nav.querySelectorAll('[data-slot="tabs-section"]')).toHaveLength(2);
    // Un divisor entre secciones: nunca detrás de la última.
    expect(nav.querySelectorAll('[data-slot="tabs-divider"]')).toHaveLength(1);

    // Cada sección lista las pestañas de SU grupo.
    expect(within(section(1)).getByText("guia.md")).toBeInTheDocument();
    expect(within(section(1)).getByText("notas.md")).toBeInTheDocument();
    expect(within(section(2)).getByText("guia.md")).toBeInTheDocument();
    expect(within(section(2)).getByText("notas.md")).toBeInTheDocument();
    expect(container.querySelectorAll('[data-slot="tabs-section"][data-group="1"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-slot="tabs-section"][data-group="2"]')).toHaveLength(1);
  });

  it("resalta en cada sección el documento activo de su grupo", () => {
    setup();

    expect(within(section(1)).getByRole("button", { name: "guia.md" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(section(1)).getByRole("button", { name: "notas.md Cambios sin guardar" })).not.toHaveAttribute(
      "aria-current",
    );
    // El mismo documento puede estar activo en un grupo y no en el otro (S7).
    expect(within(section(2)).getByRole("button", { name: "notas.md Cambios sin guardar" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(section(2)).getByRole("button", { name: "guia.md" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("marca con el acento la sección del grupo con foco", () => {
    const { rerender, props } = setup();

    expect(section(1)).toHaveAttribute("data-focused", "true");
    expect(section(2)).not.toHaveAttribute("data-focused");
    expect(section(1).querySelector('[data-slot="tabs-focus-mark"]')).not.toBeNull();
    expect(section(2).querySelector('[data-slot="tabs-focus-mark"]')).toBeNull();

    rerender(<TabsBar {...props} focusedGroupId="2" />);

    expect(section(1)).not.toHaveAttribute("data-focused");
    expect(section(2)).toHaveAttribute("data-focused", "true");
    expect(section(2).querySelector('[data-slot="tabs-focus-mark"]')).not.toBeNull();
  });

  // S6 + el motivo de que las pestañas no pasen por el almacén: el grupo que se
  // entrega es el de la sección de la pestaña, no el que tiene el foco.
  it("el clic en una pestaña activa ese documento en SU grupo y lo enfoca", () => {
    const { onSelectTab, onFocusGroup } = setup();

    fireEvent.click(within(section(2)).getByRole("button", { name: "guia.md" }));

    expect(onSelectTab).toHaveBeenCalledTimes(1);
    expect(onSelectTab).toHaveBeenCalledWith("2", "doc-a");
    expect(onFocusGroup).toHaveBeenCalledWith("2");
  });

  it("al pulsar en una sección le da el foco a su grupo", () => {
    const { onFocusGroup, onSelectTab } = setup();

    fireEvent.pointerDown(section(2));

    expect(onFocusGroup).toHaveBeenCalledWith("2");
    expect(onSelectTab).not.toHaveBeenCalled();
  });

  it("el grupo vacío ofrece ⌘O y enfoca su grupo al pulsarla (S4)", () => {
    const { onFocusGroup, onSelectTab } = setup({
      sections: [
        { groupId: "1", activeDocId: null, docs: [] },
        { groupId: "2", activeDocId: NOTAS.id, docs: [NOTAS] },
      ],
      focusedGroupId: "2",
    });

    const chip = within(section(1)).getByRole("button", { name: emptyWord });
    expect(within(section(2)).queryByRole("button", { name: emptyWord })).toBeNull();

    fireEvent.click(chip);

    expect(onFocusGroup).toHaveBeenCalledWith("1");
    expect(onSelectTab).not.toHaveBeenCalled();
  });

  it("cierra con el mismo flujo del almacén: una llamada con el id del documento", () => {
    const { onClose, onSelectTab } = setup();

    fireEvent.click(within(section(1)).getByRole("button", { name: "Cerrar guia.md en el grupo 1" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledWith("doc-a");
    expect(onSelectTab).not.toHaveBeenCalled();
  });

  it("con el mismo documento en dos grupos, cada cruz se anuncia sin ambigüedad", () => {
    setup();

    expect(screen.getByRole("button", { name: "Cerrar guia.md en el grupo 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cerrar guia.md en el grupo 2" })).toBeInTheDocument();
  });

  it("con un solo grupo mantiene la barra y los nombres de siempre", () => {
    const { container } = setup({ sections: [twoGroups[0]] });

    expect(section(1)).toBeInTheDocument();
    expect(container.querySelectorAll('[data-slot="tabs-divider"]')).toHaveLength(0);
    // Sin ambigüedad posible, la cruz conserva su nombre accesible original.
    expect(screen.getByRole("button", { name: "Cerrar guia.md" })).toBeInTheDocument();
  });

  it("conserva el punto de cambios sin guardar del mockup", () => {
    setup();

    expect(
      within(section(1)).getByRole("button", { name: "notas.md Cambios sin guardar" }),
    ).toBeInTheDocument();
    expect(within(section(1)).getByText("Cambios sin guardar")).toHaveClass("sr-only");
  });
});
