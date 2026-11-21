import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "./App";

vi.mock("@/lib/files", () => ({
  openTextFile: vi.fn().mockResolvedValue(null),
  saveTextFile: vi.fn().mockResolvedValue(undefined),
  saveTextFileAs: vi.fn().mockResolvedValue(null),
}));

describe("App (esqueleto T1)", () => {
  it("muestra el editor y las acciones abrir/guardar", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: /Inkline/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Abrir" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar" })).toBeInTheDocument();
    expect(screen.getByLabelText("Editor de Markdown")).toBeInTheDocument();
  });
});
