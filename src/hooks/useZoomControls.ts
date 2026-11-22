/**
 * Zoom global del texto (ODD editor groups · T1).
 *
 * Editor y visor escalan juntos. El valor se lee del almacén dentro de cada
 * manejador para que el atajo no dependa del render en el que se disparó.
 */

import { useCallback } from "react";
import { getSettingsSnapshot, updateSettings, zoomStep } from "@/lib/settings";

export interface ZoomControls {
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
}

export function useZoomControls(): ZoomControls {
  const zoomIn = useCallback(() => {
    updateSettings({ zoom: zoomStep(getSettingsSnapshot().zoom, 1) });
  }, []);
  const zoomOut = useCallback(() => {
    updateSettings({ zoom: zoomStep(getSettingsSnapshot().zoom, -1) });
  }, []);
  const resetZoom = useCallback(() => {
    updateSettings({ zoom: 100 });
  }, []);

  return { zoomIn, zoomOut, resetZoom };
}
