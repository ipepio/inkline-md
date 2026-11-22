import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { resetSettings, updateSettings } from "@/lib/settings";
import { DEMO_NOTICE } from "@/lib/demo/mode";
import App from "./App";

/**
 * Modo demo web (ODD «landing bilingüe con demo embebida», S6): con
 * `VITE_DEMO=1` y sin puente nativo la app abre el documento de ejemplo en vez
 * de preguntar al backend por el espacio de trabajo. Aquí no se simula el
 * puente de Tauri, así que el caso que se prueba es exactamente el del iframe
 * de la landing: `invoke` no existe y no debe aparecer ningún error.
 */
describe("App (modo demo web)", () => {
  it("abre el documento de ejemplo y no reporta el espacio de trabajo", async () => {
    vi.stubEnv("VITE_DEMO", "1");
    updateSettings({ defaultView: "preview" });
    try {
      render(<App />);

      // La barra de estado explica el contexto en lugar de mostrar el TypeError.
      expect(await screen.findByText(DEMO_NOTICE)).toBeInTheDocument();
      // El documento de ejemplo se abre de verdad: pestaña y migas de pan.
      expect((await screen.findAllByText("README.md")).length).toBeGreaterThan(1);
      // Hay un documento activo con contenido. Se comprueba por el recuento de
      // la barra de estado y no por el Markdown renderizado: el modo de vista
      // puede ser editor (CodeMirror no monta todo el texto en jsdom) y el
      // documento de ejemplo incluye un diagrama Mermaid que no siempre
      // renderiza igual en cada entorno.
      await waitFor(() =>
        expect(screen.getByText(/\d+\s+palabras/)).toBeInTheDocument(),
      );
      expect(
        screen.queryByText(/No se pudo cargar el espacio de trabajo/),
      ).not.toBeInTheDocument();
    } finally {
      vi.unstubAllEnvs();
      resetSettings();
    }
  });
});
