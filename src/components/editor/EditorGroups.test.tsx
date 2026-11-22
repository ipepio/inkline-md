/**
 * Shell de los grupos de edición (ODD editor groups · T3 · S1 · S3 · S4 · S5).
 *
 * Se monta el componente con estados de grupos ya construidos (el modelo es de
 * T2) y se verifica lo que aporta el shell: un workspace cuando hay un grupo,
 * dos paneles con divisor y cruz cuando hay dos, la llamada a la acción del
 * grupo vacío, la marca de foco y que cada vista cambia en SU grupo.
 */

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import {
  EditorGroups,
  type EditorGroupRefs,
  type EditorGroupsProps,
} from "./EditorGroups";
import type { Group } from "@/hooks/editorGroups";
import type { OpenDocument } from "@/lib/documents";
import { createdViews, resetViews } from "./__fixtures__/codemirror-mock";

vi.mock("@uiw/react-codemirror", async () => await import("./__fixtures__/codemirror-mock"));

const DOC_A: OpenDocument = {
  id: "doc-a",
  path: "/notas/uno.md",
  name: "uno.md",
  contents: "# uno",
  dirty: false,
  viewState: {},
};

const DOC_B: OpenDocument = {
  id: "doc-b",
  path: "/notas/dos.md",
  name: "dos.md",
  contents: "# dos",
  dirty: false,
  viewState: {},
};

const GROUP_1: Group = { id: "1", docIds: [DOC_A.id], activeDocId: DOC_A.id, mode: "editor" };
const GROUP_1_EMPTY: Group = { id: "1", docIds: [], activeDocId: null, mode: "editor" };
const GROUP_2_EMPTY: Group = { id: "2", docIds: [], activeDocId: null, mode: "editor" };
const GROUP_2: Group = { id: "2", docIds: [DOC_B.id], activeDocId: DOC_B.id, mode: "split" };

function renderGroups(overrides: Partial<EditorGroupsProps> = {}) {
  const props: EditorGroupsProps = {
    groups: [GROUP_1],
    focusedGroupId: "1",
    docs: [DOC_A, DOC_B],
    theme: "dark",
    previewFor: (doc) => <p>preview de {doc.name}</p>,
    onModeChange: vi.fn(),
    onFocus: vi.fn(),
    onCloseGroup: vi.fn(),
    onContents: vi.fn(),
    onViewState: vi.fn(),
    ...overrides,
  };
  return { ...render(<EditorGroups {...props} />), props };
}

describe("EditorGroups", () => {
  it("con un grupo ocupa el área como hoy, sin divisor ni cruz", () => {
    const { container } = renderGroups();

    expect(container.querySelectorAll("[data-editor-group]")).toHaveLength(1);
    expect(container.querySelector('[data-slot="resizable-panel-group"]')).toBeNull();
    expect(screen.getByLabelText("Editor de Markdown")).toBeInTheDocument();
    expect(screen.queryByLabelText("Cerrar grupo")).not.toBeInTheDocument();
  });

  it("con dos grupos reparte en dos paneles con divisor y una cruz por grupo", () => {
    const { container } = renderGroups({
      groups: [GROUP_1, GROUP_2],
      focusedGroupId: "1",
    });

    expect(container.querySelectorAll("[data-editor-group]")).toHaveLength(2);
    const outer = container.querySelector(
      '[data-slot="editor-groups"] > [data-slot="resizable-panel-group"]',
    );
    expect(outer).not.toBeNull();
    // Sólo los paneles del grupo: dentro de cada uno vive además el reparto
    // editor/preview del documento, que no cuenta aquí.
    expect(outer?.querySelectorAll(':scope > [data-slot="resizable-panel"]')).toHaveLength(2);
    expect(outer?.querySelectorAll(':scope > [data-slot="resizable-handle"]')).toHaveLength(1);
    expect(screen.getAllByLabelText("Cerrar grupo")).toHaveLength(2);
  });

  it("la cruz de cada grupo lo cierra", () => {
    const { props } = renderGroups({ groups: [GROUP_1, GROUP_2] });

    const second = screen.getByLabelText("Grupo de edición 2");
    fireEvent.click(within(second).getByLabelText("Cerrar grupo"));

    expect(props.onCloseGroup).toHaveBeenCalledWith("2");
  });

  // S4: el grupo nuevo nace vacío y explica cómo llenarlo.
  it("muestra la llamada a la acción en el grupo vacío", () => {
    renderGroups({ groups: [GROUP_1, GROUP_2_EMPTY], focusedGroupId: "2" });

    const empty = screen.getByLabelText("Grupo de edición 2");
    expect(
      within(empty).getByText(/se abrirá en este editor/i),
    ).toBeInTheDocument();
    expect(within(empty).getByText(/divide el área/i)).toBeInTheDocument();
    // El otro grupo conserva su editor.
    expect(screen.getByLabelText("Editor de Markdown")).toBeInTheDocument();
  });

  // Sin división el área vacía sigue siendo la de siempre (no hay «este grupo»).
  it("sin división el área vacía mantiene el estado vacío de siempre", () => {
    renderGroups({ groups: [GROUP_1_EMPTY], docs: [] });

    expect(screen.getByText("Ningún documento abierto")).toBeInTheDocument();
    expect(screen.queryByText(/se abrirá en este editor/i)).not.toBeInTheDocument();
  });

  it("enfoca el grupo donde se pulsa", () => {
    const { props } = renderGroups({ groups: [GROUP_1, GROUP_2], focusedGroupId: "1" });

    fireEvent.pointerDown(screen.getByLabelText("Grupo de edición 2"));

    expect(props.onFocus).toHaveBeenCalledWith("2");
  });

  it("marca el grupo con foco", () => {
    renderGroups({ groups: [GROUP_1, GROUP_2], focusedGroupId: "2" });

    expect(screen.getByLabelText("Grupo de edición 2")).toHaveAttribute("data-focused", "true");
    expect(screen.getByLabelText("Grupo de edición 1")).not.toHaveAttribute("data-focused");
  });

  it("cambia la vista del grupo al que pertenece el control", () => {
    const { props } = renderGroups({ groups: [GROUP_1, GROUP_2], focusedGroupId: "1" });

    const second = screen.getByLabelText("Grupo de edición 2");
    fireEvent.click(within(second).getByRole("button", { name: "Preview" }));

    expect(props.onModeChange).toHaveBeenCalledWith("2", "preview");
  });

  // El divisor entre grupos arranca mitad y mitad y no se recuerda: no hay
  // `onLayoutChange`, la división es de sesión (S7).
  it("reparte los dos grupos al 50/50", () => {
    const { container } = renderGroups({ groups: [GROUP_1, GROUP_2] });

    const panels = container.querySelectorAll(
      '[data-slot="editor-groups"] > [data-slot="resizable-panel-group"] > [data-slot="resizable-panel"]',
    );
    expect(panels).toHaveLength(2);
    for (const panel of panels) {
      expect(panel.getAttribute("style")).toContain("flex-grow: 50");
    }
  });

  // PRESERVE: el reparto editor/preview sigue siendo POR DOCUMENTO dentro de
  // cada grupo; el shell sólo lo lee del `viewState` del documento de ese panel.
  it("respeta el reparto recordado del documento dentro de su grupo", () => {
    const conReparto: OpenDocument = {
      ...DOC_B,
      viewState: { splitLayout: { editor: 70, preview: 30 } },
    };
    const group2: Group = {
      id: "2",
      docIds: [conReparto.id],
      activeDocId: conReparto.id,
      mode: "split",
    };

    const { container } = renderGroups({ groups: [GROUP_1, group2], docs: [DOC_A, conReparto] });

    const panel = container.querySelector('[data-editor-group="2"]');
    const paneles = panel?.querySelectorAll('[data-slot="resizable-panel"]') ?? [];
    expect(paneles).toHaveLength(2);
    expect(paneles[0].getAttribute("style")).toContain("flex-grow: 70");
    expect(paneles[1].getAttribute("style")).toContain("flex-grow: 30");
  });

  it("expone el handle de cada editor por grupo", () => {
    const editorRefs: { current: EditorGroupRefs } = { current: {} };

    renderGroups({ groups: [GROUP_1, GROUP_2], editorRefs });

    expect(editorRefs.current["1"]).not.toBeNull();
    expect(editorRefs.current["2"]).not.toBeNull();
    expect(editorRefs.current["2"]?.applyFormat).toBeTypeOf("function");
  });

  // S7: el mismo documento puede vivir en los dos grupos; lo que se escribe en
  // uno aparece en el otro porque ambos renderizan el MISMO documento del
  // almacén (`onContents` lo actualiza) y el `value` se aplica también al
  // editor montado del otro grupo.
  it("sincroniza en vivo el mismo documento abierto en dos grupos", () => {
    resetViews();
    const shared: OpenDocument = { ...DOC_A, contents: "# compartido" };
    const grupos: Group[] = [
      { id: "1", docIds: [shared.id], activeDocId: shared.id, mode: "editor" },
      { id: "2", docIds: [shared.id], activeDocId: shared.id, mode: "editor" },
    ];
    const onContents = vi.fn();
    const { rerender, props } = renderGroups({
      groups: grupos,
      docs: [shared],
      onContents,
    });

    const [vistaUno, vistaDos] = createdViews;
    expect(vistaUno.text()).toBe("# compartido");
    expect(vistaDos.text()).toBe("# compartido");

    // La persona escribe en el editor del grupo 1: el shell avisa del cambio.
    vistaUno.type("# compartido y editado");
    expect(onContents).toHaveBeenCalledWith(shared.id, "# compartido y editado");

    // El almacén (App) actualiza el documento y ambos grupos re-renderizan el
    // mismo contenido: el editor del grupo 2 lo recibe vía `value`.
    const actualizado: OpenDocument = {
      ...shared,
      contents: "# compartido y editado",
      dirty: true,
    };
    rerender(<EditorGroups {...props} docs={[actualizado]} />);

    expect(vistaDos.text()).toBe("# compartido y editado");
    expect(vistaUno.text()).toBe("# compartido y editado");
  });
});
