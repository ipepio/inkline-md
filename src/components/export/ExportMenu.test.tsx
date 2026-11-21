import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { ExportMenu, type ExportMenuHandle } from "./ExportMenu";

// Mismos stubs que usan los popups de `ui/` en jsdom (medición + foco).
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

const dialog = vi.hoisted(() => ({ save: vi.fn() }));
const opener = vi.hoisted(() => ({ openPath: vi.fn(), revealItemInDir: vi.fn() }));
const path = vi.hoisted(() => ({
  tempDir: vi.fn(async () => "/tmp/"),
  join: vi.fn(async (...parts: string[]) => parts.join("").replace(/\/+/g, "/")),
}));
const files = vi.hoisted(() => ({ saveTextFile: vi.fn(async () => {}) }));

vi.mock("@tauri-apps/plugin-dialog", () => ({ save: dialog.save }));
vi.mock("@tauri-apps/plugin-opener", () => ({
  openPath: opener.openPath,
  revealItemInDir: opener.revealItemInDir,
}));
vi.mock("@tauri-apps/api/path", () => ({ tempDir: path.tempDir, join: path.join }));
vi.mock("@/lib/files", () => ({ saveTextFile: files.saveTextFile }));
// El pipeline real se ejercita en `lib/export/html.test.ts`; aquí basta su salida.
vi.mock("@/lib/markdown/render", () => ({
  renderToHtml: vi.fn(async (markdown: string) => `<p>${markdown.trim()}</p>`),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  dialog.save.mockResolvedValue(null);
  opener.openPath.mockResolvedValue(undefined);
  opener.revealItemInDir.mockResolvedValue(undefined);
  files.saveTextFile.mockResolvedValue(undefined);
});

const props = {
  markdown: "# Guía\n\nTexto.",
  docTitle: "guia.md",
  theme: "dark" as const,
  onStatus: vi.fn(),
};

async function openMenu() {
  fireEvent.click(screen.getByRole("button", { name: /Exportar/ }));
  return screen.findByRole("menu");
}

describe("ExportMenu", () => {
  it("muestra el disparador de exportación del mockup", () => {
    render(<ExportMenu {...props} />);

    const trigger = screen.getByRole("button", { name: /Exportar/ });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
  });

  it("ofrece las tres acciones con la copia en español del mockup", async () => {
    render(<ExportMenu {...props} />);
    await openMenu();

    expect(screen.getByText("Descargar Markdown")).toBeInTheDocument();
    expect(screen.getByText("Copia .md del documento original")).toBeInTheDocument();
    expect(screen.getByText("Exportar HTML")).toBeInTheDocument();
    expect(screen.getByText("Archivo autónomo con estilos embebidos")).toBeInTheDocument();
    expect(screen.getByText("⌘E")).toBeInTheDocument();
    expect(screen.getByText("Imprimir / Guardar PDF")).toBeInTheDocument();
    expect(
      screen.getByText("Abre el diálogo de impresión del sistema"),
    ).toBeInTheDocument();
  });

  it("deshabilita las acciones cuando no hay documento activo", async () => {
    render(<ExportMenu {...props} markdown={null} />);
    await openMenu();

    for (const label of ["Descargar Markdown", "Exportar HTML", "Imprimir / Guardar PDF"]) {
      const item = screen.getByText(label).closest("[role='menuitem']");
      expect(item).not.toBeNull();
      expect(item).toHaveAttribute("aria-disabled", "true");
    }
  });

  it("exporta el HTML autónomo al pulsar «Exportar HTML»", async () => {
    dialog.save.mockResolvedValue("/Users/yo/guia.html");
    render(<ExportMenu {...props} />);
    await openMenu();

    fireEvent.click(screen.getByText("Exportar HTML"));

    await waitFor(() => expect(files.saveTextFile).toHaveBeenCalled());
    const [target, contents] = files.saveTextFile.mock.calls[0] as unknown as [string, string];
    expect(target).toBe("/Users/yo/guia.html");
    expect(contents).toContain("<title>guia.md</title>");
    expect(contents).toContain("<p># Guía");
    expect(dialog.save).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultPath: "guia.html",
        filters: [{ name: "HTML", extensions: ["html"] }],
      }),
    );
    expect(props.onStatus).toHaveBeenCalledWith("Exportado: /Users/yo/guia.html");
  });

  it("informa la cancelación sin lanzar ni escribir nada", async () => {
    dialog.save.mockResolvedValue(null);
    render(<ExportMenu {...props} />);
    await openMenu();

    fireEvent.click(screen.getByText("Exportar HTML"));

    await waitFor(() => expect(props.onStatus).toHaveBeenCalledWith("Exportación cancelada"));
    expect(files.saveTextFile).not.toHaveBeenCalled();
  });

  it("descarga una copia .md del documento original", async () => {
    dialog.save.mockResolvedValue("/Users/yo/guia.md");
    render(<ExportMenu {...props} />);
    await openMenu();

    fireEvent.click(screen.getByText("Descargar Markdown"));

    await waitFor(() =>
      expect(props.onStatus).toHaveBeenCalledWith("Exportado: /Users/yo/guia.md"),
    );
    expect(files.saveTextFile).toHaveBeenCalledWith("/Users/yo/guia.md", "# Guía\n\nTexto.");
    expect(dialog.save).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultPath: "guia.md",
        filters: [{ name: "Markdown", extensions: ["md", "markdown", "txt"] }],
      }),
    );
  });

  it("prepara el PDF abriendo el HTML en el navegador del sistema", async () => {
    render(<ExportMenu {...props} />);
    await openMenu();

    fireEvent.click(screen.getByText("Imprimir / Guardar PDF"));

    await waitFor(() => expect(opener.openPath).toHaveBeenCalledWith("/tmp/guia.html"));
    expect(files.saveTextFile).toHaveBeenCalledWith(
      "/tmp/guia.html",
      expect.stringContaining("<title>guia.md</title>"),
    );
    expect(props.onStatus).toHaveBeenCalledWith(expect.stringContaining("navegador"));
  });

  it("nunca lanza al llamador cuando el sistema rechaza la apertura", async () => {
    opener.openPath.mockRejectedValue(new Error("forbidden path"));
    render(<ExportMenu {...props} />);
    await openMenu();

    fireEvent.click(screen.getByText("Imprimir / Guardar PDF"));

    await waitFor(() => expect(opener.revealItemInDir).toHaveBeenCalledWith("/tmp/guia.html"));
    expect(props.onStatus).toHaveBeenCalledWith(expect.stringContaining("/tmp/guia.html"));
  });

  it("convierte un fallo de escritura en un mensaje de estado, sin propagarlo", async () => {
    dialog.save.mockResolvedValue("/Users/yo/guia.html");
    files.saveTextFile.mockRejectedValue(new Error("disco lleno"));
    const ref = createRef<ExportMenuHandle>();
    render(<ExportMenu {...props} ref={ref} />);

    await act(async () => {
      await ref.current?.exportHtml();
    });

    expect(props.onStatus).toHaveBeenCalledWith("Error al exportar: disco lleno");
  });

  it("expone exportHtml para el atajo ⌘E del shell", async () => {
    dialog.save.mockResolvedValue("/Users/yo/guia.html");
    const ref = createRef<ExportMenuHandle>();
    render(<ExportMenu {...props} ref={ref} />);

    await act(async () => {
      await ref.current?.exportHtml();
    });

    expect(files.saveTextFile).toHaveBeenCalledWith(
      "/Users/yo/guia.html",
      expect.stringContaining("<title>guia.md</title>"),
    );
    expect(props.onStatus).toHaveBeenCalledWith("Exportado: /Users/yo/guia.html");
  });

  it("sin documento, el handle no escribe ni lanza", async () => {
    const ref = createRef<ExportMenuHandle>();
    render(<ExportMenu {...props} markdown={null} ref={ref} />);

    await act(async () => {
      await ref.current?.exportHtml();
    });

    expect(dialog.save).not.toHaveBeenCalled();
    expect(files.saveTextFile).not.toHaveBeenCalled();
    expect(props.onStatus).toHaveBeenCalledWith("No hay ningún documento que exportar");
  });
});
