import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ConfirmCloseDialog } from "./ConfirmCloseDialog";

// Mismos stubs que el resto de popups de `ui/` en jsdom (medición + foco).
beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("PointerEvent", class PointerEvent extends MouseEvent {});
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
});

afterEach(() => cleanup());

function renderDialog() {
  const props = { open: true, docName: "guia.md", onConfirm: vi.fn(), onCancel: vi.fn() };
  const utils = render(<ConfirmCloseDialog {...props} />);
  return { ...utils, props };
}

describe("ConfirmCloseDialog", () => {
  it("nombra el documento en la pregunta", () => {
    renderDialog();

    expect(screen.getByText("¿Cerrar «guia.md» sin guardar?")).toBeInTheDocument();
    expect(screen.getByText(/cambios sin guardar/i)).toBeInTheDocument();
  });

  it("cierra sin guardar cuando se confirma", () => {
    const { props } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Cerrar sin guardar" }));

    expect(props.onConfirm).toHaveBeenCalledTimes(1);
    expect(props.onCancel).not.toHaveBeenCalled();
  });

  it("cancelar no cierra el documento", () => {
    const { props } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(props.onCancel).toHaveBeenCalledTimes(1);
    expect(props.onConfirm).not.toHaveBeenCalled();
  });

  it("no se muestra cuando está cerrado", () => {
    render(<ConfirmCloseDialog open={false} docName="guia.md" onConfirm={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.queryByText(/sin guardar/)).not.toBeInTheDocument();
  });
});
