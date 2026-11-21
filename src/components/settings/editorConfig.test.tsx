/**
 * Contrato de configuración del editor (ODD T6 · S4).
 *
 * Vive junto a la ventana de preferencias porque es quien alimenta estas
 * opciones (`editorFontSize`, `tabWidth`, `lineNumbers`, `wordWrap`,
 * `spellcheck`). El doble de `@uiw/react-codemirror` es propio de este archivo:
 * captura los props que el envoltorio entrega al editor real, que es justo lo
 * que hay que verificar aquí.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { EditorView } from "@uiw/react-codemirror";
import { EditorWorkspace } from "@/components/editor/EditorWorkspace";
import type { EditorConfig } from "@/components/editor/EditorPane";

const cm = vi.hoisted(() => ({ props: [] as Record<string, unknown>[] }));

vi.mock("@uiw/react-codemirror", async () => {
  const React = await import("react");
  const CodeMirror = (props: Record<string, unknown>) => {
    cm.props.push(props);
    return React.createElement("div", { "data-testid": "codemirror-mock" });
  };
  return {
    default: CodeMirror,
    EditorView: {
      theme: (spec: unknown) => ({ theme: spec }),
      lineWrapping: { lineWrapping: true },
    },
    EditorState: { tabSize: { of: (size: number) => ({ tabSize: size }) } },
  };
});

function renderWorkspace(editorConfig?: EditorConfig) {
  return render(
    <EditorWorkspace
      doc={{ id: "doc-1", contents: "hola mundo", viewState: {} }}
      theme="dark"
      mode="editor"
      onModeChange={vi.fn()}
      onContents={vi.fn()}
      onViewState={vi.fn()}
      editorConfig={editorConfig}
    />,
  );
}

/** Extensiones de tema que se pasan al editor (la última pinta la métrica). */
function themeSpecs(extensions: unknown[]): string[] {
  return extensions
    .filter(
      (extension): extension is { theme: unknown } =>
        typeof extension === "object" && extension !== null && "theme" in extension,
    )
    .map((extension) => JSON.stringify(extension.theme));
}

/** Tamaños de tabulador declarados como extensión. */
function tabSizes(extensions: unknown[]): number[] {
  return extensions
    .filter(
      (extension): extension is { tabSize: number } =>
        typeof extension === "object" && extension !== null && "tabSize" in extension,
    )
    .map((extension) => extension.tabSize);
}

function lastProps(): Record<string, unknown> {
  const props = cm.props[cm.props.length - 1];
  if (!props) throw new Error("El editor simulado aún no se ha montado");
  return props;
}

describe("configuración del editor", () => {
  beforeEach(() => {
    cm.props.length = 0;
  });

  afterEach(() => cleanup());

  it("sin configuración conserva los valores por defecto del panel", () => {
    renderWorkspace();

    const props = lastProps();
    const extensions = props.extensions as unknown[];

    expect(props.spellCheck).toBe(false);
    expect(props.basicSetup).toMatchObject({ lineNumbers: true });
    expect(tabSizes(extensions)).toEqual([2]);
    expect(extensions).not.toContain(EditorView.lineWrapping);
    // Sin preferencias no hay extensión de métrica: sólo el tema del editor.
    expect(themeSpecs(extensions)).toHaveLength(1);
  });

  it("con configuración aplica tabulación, líneas, corrector y ajuste de línea", () => {
    renderWorkspace({
      fontSize: 15,
      tabWidth: 4,
      lineNumbers: false,
      wordWrap: true,
      spellcheck: true,
    });

    const props = lastProps();
    const extensions = props.extensions as unknown[];

    expect(props.spellCheck).toBe(true);
    expect(props.basicSetup).toMatchObject({ lineNumbers: false });
    expect(tabSizes(extensions)).toEqual([4]);
    expect(extensions).toContain(EditorView.lineWrapping);
    expect(themeSpecs(extensions).some((spec) => spec.includes("15px"))).toBe(true);
  });
});
