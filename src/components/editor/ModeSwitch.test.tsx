import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ModeSwitch } from "./ModeSwitch";

afterEach(() => cleanup());

describe("ModeSwitch", () => {
  it("ofrece las tres vistas del mockup", () => {
    render(<ModeSwitch mode="split" onModeChange={() => {}} />);

    expect(screen.getByRole("button", { name: "Editor" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Split" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Preview" })).toBeInTheDocument();
  });

  it("marca la vista activa con aria-pressed", () => {
    render(<ModeSwitch mode="split" onModeChange={() => {}} />);

    expect(screen.getByRole("button", { name: "Split" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Editor" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Preview" })).toHaveAttribute("aria-pressed", "false");
  });

  it("avisa del cambio de vista", () => {
    const onModeChange = vi.fn();
    render(<ModeSwitch mode="editor" onModeChange={onModeChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Preview" }));

    expect(onModeChange).toHaveBeenCalledWith("preview");
  });
});
