import { beforeAll, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { getDocumentsSnapshot, resetDocuments, setContents, setViewState } from "@/lib/documents";
import { openTextFile, readTextFile } from "@/lib/files";
import { getSettingsSnapshot, resetSettings } from "@/lib/settings";
import { loadWorkspaceConfig, pushRecent } from "@/lib/workspace";
import type { FakeView } from "./components/editor/__fixtures__/codemirror-mock";
import { viewFor } from "./components/editor/__fixtures__/codemirror-mock";
import App from "./App";

vi.mock("@/lib/workspace", () => ({
  listTree: vi.fn().mockResolvedValue([]),
  loadWorkspaceConfig: vi.fn().mockResolvedValue({ root: null, recents: [] }),
  pushRecent: vi.fn().mockResolvedValue([]),
  setWorkspace: vi.fn().mockResolvedValue(undefined),
  flattenFiles: vi.fn().mockReturnValue([]),
  filePaths: vi.fn().mockReturnValue([]),
  fileNameOf: (path: string) => path.split(/[\\/]/).pop() ?? path,
  workspaceName: (root: string | null) => (root ? "raíz" : "Sin carpeta raíz"),
  MAX_RECENTS: 10,
}));

vi.mock("@/lib/files", () => ({
  openTextFile: vi.fn().mockResolvedValue(null),
  readTextFile: vi.fn().mockResolvedValue({ path: "", contents: "" }),
  saveTextFile: vi.fn().mockResolvedValue(undefined),
  saveTextFileAs: vi.fn().mockResolvedValue(null),
}));

// jsdom no maqueta el layout del que CodeMirror depende, así que el editor se
// sustituye por el doble de `__fixtures__/codemirror-mock`: mismo contrato
// (value controlado + onChange), y permite escribir de verdad (S7, T6).
vi.mock("@uiw/react-codemirror", async () => await import("./components/editor/__fixtures__/codemirror-mock"));

// jsdom no trae ResizeObserver ni scrollIntoView y los diálogos de `ui/` los
// usan para medir su contenido. Stubs mínimos, sólo en este test.
beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
});

/** Pestañas abiertas en TODAS las secciones de la barra (una por grupo). */
function tabs(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('[data-slot="tab"]')).map(
    (tab) => tab.querySelector("button")?.title ?? "",
  );
}

/**
 * Editor montado dentro de una región de la interfaz (un grupo de edición).
 * Devuelve la vista simulada, que es la superficie del editor en jsdom: lo que
 * se escribe entra por `type()`→`onChange` y lo que llega por la prop `value`
 * se puede leer con `text()`.
 */
function editorIn(region: HTMLElement): FakeView {
  const view = viewFor(within(region).getByTestId("codemirror-mock"));
  if (!view) throw new Error("La región no tiene un editor montado");
  return view;
}

describe("App (shell Inkline)", () => {
  it("muestra marca, explorador, acciones y estado vacío", () => {
    render(<App />);

    // Marca del rail y del explorador (ahora son los assets de la marca).
    expect(screen.getAllByAltText(/inkline/i).length).toBeGreaterThan(0);
    // Cabecera del explorador.
    expect(screen.getByText("EXPLORADOR")).toBeInTheDocument();
    // Acciones del topbar.
    expect(screen.getByRole("button", { name: "Abrir" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Guardar/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Exportar/i })).toBeInTheDocument();
    // Estado vacío del área de lectura.
    expect(screen.getByText("Ningún documento abierto")).toBeInTheDocument();
    expect(screen.getByText(/crea uno nuevo con ⌘N/)).toBeInTheDocument();
    // QA humano: sin pie Local-first ni avatar IL en el rail; Preferencias accesible.
    expect(screen.queryByText("Local-first workspace")).not.toBeInTheDocument();
    expect(screen.queryByText("IL")).not.toBeInTheDocument();
    expect(screen.getByTitle("Preferencias (⌘,)")).toBeInTheDocument();
  });

  // Regresión QA: al colapsar el explorador, el panel principal debe conservar
  // su columna. Antes el `<aside>` se desmontaba, `<main>` caía en la columna de
  // 0px y los paneles se quedaban sin ancho (texto en vertical).
  it("mantiene el panel principal en su columna al colapsar el explorador", () => {
    const { container } = render(<App />);

    // Selector por tag+clase: hay más de un nodo con rol main en el árbol
    // (diálogos de shadcn/Base UI), así que el rol no identifica el panel.
    expect(container.querySelector("main.col-start-3")).not.toBeNull();
    expect(container.querySelector('aside[aria-label="Explorador de archivos"]')).not.toBeNull();

    // Regresión QA: ambos son grid items, así que necesitan `min-h-0`. Sin él
    // crecían por encima de la ventana, el grid los recortaba y el área de
    // trabajo dejaba de verse y de hacer scroll.
    expect(container.querySelector("main.col-start-3")?.className).toContain("min-h-0");
    expect(
      container.querySelector('aside[aria-label="Explorador de archivos"]')?.className,
    ).toContain("min-h-0");
    // El rail también: su espaciador empujaba tema y Preferencias fuera de vista.
    expect(container.querySelector('aside[aria-label="Barra de Inkline"]')?.className).toContain(
      "min-h-0",
    );

    fireEvent.click(screen.getByTitle(/Mostrar \/ ocultar el explorador/));

    expect(container.querySelector('aside[aria-label="Explorador de archivos"]')).toBeNull();
    expect(container.querySelector("main.col-start-3")).not.toBeNull();
    // El estado vacío sigue visible: no se desmonta el área de trabajo.
    expect(screen.getByText("Ningún documento abierto")).toBeInTheDocument();
  });

  // Zoom global de texto (⌘+ / ⌘− / ⌘0): escala editor y visor a la vez.
  it("hace zoom con ⌘+ / ⌘− y restablece con ⌘0", () => {
    resetSettings();

    render(<App />);

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { metaKey: true, key: "=" }));
    });
    expect(getSettingsSnapshot().zoom).toBe(110);

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { metaKey: true, key: "-" }));
    });
    expect(getSettingsSnapshot().zoom).toBe(100);

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { metaKey: true, key: "=" }));
    });
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { metaKey: true, key: "=" }));
    });
    expect(getSettingsSnapshot().zoom).toBe(125);

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { metaKey: true, key: "0" }));
    });
    expect(getSettingsSnapshot().zoom).toBe(100);

    resetSettings();
  });

  // Fuera de macOS los atajos se muestran con Ctrl.
  it("muestra los atajos con Ctrl en Windows", () => {
    Object.defineProperty(window.navigator, "platform", {
      value: "Win32",
      configurable: true,
    });
    try {
      render(<App />);

      expect(screen.getByTitle("Preferencias (Ctrl+,)")).toBeInTheDocument();
      expect(screen.getByText(/crea uno nuevo con Ctrl\+N/)).toBeInTheDocument();
    } finally {
      Object.defineProperty(window.navigator, "platform", {
        value: "MacIntel",
        configurable: true,
      });
    }
  });

  // T1: la orquestación vive en hooks, pero el shell sigue abriendo desde el
  // mismo punto de costura (`handleOpenDialog`) y mostrando el resultado.
  it("abre en una pestaña el documento elegido en el diálogo", async () => {
    resetDocuments();
    vi.mocked(openTextFile).mockResolvedValueOnce({
      path: "/notas/idea.md",
      contents: "# idea",
    });

    render(<App />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Abrir" }));
    });

    expect(screen.getByText("Abierto: /notas/idea.md")).toBeInTheDocument();
    expect(screen.queryByText("Ningún documento abierto")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Guardar/i })).toBeEnabled();

    resetDocuments();
  });

  // T3 (S1 · S3 · S4 · S5): ⌘D divide el área en dos grupos y el nuevo nace
  // vacío con la llamada a la acción y su cruz de cierre.
  it("divide el área en dos grupos con ⌘D", () => {
    resetDocuments();
    const { container } = render(<App />);

    expect(container.querySelectorAll("[data-editor-group]")).toHaveLength(1);
    expect(screen.queryByLabelText("Cerrar grupo")).not.toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { metaKey: true, key: "d" }));
    });

    expect(container.querySelectorAll("[data-editor-group]")).toHaveLength(2);
    // Sin documento, los dos grupos explican dónde se abrirá (S4).
    expect(screen.getAllByText(/se abrirá en este editor/i)).toHaveLength(2);
    expect(screen.getAllByLabelText("Cerrar grupo")).toHaveLength(2);
    // El grupo con foco es el nuevo, y se marca.
    expect(screen.getByLabelText("Grupo de edición 2")).toHaveAttribute("data-focused", "true");

    // Con dos grupos, ⌘D ya no abre un tercero.
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { metaKey: true, key: "d" }));
    });
    expect(container.querySelectorAll("[data-editor-group]")).toHaveLength(2);

    resetDocuments();
  });

  // T3 (S5): la cruz de un grupo lo cierra y el superviviente sigue en pie.
  it("cierra un grupo con su cruz", () => {
    resetDocuments();
    const { container } = render(<App />);

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { metaKey: true, key: "d" }));
    });
    fireEvent.click(within(screen.getByLabelText("Grupo de edición 2")).getByLabelText("Cerrar grupo"));

    expect(container.querySelectorAll("[data-editor-group]")).toHaveLength(1);
    expect(screen.queryByLabelText("Cerrar grupo")).not.toBeInTheDocument();

    resetDocuments();
  });

  // T3: la vista pasa a ser del GRUPO; el `viewState.mode` del documento ya no
  // decide cómo se pinta el área de trabajo.
  it("la vista del área es la del grupo, no la del documento", async () => {
    resetDocuments();
    vi.mocked(openTextFile).mockResolvedValueOnce({
      path: "/notas/modo.md",
      contents: "# modo",
    });

    const { container } = render(<App />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Abrir" }));
    });

    const docId = getDocumentsSnapshot().activeId;
    expect(docId).not.toBeNull();
    act(() => {
      setViewState(docId as string, { mode: "preview" });
    });

    // Las preferencias de fábrica abren en «split»: el documento no manda.
    expect(container.querySelector("[data-mode]")).toHaveAttribute("data-mode", "split");

    resetDocuments();
  });

  // T3: cada grupo mantiene su propia vista y su propio documento.
  it("cambia la vista de un grupo sin tocar la del otro", async () => {
    resetDocuments();
    vi.mocked(openTextFile)
      .mockResolvedValueOnce({ path: "/notas/uno.md", contents: "# uno" })
      .mockResolvedValueOnce({ path: "/notas/dos.md", contents: "# dos" });

    render(<App />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Abrir" }));
    });
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { metaKey: true, key: "d" }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Abrir" }));
    });

    const group1 = screen.getByLabelText("Grupo de edición 1");
    const group2 = screen.getByLabelText("Grupo de edición 2");
    fireEvent.click(within(group2).getByRole("button", { name: "Preview" }));

    // El grupo 2 se queda en vista previa…
    expect(group2.querySelector('[data-pane="editor"]')).toBeNull();
    expect(group2.querySelector('[data-pane="preview"]')).not.toBeNull();
    // …y el grupo 1 conserva la suya (split: editor y vista previa).
    expect(group1.querySelector('[data-pane="editor"]')).not.toBeNull();
    expect(group1.querySelector('[data-pane="preview"]')).not.toBeNull();
    // Cada grupo muestra su propio documento.
    expect(group1.textContent).toContain("uno");
    expect(group2.textContent).toContain("dos");

    resetDocuments();
  });

  // T5 (S5 · S6): ⌘W cierra el documento del grupo CON FOCO. El documento es uno
  // solo (S7), así que sale del almacén y la poda de T4 lo quita de TODAS las
  // secciones de pestañas, no sólo de la enfocada.
  it("cierra con ⌘W el documento del grupo con foco y lo poda de todas las secciones", async () => {
    resetDocuments();
    vi.mocked(openTextFile).mockResolvedValueOnce({
      path: "/notas/uno.md",
      contents: "# uno",
    });
    // El explorador recuerda el mismo documento: es el camino con el que el
    // grupo enfocado recibe una ruta (recientes → almacén → grupo con foco).
    const recent = { path: "/notas/uno.md", name: "uno.md", openedAt: 1 };
    vi.mocked(loadWorkspaceConfig).mockResolvedValueOnce({
      root: null,
      recents: [recent],
    });
    // Abrir el documento refresca los recientes con lo que devuelve el backend;
    // aquí los mantiene para poder abrirlo otra vez desde el explorador.
    vi.mocked(pushRecent).mockResolvedValueOnce([recent]);

    const { container } = render(<App />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Abrir" }));
    });
    // El primer documento se abre en el grupo 1.
    expect(tabs(container)).toEqual(["uno.md"]);

    // ⌘D: el grupo 2 nace vacío y con el foco (S3 · S4).
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { metaKey: true, key: "d" }));
    });

    // El MISMO documento entra en el grupo 2 desde los recientes del explorador
    // (S2 · S7): una pestaña en cada sección.
    await waitFor(() => expect(screen.getByTitle("/notas/uno.md")).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTitle("/notas/uno.md"));
    });
    expect(tabs(container)).toEqual(["uno.md", "uno.md"]);
    expect(screen.getByLabelText("Grupo de edición 2")).toHaveAttribute("data-focused", "true");

    // ⌘W cierra el documento del grupo enfocado; al ser único en el almacén, la
    // poda lo retira de las dos secciones y los grupos colapsan.
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { metaKey: true, key: "w" }));
    });
    expect(getDocumentsSnapshot().docs).toHaveLength(0);
    expect(tabs(container)).toEqual([]);
    expect(container.querySelectorAll("[data-editor-group]")).toHaveLength(1);
    expect(screen.getByText("Ningún documento abierto")).toBeInTheDocument();

    // Repetir ⌘W sin documento no rompe nada ni abre diálogos.
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { metaKey: true, key: "w" }));
    });
    expect(getDocumentsSnapshot().docs).toHaveLength(0);
    expect(screen.queryByText(/¿Cerrar «/)).not.toBeInTheDocument();

    resetDocuments();
  });

  // T5 (S5): con el grupo enfocado vacío, ⌘W no toca el documento del otro grupo
  // ni abre la confirmación.
  it("con el grupo con foco vacío ⌘W no cierra el documento del otro grupo", async () => {
    resetDocuments();
    vi.mocked(openTextFile).mockResolvedValueOnce({
      path: "/notas/uno.md",
      contents: "# uno",
    });

    const { container } = render(<App />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Abrir" }));
    });
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { metaKey: true, key: "d" }));
    });

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { metaKey: true, key: "w" }));
    });

    // El documento sigue abierto en el grupo 1 y seguimos con dos grupos.
    expect(getDocumentsSnapshot().docs).toHaveLength(1);
    expect(container.querySelectorAll("[data-editor-group]")).toHaveLength(2);
    expect(tabs(container)).toEqual(["uno.md"]);
    expect(screen.queryByText(/¿Cerrar «/)).not.toBeInTheDocument();

    resetDocuments();
  });

  // T5 (S5): ⌘W pasa por el flujo de cierre de siempre, que pregunta antes de
  // perder cambios sin guardar.
  it("⌘W pide confirmación si el documento del grupo con foco está sucio", async () => {
    resetDocuments();
    vi.mocked(openTextFile).mockResolvedValueOnce({
      path: "/notas/uno.md",
      contents: "# uno",
    });

    render(<App />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Abrir" }));
    });
    act(() => {
      setContents(getDocumentsSnapshot().activeId as string, "# uno editado");
    });

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { metaKey: true, key: "w" }));
    });
    expect(screen.getByText("¿Cerrar «uno.md» sin guardar?")).toBeInTheDocument();
    // Cancelar deja el documento abierto: la confirmación decide de verdad.
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(getDocumentsSnapshot().docs).toHaveLength(1);

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { metaKey: true, key: "w" }));
    });
    fireEvent.click(screen.getByRole("button", { name: "Cerrar sin guardar" }));
    expect(getDocumentsSnapshot().docs).toHaveLength(0);

    resetDocuments();
  });

  // T5 (S2): la barra de formato (⌘B / ⌘I) va al editor del grupo CON FOCO por
  // el mapa de handles de `EditorGroups`, no al último editor montado.
  it("aplica el formato en el editor del grupo con foco y no en el otro", async () => {
    resetDocuments();
    vi.mocked(openTextFile)
      .mockResolvedValueOnce({ path: "/notas/uno.md", contents: "# uno" })
      .mockResolvedValueOnce({ path: "/notas/dos.md", contents: "# dos" });

    render(<App />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Abrir" }));
    });
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { metaKey: true, key: "d" }));
    });
    // El grupo 2 (con foco) recibe el segundo documento.
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Abrir" }));
    });

    const [{ id: unoId, contents: unoBefore }, { id: dosId }] = getDocumentsSnapshot().docs;
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { metaKey: true, key: "b" }));
    });

    const docs = getDocumentsSnapshot().docs;
    // La negrita aterriza en el documento del grupo con foco…
    expect(docs.find((doc) => doc.id === dosId)?.contents).toContain("**texto**");
    // …y el documento del otro grupo se queda como estaba.
    expect(docs.find((doc) => doc.id === unoId)?.contents).toBe(unoBefore);

    resetDocuments();
  });

  // T5 (S2 · S4): sin documento en el grupo con foco, ⌘B no hace nada (ni cae al
  // editor del otro grupo).
  it("con el grupo con foco vacío el formato no toca ningún documento", async () => {
    resetDocuments();
    vi.mocked(openTextFile).mockResolvedValueOnce({
      path: "/notas/uno.md",
      contents: "# uno",
    });

    render(<App />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Abrir" }));
    });
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { metaKey: true, key: "d" }));
    });

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { metaKey: true, key: "b" }));
      window.dispatchEvent(new KeyboardEvent("keydown", { metaKey: true, key: "i" }));
    });

    expect(getDocumentsSnapshot().docs[0]?.contents).toBe("# uno");

    resetDocuments();
  });

  // T5 (PRESERVE): una ruta que aún NO está abierta se sigue leyendo del disco y
  // aparece en el grupo de siempre; el enrutado nuevo sólo cambia el caso de un
  // documento ya abierto.
  it("los recientes siguen abriendo un archivo que no estaba abierto", async () => {
    resetDocuments();
    vi.mocked(loadWorkspaceConfig).mockResolvedValueOnce({
      root: null,
      recents: [{ path: "/notas/nueva.md", name: "nueva.md", openedAt: 1 }],
    });
    vi.mocked(readTextFile).mockResolvedValueOnce({
      path: "/notas/nueva.md",
      contents: "# nueva",
    });

    render(<App />);
    await waitFor(() => expect(screen.getByTitle("/notas/nueva.md")).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTitle("/notas/nueva.md"));
    });

    expect(getDocumentsSnapshot().docs.map((doc) => doc.path)).toEqual(["/notas/nueva.md"]);
    expect(screen.getByText("Abierto: /notas/nueva.md")).toBeInTheDocument();
    expect(tabs(document.body)).toEqual(["nueva.md"]);

    resetDocuments();
  });

  // T6 (S7): el mismo `.md` en los dos grupos es UN documento, no dos copias.
  // El recorrido que se comprueba de extremo a extremo: se escribe en el editor
  // del grupo 1 → su `onChange` deja el texto en el almacén único
  // (`lib/documents`, un solo documento para las dos vistas) → `App` se vuelve a
  // pintar y pasa el `contents` nuevo a los dos grupos → la vista previa de cada
  // grupo se repinta con el texto nuevo y el `value` del editor del grupo 2 se
  // sincroniza con el del grupo 1 (react-codemirror aplica el valor nuevo al
  // documento del editor sin reemitir `onChange`, así que no hay bucle).
  it("sincroniza lo escrito entre dos grupos con el mismo documento", async () => {
    resetDocuments();
    vi.mocked(openTextFile).mockResolvedValueOnce({
      path: "/notas/uno.md",
      contents: "# uno",
    });

    const { container } = render(<App />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Abrir" }));
    });

    // ⌘D divide; el grupo 2 nace vacío y con foco, y la paleta abre ahí el MISMO
    // documento que ya vive en el grupo 1 (una pestaña por sección, S7).
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { metaKey: true, key: "d" }));
    });
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { metaKey: true, key: "k" }));
    });
    fireEvent.click(screen.getByRole("option", { name: /uno\.md/i }));
    expect(tabs(container)).toEqual(["uno.md", "uno.md"]);
    expect(getDocumentsSnapshot().docs).toHaveLength(1);

    // El grupo 2 nace en modo editor: se le pide la vista dividida para poder
    // mirar las dos vistas previas del mismo documento.
    fireEvent.click(
      within(screen.getByLabelText("Grupo de edición 2")).getByRole("button", { name: "Split" }),
    );

    const group1 = screen.getByLabelText("Grupo de edición 1");
    const group2 = screen.getByLabelText("Grupo de edición 2");
    expect(within(group1).getByLabelText("Vista previa")).toBeInTheDocument();
    expect(within(group2).getByLabelText("Vista previa")).toBeInTheDocument();

    // La edición entra por la vía real (el `onChange` del editor del grupo 1).
    const escrito = "# uno editado en el grupo 1";
    act(() => {
      editorIn(group1).type(escrito);
    });

    // 1) El almacén único queda con el texto escrito, y sigue siendo UN documento.
    expect(getDocumentsSnapshot().docs).toHaveLength(1);
    expect(getDocumentsSnapshot().docs[0]?.contents).toBe(escrito);

    // 2) Las dos vistas previas del mismo documento muestran lo escrito.
    expect(within(group1).getByLabelText("Vista previa").textContent).toContain(escrito.slice(2));
    expect(within(group2).getByLabelText("Vista previa").textContent).toContain(escrito.slice(2));

    // 3) El editor del grupo 2 recibe el valor nuevo sin que nadie escriba en él.
    expect(editorIn(group1).text()).toBe(escrito);
    expect(editorIn(group2).text()).toBe(escrito);

    resetDocuments();
  });

  // T5 (S2 · S7): la paleta sigue eligiendo en el almacén y el puente abre en el
  // grupo con foco. El caso que lo prueba de verdad es elegir el documento que
  // YA está activo: el almacén no cambia y aun así debe llegar al grupo enfocado.
  it("la paleta abre el documento elegido en el grupo con foco", async () => {
    resetDocuments();
    vi.mocked(openTextFile).mockResolvedValueOnce({
      path: "/notas/uno.md",
      contents: "# uno",
    });

    const { container } = render(<App />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Abrir" }));
    });
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { metaKey: true, key: "d" }));
    });
    // El grupo 2 (con foco) nace vacío (S4).
    expect(screen.getByText("Este editor está libre")).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { metaKey: true, key: "k" }));
    });
    fireEvent.click(screen.getByRole("option", { name: /uno\.md/i }));

    // El mismo documento vive en los dos grupos (S7): una pestaña por sección y
    // el grupo 2, que estaba vacío, ya lo muestra.
    expect(tabs(container)).toEqual(["uno.md", "uno.md"]);
    expect(screen.queryByText("Este editor está libre")).not.toBeInTheDocument();
    // El grupo 2 ya pinta el documento, no su llamada a la acción.
    expect(
      screen.getByLabelText("Grupo de edición 2").querySelector('[data-pane="editor"]'),
    ).not.toBeNull();

    resetDocuments();
  });
});
