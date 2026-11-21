import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// El proyecto corre vitest con `globals: false`, así que el auto-cleanup de
// Testing Library no se registra solo: sin esto, cada test acumula el DOM del
// anterior (y aparecen dos apps montadas, con selectores duplicados).
afterEach(() => {
  cleanup();
});
