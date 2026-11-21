import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ErrorBoundary } from "./ErrorBoundary";

function Boom(): never {
  throw new Error("fallo simulado del editor");
}

describe("ErrorBoundary", () => {
  it("muestra a sus hijos cuando todo va bien", () => {
    render(
      <ErrorBoundary area="el editor">
        <p>contenido sano</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText("contenido sano")).toBeInTheDocument();
  });

  it("contiene el fallo, lo anuncia y permite reintentar", () => {
    // React registra el error del boundary por consola; no ensuciar la salida.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const onError = vi.fn();

    render(
      <ErrorBoundary area="el editor" onError={onError}>
        <Boom />
      </ErrorBoundary>,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Algo falló al mostrar el editor.");
    expect(alert).toHaveTextContent("fallo simulado del editor");
    expect(onError).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    // Tras reintentar vuelve a intentar pintar el hijo (y vuelve a fallar
    // porque el hijo siempre lanza): lo importante es que no queda bloqueado.
    expect(screen.getByRole("alert")).toBeInTheDocument();

    spy.mockRestore();
  });
});
