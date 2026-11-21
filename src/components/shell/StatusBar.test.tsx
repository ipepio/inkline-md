import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { StatusBar } from "./StatusBar";

afterEach(() => cleanup());

describe("StatusBar", () => {
  it("muestra archivo, posición, estadísticas y la marca local del mockup", () => {
    render(
      <StatusBar
        fileName="README.md"
        line={4}
        column={12}
        words={128}
        lines={9}
        status="Guardado"
      />,
    );

    expect(screen.getByText("README.md")).toBeInTheDocument();
    expect(screen.getByText("Ln 4, Col 12")).toBeInTheDocument();
    expect(screen.getByText("128 palabras · 9 líneas")).toBeInTheDocument();
    expect(screen.getByText("Markdown")).toBeInTheDocument();
    expect(screen.getByText("LOCAL")).toBeInTheDocument();
    expect(screen.getByText("Guardado")).toBeInTheDocument();
  });

  it("oculta la posición cuando no hay cursor conocido", () => {
    render(<StatusBar fileName="notas.md" words={0} lines={1} status="" />);

    expect(screen.queryByText(/^Ln /)).not.toBeInTheDocument();
    expect(screen.getByText("0 palabras · 1 líneas")).toBeInTheDocument();
  });

  it("sin documento abierto muestra el estado vacío", () => {
    render(<StatusBar fileName={null} words={0} lines={1} status="Listo" />);

    expect(screen.getByText("Sin documento")).toBeInTheDocument();
  });
});
