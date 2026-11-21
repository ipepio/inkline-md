/**
 * Panel del editor de Inkline (ODD T3 / S2 · S4 · S6).
 *
 * Envoltorio fino sobre `@uiw/react-codemirror` con tres responsabilidades:
 * 1. Configurar el editor como el mockup: Markdown con lenguajes incrustados,
 *    números de línea, tab de 2 espacios y el tema de `lib/editor/theme`.
 * 2. Persistir cursor y desplazamiento en el `viewState` del documento y
 *    restaurarlos al montar (o al cambiar de documento).
 * 3. Exponer `applyFormat(kind)`: lee la selección real, delega en las funciones
 *    puras de `lib/editor/format` y escribe el resultado con CodeMirror.
 *
 * El throttle de la persistencia es una decisión deliberada: escribir en el
 * almacén de documentos no puede ocurrir en cada tecla, así que se agrupa en una
 * ventana de 200 ms que se lee al vencer (siempre guarda el último estado).
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import CodeMirror, {
  EditorState,
  type BasicSetupOptions,
  type EditorView,
  type ViewUpdate,
} from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { applyFormat as formatSelection, minimalChange, type FormatKind } from "@/lib/editor/format";
import { editorTheme } from "@/lib/editor/theme";
import type { Theme } from "@/hooks/useTheme";

export interface EditorDocument {
  id: string;
  contents: string;
  viewState?: Record<string, unknown>;
}

export interface EditorPaneProps {
  doc: EditorDocument;
  theme: Theme;
  onContents: (id: string, contents: string) => void;
  onViewState: (id: string, viewState: Record<string, unknown>) => void;
}

export interface EditorPaneHandle {
  applyFormat: (kind: FormatKind) => void;
}

/** Ventana de agrupación al guardar cursor y desplazamiento. */
export const PERSIST_DELAY_MS = 200;

/** Ajustes del editor: lo que pide el mockup y nada más. */
const BASIC_SETUP: BasicSetupOptions = {
  lineNumbers: true,
  foldGutter: false,
  highlightActiveLine: false,
  highlightActiveLineGutter: false,
  autocompletion: false,
  bracketMatching: false,
  closeBrackets: false,
  highlightSelectionMatches: false,
  searchKeymap: true,
  history: true,
  drawSelection: true,
  indentOnInput: true,
};

/** Cursor y desplazamiento guardados, validados contra lo que haya. */
function readViewState(viewState: Record<string, unknown> | undefined): {
  cursor?: number;
  scrollTop?: number;
} {
  const cursor = viewState?.cursor;
  const scrollTop = viewState?.scrollTop;
  return {
    cursor: typeof cursor === "number" && Number.isFinite(cursor) && cursor >= 0 ? cursor : undefined,
    scrollTop:
      typeof scrollTop === "number" && Number.isFinite(scrollTop) && scrollTop >= 0
        ? scrollTop
        : undefined,
  };
}

export const EditorPane = forwardRef<EditorPaneHandle, EditorPaneProps>(function EditorPane(
  { doc, theme, onContents, onViewState },
  ref,
) {
  const viewRef = useRef<EditorView | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Últimos props sin re-suscribir el throttle ni el restaurador.
  const latestRef = useRef({ id: doc.id, viewState: doc.viewState, onViewState });
  useEffect(() => {
    latestRef.current = { id: doc.id, viewState: doc.viewState, onViewState };
  });

  const schedulePersist = useCallback(() => {
    if (timerRef.current !== null) return;
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      const view = viewRef.current;
      if (!view) return;
      const { id, onViewState: persist } = latestRef.current;
      persist(id, {
        cursor: view.state.selection.main.head,
        scrollTop: view.scrollDOM.scrollTop,
      });
    }, PERSIST_DELAY_MS);
  }, []);

  const handleScroll = useCallback(() => {
    schedulePersist();
  }, [schedulePersist]);

  const handleCreate = useCallback(
    (view: EditorView) => {
      viewRef.current = view;
      view.scrollDOM.addEventListener("scroll", handleScroll, { passive: true });
    },
    [handleScroll],
  );

  const handleUpdate = useCallback(
    (update: ViewUpdate) => {
      if (update.docChanged || update.selectionSet) schedulePersist();
    },
    [schedulePersist],
  );

  // Restauración al montar y al cambiar de documento (el padre reutiliza el panel).
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const { cursor, scrollTop } = readViewState(latestRef.current.viewState);
    if (cursor !== undefined) {
      view.dispatch({
        selection: { anchor: Math.min(cursor, view.state.doc.length) },
        scrollIntoView: false,
      });
    }
    if (scrollTop !== undefined) view.scrollDOM.scrollTop = scrollTop;
  }, [doc.id]);

  useEffect(
    () => () => {
      const view = viewRef.current;
      if (view) view.scrollDOM.removeEventListener("scroll", handleScroll);
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = null;
    },
    [handleScroll],
  );

  const extensions = useMemo(
    () => [markdown({ codeLanguages: languages }), EditorState.tabSize.of(2), editorTheme(theme)],
    [theme],
  );

  useImperativeHandle(
    ref,
    () => ({
      applyFormat(kind: FormatKind) {
        const view = viewRef.current;
        if (!view) return;
        const before = view.state.doc.toString();
        const { from, to } = view.state.selection.main;
        const next = formatSelection(kind, {
          text: before,
          selectionStart: from,
          selectionEnd: to,
        });
        view.dispatch({
          changes: minimalChange(before, next.text),
          selection: { anchor: next.selectionStart, head: next.selectionEnd },
          scrollIntoView: true,
        });
        view.focus();
      },
    }),
    [],
  );

  return (
    <div className="h-full min-h-0 overflow-hidden" data-editor-theme={theme}>
      <CodeMirror
        value={doc.contents}
        height="100%"
        theme="none"
        extensions={extensions}
        basicSetup={BASIC_SETUP}
        indentWithTab
        spellCheck={false}
        aria-label="Editor de Markdown"
        onChange={(value) => onContents(doc.id, value)}
        onUpdate={handleUpdate}
        onCreateEditor={handleCreate}
      />
    </div>
  );
});
