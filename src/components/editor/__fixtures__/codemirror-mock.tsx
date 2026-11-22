/**
 * Doble de `@uiw/react-codemirror` para las pruebas de T3 y T6.
 *
 * jsdom no maqueta el layout del que CodeMirror depende (medidas, selección,
 * `scrollTop` real), así que las pruebas del contenedor verifican el contrato
 * del envoltorio —props, ref imperativo y estado de vista— sobre esta
 * implementación mínima: un `EditorView` de mentira que aplica los cambios que
 * recibe y avisa a `onChange` como haría el editor real.
 *
 * Uso en una prueba:
 *   vi.mock("@uiw/react-codemirror", async () => await import("./__fixtures__/codemirror-mock"));
 */

import { forwardRef, useEffect, useImperativeHandle, useMemo } from "react";
import { vi } from "vitest";

interface FakeChange {
  from: number;
  to: number;
  insert: string;
}

interface FakeSelection {
  anchor: number;
  head: number;
}

interface FakeTransaction {
  changes?: FakeChange;
  selection?: FakeSelection;
  scrollIntoView?: boolean;
}

interface FakeScrollDOM {
  scrollTop: number;
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
}

export interface FakeView {
  readonly state: {
    doc: { toString: () => string; length: number };
    selection: { main: { from: number; to: number; anchor: number; head: number } };
  };
  dispatch: (transaction: FakeTransaction) => void;
  focus: () => void;
  scrollDOM: FakeScrollDOM;
  /** Texto actual del documento simulado. */
  text: () => string;
  /** Mueve la selección del editor simulado. */
  setSelection: (from: number, to?: number) => void;
  /** Emula que la persona escribe y dispara `onChange` como el editor real. */
  type: (text: string) => void;
  /**
   * Aplica un `value` que llega de fuera SIN disparar `onChange`, igual que
   * `@uiw/react-codemirror` cuando cambia la prop `value` (si reemitiese el
   * cambio, el shell escribiría en el almacén lo que acaba de leer). Es lo que
   * hace converger dos vistas del MISMO documento (S7).
   */
  applyValue: (next: string) => void;
  /** Emula el desplazamiento del panel para probar la persistencia. */
  scrollTo: (top: number) => void;
  dispatches: FakeTransaction[];
}

interface MockCodeMirrorProps {
  value?: string;
  onChange?: (value: string) => void;
  onCreateEditor?: (view: FakeView, state: unknown) => void;
  onUpdate?: (update: { docChanged: boolean; selectionSet: boolean }) => void;
}

/** Vistas creadas, en orden de montaje; las pruebas miran la última. */
export const createdViews: FakeView[] = [];

export function lastView(): FakeView {
  const view = createdViews[createdViews.length - 1];
  if (!view) throw new Error("El editor simulado aún no se ha montado");
  return view;
}

export function resetViews(): void {
  createdViews.length = 0;
}

/**
 * Vistas por nodo montado. Permite localizar el editor de una región concreta
 * de la interfaz (un grupo de edición) sin depender del orden de montaje.
 */
const nodeViews = new WeakMap<Element, FakeView>();

/** Vista simulada montada en ese nodo, si la hay. */
export function viewFor(node: Element | null): FakeView | null {
  return node ? nodeViews.get(node) ?? null : null;
}

/**
 * Extensiones vivas de CodeMirror que usa el contenedor. Se sustituyen por
 * marcadores para que la prueba compruebe que se pasan, sin montar el editor.
 */
export const EditorView = {
  theme: vi.fn((spec: unknown) => ({ extension: "theme", spec })),
  lineWrapping: { extension: "lineWrapping" },
};

export const EditorState = {
  tabSize: { of: vi.fn((size: number) => ({ extension: "tabSize", size })) },
};

function createView(initialText: string, props: MockCodeMirrorProps): FakeView {
  let text = initialText;
  let from = 0;
  let to = 0;
  const scrollListeners = new Set<() => void>();
  const dispatches: FakeTransaction[] = [];

  const view: FakeView = {
    get state() {
      return {
        doc: { toString: () => text, length: text.length },
        // `SelectionRange` real expone also `anchor` y `head`, como CodeMirror.
        selection: { main: { from, to, anchor: from, head: to } },
      };
    },
    text: () => text,
    dispatches,
    setSelection: (start, end = start) => {
      from = start;
      to = end;
      props.onUpdate?.({ docChanged: false, selectionSet: true });
    },
    type: (next) => {
      text = next;
      props.onChange?.(next);
    },
    applyValue: (next) => {
      if (next === text) return;
      text = next;
      // Como CodeMirror al reemplazar el documento: la selección se acota al
      // texto nuevo en vez de quedar fuera de rango.
      const end = text.length;
      from = Math.min(from, end);
      to = Math.min(to, end);
    },
    scrollTo: (top) => {
      view.scrollDOM.scrollTop = top;
      for (const listener of scrollListeners) listener();
    },
    dispatch: (transaction) => {
      dispatches.push(transaction);
      const changed = Boolean(transaction.changes);
      if (transaction.changes) {
        const { from: start, to: end, insert } = transaction.changes;
        text = text.slice(0, start) + insert + text.slice(end);
      }
      if (transaction.selection) {
        from = transaction.selection.anchor;
        to = transaction.selection.head;
      }
      if (changed) props.onChange?.(text);
      else props.onUpdate?.({ docChanged: false, selectionSet: true });
    },
    focus: vi.fn(),
    scrollDOM: {
      scrollTop: 0,
      addEventListener: (_type, listener) => {
        scrollListeners.add(listener);
      },
      removeEventListener: (_type, listener) => {
        scrollListeners.delete(listener);
      },
    },
  };

  return view;
}

const MockCodeMirror = forwardRef<unknown, MockCodeMirrorProps>(function MockCodeMirror(props, ref) {
  const view = useMemo(() => createView(props.value ?? "", props), []);
  createdViews.push(view);

  useImperativeHandle(ref, () => ({ view, state: view.state, editor: null }), [view]);

  // `value` controlado: un cambio del prop `value` se aplica al documento
  // montado, como en el envoltorio real. Si el cambio no viene de quien teclea
  // aquí NO dispara `onChange` (si lo hiciera, el shell escribiría en el almacén
  // lo que acaba de leer). Es el último tramo del estado compartido de T6/S7:
  // almacén único → prop `value` de cada grupo → texto de cada editor.
  useEffect(() => {
    view.applyValue(props.value ?? "");
  }, [props.value, view]);

  useEffect(() => {
    props.onCreateEditor?.(view, view.state);
  }, [props, view]);

  return (
    <div
      data-testid="codemirror-mock"
      ref={(node) => {
        if (node) nodeViews.set(node, view);
      }}
    />
  );
});

export default MockCodeMirror;
