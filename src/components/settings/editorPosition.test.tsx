/**
 * Posición del cursor en el `viewState` (ODD T6 · S6).
 *
 * La barra de estado lee «Ln X, Col Y» del estado de vista del documento. Este
 * archivo fija ese contrato sobre el doble de CodeMirror del editor (T3):
 * con preferencias de escritura —como monta la app— el payload incluye línea y
 * columna; sin ellas se conserva el payload histórico `{cursor, scrollTop}`.
 */

import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { EditorPane, type EditorConfig, type EditorPaneHandle } from "@/components/editor/EditorPane";
import { lastView, resetViews } from "@/components/editor/__fixtures__/codemirror-mock";

vi.mock(
  "@uiw/react-codemirror",
  async () => await import("@/components/editor/__fixtures__/codemirror-mock"),
);

const CONFIG: EditorConfig = {
  fontSize: 13,
  tabWidth: 2,
  lineNumbers: true,
  wordWrap: false,
  spellcheck: false,
};

function renderPane(editorConfig?: EditorConfig) {
  const onViewState = vi.fn();
  const ref = createRef<EditorPaneHandle>();
  render(
    <EditorPane
      ref={ref}
      doc={{ id: "doc-1", contents: "uno\ndos", viewState: {} }}
      theme="dark"
      onContents={vi.fn()}
      onViewState={onViewState}
      editorConfig={editorConfig}
    />,
  );
  return { onViewState };
}

describe("posición del cursor en el viewState", () => {
  beforeEach(() => resetViews());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("con configuración persiste línea y columna 1-based del cursor", () => {
    vi.useFakeTimers();
    const { onViewState } = renderPane(CONFIG);

    act(() => lastView().setSelection(6));
    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(onViewState).toHaveBeenCalledWith("doc-1", {
      cursor: 6,
      scrollTop: 0,
      line: 2,
      column: 3,
    });
  });

  it("sin configuración conserva el payload histórico de T3", () => {
    vi.useFakeTimers();
    const { onViewState } = renderPane();

    act(() => lastView().scrollTo(12));
    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(onViewState).toHaveBeenCalledWith("doc-1", { cursor: 0, scrollTop: 12 });
  });
});
