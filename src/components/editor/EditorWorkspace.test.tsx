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

  it("en modo Split reparte en dos paneles con un borde entre columnas", () => {
    const { container } = renderWorkspace("split");
    const editor = container.querySelector('[data-pane="editor"]');

    // La vista dividida es redimensionable: grupo + dos paneles + divisor.
    expect(container.querySelector('[data-slot="resizable-panel-group"]')).toBeInTheDocument();
    expect(container.querySelector('[data-slot="resizable-handle"]')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-slot="resizable-panel"]')).toHaveLength(2);
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

  // Regresión QA: sin esta cadena de alturas los paneles crecían con el
  // documento, el shell los recortaba y el scroll no funcionaba. En las vistas
  // de una sola columna la fila del grid debe estar acotada (grid-rows-1) y
  // cada panel debe poder encogerse.
  it("acota la fila y los paneles en las vistas de una sola columna", () => {
    const { container } = render(
      <EditorWorkspace
        doc={{ id: "d1", contents: "# hola\n\ntexto", viewState: {} }}
        theme="dark"
        mode="preview"
        onModeChange={() => {}}
        onContents={() => {}}
        onViewState={() => {}}
        preview={<p>preview</p>}
      />,
    );

    const panes = container.querySelector("[data-panes]");
    expect(panes?.className).toContain("grid-rows-1");
    expect(panes?.className).toContain("min-h-0");

    for (const pane of container.querySelectorAll("[data-pane]")) {
      expect(pane.className).toContain("min-h-0");
      expect(pane.className).toContain("overflow-hidden");
    }
  });

  it("acota el workspace para que el chrome del shell no se desplace", () => {
    const { container } = render(
      <EditorWorkspace
        doc={{ id: "d1", contents: "# hola", viewState: {} }}
        theme="dark"
        mode="editor"
        onModeChange={() => {}}
        onContents={() => {}}
        onViewState={() => {}}
        preview={<p>preview</p>}
      />,
    );

    // Regresión QA: si el workspace no recorta, el documento empuja la barra
    // de estado fuera de la ventana y sólo aparece al bajar del todo.
    const root = container.querySelector("[data-mode]");
    expect(root?.className).toContain("min-h-0");
    expect(root?.className).toContain("overflow-hidden");
  });

  // Vista dividida redimensionable: dos paneles y un divisor arrastrable que
  // avisa del nuevo reparto (el shell lo guarda por documento).
  it("monta paneles redimensionables en split y reporta el reparto", () => {
    const onSplitLayoutChange = vi.fn();
    const { container } = render(
      <EditorWorkspace
        doc={{ id: "d1", contents: "# hola", viewState: {} }}
        theme="dark"
        mode="split"
        onModeChange={() => {}}
        onContents={() => {}}
        onViewState={() => {}}
        preview={<p>preview</p>}
        onSplitLayoutChange={onSplitLayoutChange}
      />,
    );

    expect(container.querySelector('[data-slot="resizable-panel-group"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="resizable-handle"]')).not.toBeNull();
    expect(container.querySelectorAll('[data-slot="resizable-panel"]').length).toBe(2);
    // Los dos paneles siguen presentes con su cabecera.
    expect(screen.getByLabelText("Editor de Markdown")).toBeInTheDocument();
    expect(screen.getByLabelText("Vista previa")).toBeInTheDocument();
  });
});
