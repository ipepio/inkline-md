import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DEFAULT_SETTINGS, type Settings } from "@/lib/settings";
import { SettingsDialog } from "./SettingsDialog";

// Mismos stubs que usan los popups de `ui/` en jsdom (medición, foco y los
// eventos de puntero con los que @base-ui/react abre las listas).
beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("PointerEvent", class PointerEvent extends MouseEvent {});
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderDialog(overrides: Partial<Settings> = {}) {
  const props = {
    open: true,
    onOpenChange: vi.fn(),
    settings: { ...DEFAULT_SETTINGS, ...overrides },
    onChange: vi.fn(),
    currentRoot: "/Users/yo/notas",
    onChooseRoot: vi.fn(),
    onExportHtml: vi.fn(),
    onOpenPrint: vi.fn(),
  };
  const utils = render(<SettingsDialog {...props} />);
  return { ...utils, props };
}

/** Abre una lista del diálogo y elige una opción por su etiqueta. */
async function chooseOption(label: string, option: string): Promise<void> {
  fireEvent.click(screen.getByRole("combobox", { name: label }));
  const item = await screen.findByRole("option", { name: option });
  fireEvent.pointerDown(item, { pointerType: "mouse" });
  fireEvent.pointerUp(item, { pointerType: "mouse" });
  fireEvent.click(item);
}

describe("SettingsDialog", () => {
  it("abre en Apariencia con la copia del mockup", () => {
    renderDialog();

    expect(screen.getByText("Preferencias")).toBeInTheDocument();
    expect(screen.getByText("Personaliza tu espacio de escritura")).toBeInTheDocument();
    expect(
      screen.getByText("Un diseño limpio que respeta la apariencia de tu sistema operativo."),
    ).toBeInTheDocument();
    expect(screen.getByText("Tema")).toBeInTheDocument();
    expect(screen.getByText("Tipografía de lectura")).toBeInTheDocument();
    expect(screen.getByText("Vista al abrir")).toBeInTheDocument();
  });

  it("cambia de sección desde la navegación lateral", () => {
    renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Editor" }));

    expect(
      screen.getByText("Ajustes que cambian la experiencia de escritura sin alterar el Markdown."),
    ).toBeInTheDocument();
    expect(screen.getByText("Mostrar números de línea")).toBeInTheDocument();
    expect(screen.queryByText("Tipografía de lectura")).not.toBeInTheDocument();
  });

  it("cambiar el tema avisa con la preferencia elegida", async () => {
    const { props } = renderDialog();

    await chooseOption("Tema", "Oscuro");

    expect(props.onChange).toHaveBeenCalledWith({ themeMode: "dark" });
  });

  it("los interruptores del editor avisan de su nueva preferencia", () => {
    const { props } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Editor" }));
    fireEvent.click(screen.getByRole("switch", { name: "Ajuste de línea" }));

    expect(props.onChange).toHaveBeenCalledWith({ wordWrap: true });
  });

  it("en Archivos muestra la carpeta raíz actual y deja cambiarla", () => {
    const { props } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Archivos" }));

    expect(screen.getByText("/Users/yo/notas")).toBeInTheDocument();
    expect(screen.getByText(/El espacio de trabajo y los archivos recientes/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Elegir carpeta…" }));

    expect(props.onChooseRoot).toHaveBeenCalledTimes(1);
  });

  it("en Archivos, sin carpeta elegida lo dice en vez de mostrar una ruta", () => {
    const props = {
      open: true,
      onOpenChange: vi.fn(),
      settings: { ...DEFAULT_SETTINGS },
      onChange: vi.fn(),
      currentRoot: null,
      onChooseRoot: vi.fn(),
      onExportHtml: vi.fn(),
      onOpenPrint: vi.fn(),
    };
    render(<SettingsDialog {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "Archivos" }));

    expect(screen.getByText("Sin carpeta elegida")).toBeInTheDocument();
  });

  it("en Exportación ofrece el tamaño de página y las dos salidas", () => {
    const { props } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Exportación" }));

    expect(screen.getByText("Tamaño de página")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Tamaño de página" })).toBeInTheDocument();
    expect(screen.getByText(/navegador del sistema/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Exportar ahora" }));
    fireEvent.click(screen.getByRole("button", { name: "Abrir impresión" }));

    expect(props.onExportHtml).toHaveBeenCalledTimes(1);
    expect(props.onOpenPrint).toHaveBeenCalledTimes(1);
  });

  it("cambiar el tamaño de página avisa con la preferencia elegida", async () => {
    const { props } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Exportación" }));
    await chooseOption("Tamaño de página", "US Letter");

    expect(props.onChange).toHaveBeenCalledWith({ pageSize: "letter" });
  });

  it("Atajos lista la tabla completa del mockup", () => {
    renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Atajos" }));

    expect(screen.getByText(/Funciona con ⌘ en macOS y Ctrl en Windows \/ Linux\./)).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(9);
    expect(screen.getByText("Buscar archivos y contenido")).toBeInTheDocument();
    expect(screen.getByText("⌘ / Ctrl + K")).toBeInTheDocument();
    expect(screen.getByText("Mostrar / ocultar explorador")).toBeInTheDocument();
    expect(screen.getByText("⌘ / Ctrl + \\")).toBeInTheDocument();
    expect(screen.getByText("Negrita / cursiva")).toBeInTheDocument();
    expect(screen.getByText("Nuevo documento")).toBeInTheDocument();
  });

  it("el botón de cerrar pide cerrar el diálogo", () => {
    const { props } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Cerrar ajustes" }));

    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("muestra el pie local-first del mockup", () => {
    renderDialog();

    expect(screen.getByText("INKLINE / LOCAL-FIRST")).toBeInTheDocument();
  });

  it("vuelve a Apariencia al reabrirse", () => {
    const props = {
      open: true,
      onOpenChange: vi.fn(),
      settings: { ...DEFAULT_SETTINGS },
      onChange: vi.fn(),
      currentRoot: null,
      onChooseRoot: vi.fn(),
      onExportHtml: vi.fn(),
      onOpenPrint: vi.fn(),
    };
    const { rerender } = render(<SettingsDialog {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "Atajos" }));
    expect(screen.getByText("Nuevo documento")).toBeInTheDocument();

    rerender(<SettingsDialog {...props} open={false} />);
    rerender(<SettingsDialog {...props} open />);

    expect(screen.getByText("Tipografía de lectura")).toBeInTheDocument();
    expect(screen.queryByText("Nuevo documento")).not.toBeInTheDocument();
  });
});
