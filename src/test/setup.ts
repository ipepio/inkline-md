import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// El proyecto corre vitest con `globals: false`, así que el auto-cleanup de
// Testing Library no se registra solo: sin esto, cada test acumula el DOM del
// anterior (y aparecen dos apps montadas, con selectores duplicados).
afterEach(() => {
  cleanup();
});

// jsdom no implementa ResizeObserver, y los paneles redimensionables lo usan
// para medir el contenedor. En el WebView real (WKWebView) es nativo; aquí
// basta un doble inerte para que el componente monte.
if (!("ResizeObserver" in globalThis)) {
  class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
}
