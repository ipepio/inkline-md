import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { EditorPane, type EditorPaneHandle } from "./EditorPane";
import { lastView, resetViews } from "./__fixtures__/codemirror-mock";

vi.mock("@uiw/react-codemirror", async () => await import("./__fixtures__/codemirror-mock"));

function renderPane(overrides: Partial<Parameters<typeof EditorPane>[0]> = {}) {
  const props = {
    doc: { id: "doc-1", contents: "hola mundo", viewState: {} },
    theme: "dark" as const,
    onContents: vi.fn(),
    onViewState: vi.fn(),
    ...overrides,
  };
  const ref = createRef<EditorPaneHandle>();
  const utils = render(<EditorPane ref={ref} {...props} />);
  return { ...utils, props, ref };
}

describe("EditorPane", () => {
  beforeEach(() => resetViews());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("propaga la edición con el id del documento", () => {
    const { props } = renderPane();

    act(() => lastView().type("hola mundo editado"));

    expect(props.onContents).toHaveBeenCalledWith("doc-1", "hola mundo editado");
  });

  it("aplica un formato sobre la selección actual y recoloca la selección", () => {
    const { props, ref } = renderPane();
    const view = lastView();
    view.setSelection(5, 10);

    act(() => ref.current?.applyFormat("bold"));

    expect(view.text()).toBe("hola **mundo**");
    expect(view.dispatches[0]).toMatchObject({
      changes: { from: 5, to: 10, insert: "**mundo**" },
      selection: { anchor: 7, head: 12 },
    });
    expect(props.onContents).toHaveBeenCalledWith("doc-1", "hola **mundo**");
  });

  it("aplica formato de bloque sobre el cursor sin selección", () => {
    const { ref } = renderPane();
    const view = lastView();
    view.setSelection(0);

    act(() => ref.current?.applyFormat("list"));

    expect(view.text()).toBe("- hola mundo");
  });

  it("restaura cursor y desplazamiento guardados al montar", () => {
    const { props } = renderPane({
      doc: { id: "doc-1", contents: "hola mundo", viewState: { cursor: 4, scrollTop: 24 } },
    });
    const view = lastView();

    expect(view.dispatches[0]).toMatchObject({ selection: { anchor: 4 }, scrollIntoView: false });
    expect(view.scrollDOM.scrollTop).toBe(24);
    expect(props.onViewState).not.toHaveBeenCalled();
  });

  it("guarda cursor y desplazamiento sin escribir en cada pulsación", () => {
    vi.useFakeTimers();
    const { props } = renderPane();

    const view = lastView();
    view.scrollTo(20);
    view.scrollTo(40);

    expect(props.onViewState).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(props.onViewState).toHaveBeenCalledTimes(1);
    expect(props.onViewState).toHaveBeenCalledWith("doc-1", { cursor: 0, scrollTop: 40 });
  });

  it("ignora un viewState ilegible", () => {
    const { props } = renderPane({
      doc: { id: "doc-1", contents: "hola", viewState: { cursor: "no-es-un-numero" } },
    });
    const view = lastView();

    expect(view.dispatches).toHaveLength(0);
    expect(view.scrollDOM.scrollTop).toBe(0);
    expect(props.onContents).not.toHaveBeenCalled();
  });
});
