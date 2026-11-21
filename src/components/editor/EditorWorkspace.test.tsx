import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { EditorWorkspace, type EditorWorkspaceHandle } from "./EditorWorkspace";
import { lastView, resetViews } from "./__fixtures__/codemirror-mock";
import type { WorkspaceMode } from "@/lib/editor/mode";

vi.mock("@uiw/react-codemirror", async () => await import("./__fixtures__/codemirror-mock"));

const DOC = { id: "doc-1", contents: "hola mundo", viewState: {} };

function renderWorkspace(mode: WorkspaceMode) {
  const props = {
    doc: DOC,
    theme: "dark" as const,
    mode,
    onModeChange: vi.fn(),
    onContents: vi.fn(),
    onViewState: vi.fn(),
    preview: <p>contenido renderizado</p>,
  };
  const ref = createRef<EditorWorkspaceHandle>();
  const utils = render(<EditorWorkspace ref={ref} {...props} />);
  return { ...utils, props, ref };
}

describe("EditorWorkspace", () => {
  beforeEach(() => resetViews());
  afterEach(() => cleanup());

  it("en modo Editor muestra sólo la columna del editor", () => {
    const { container } = renderWorkspace("editor");

    expect(container.querySelector('[data-pane="editor"]')).toBeInTheDocument();
    expect(container.querySelector('[data-pane="preview"]')).not.toBeInTheDocument();
    expect(screen.queryByText("contenido renderizado")).not.toBeInTheDocument();
  });

  it("en modo Split reparte 50/50 con un borde entre columnas", () => {
    const { container } = renderWorkspace("split");
    const panes = container.querySelector('[data-panes]');
    const editor = container.querySelector('[data-pane="editor"]');

    expect(panes).toHaveAttribute(
      "data-panes",
      "grid-cols-[minmax(0,1fr)_minmax(0,1fr)]",
    );
    expect(editor).toHaveClass("border-r");
    expect(screen.getByText("contenido renderizado")).toBeInTheDocument();
  });

  it("en modo Preview muestra sólo la vista previa", () => {
    const { container } = renderWorkspace("preview");

    expect(container.querySelector('[data-pane="editor"]')).not.toBeInTheDocument();
    expect(screen.getByText("contenido renderizado")).toBeInTheDocument();
  });

  it("cambia de vista desde el control segmentado", () => {
    const { props } = renderWorkspace("split");

    fireEvent.click(screen.getByRole("button", { name: "Editor" }));

    expect(props.onModeChange).toHaveBeenCalledWith("editor");
  });

  it("reenvía applyFormat del ref al panel del editor", () => {
    const { ref } = renderWorkspace("split");
    const view = lastView();
    view.setSelection(0, 4);

    act(() => ref.current?.applyFormat("italic"));

    expect(view.text()).toBe("*hola* mundo");
    expect(view.dispatches[0]).toMatchObject({ selection: { anchor: 1, head: 5 } });
  });

  it("desactiva la barra de formato cuando no hay editor a la vista", () => {
    renderWorkspace("preview");

    expect(screen.getByRole("button", { name: "Negrita (⌘B)" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });
});
