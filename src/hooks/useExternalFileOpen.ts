/**
 * Apertura de archivos entregados por el sistema operativo («Abrir con», doble
 * clic en Finder, arrastrar al Dock o argumentos CLI).
 *
 * El orden es crítico para evitar condiciones de carrera en el arranque en frío:
 * primero se registra `listen(OPEN_FILES_EVENT)` y sólo después se invoca
 * `takePendingOpenFiles()`. Así ninguna ruta que llegue durante el arranque se
 * pierde ni se abre por duplicado.
 */

import { useEffect, useRef } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { isDemoMode } from "@/lib/demo/mode";
import { OPEN_FILES_EVENT, takePendingOpenFiles } from "@/lib/files";

export function useExternalFileOpen(onOpenFile: (path: string) => Promise<void> | void): void {
  const onOpenRef = useRef(onOpenFile);

  useEffect(() => {
    onOpenRef.current = onOpenFile;
  });

  useEffect(() => {
    if (isDemoMode()) return;

    let unlisten: UnlistenFn | undefined;
    let cancelled = false;

    const openPaths = async (paths: string[]): Promise<void> => {
      for (const path of paths) {
        if (cancelled) break;
        if (!path) continue;
        await onOpenRef.current(path);
      }
    };

    void (async () => {
      try {
        const off = await listen<string[]>(OPEN_FILES_EVENT, (event) => {
          if (Array.isArray(event.payload)) {
            void openPaths(event.payload);
          }
        });
        if (cancelled) {
          off();
          return;
        }
        unlisten = off;

        const pending = await takePendingOpenFiles();
        if (!cancelled && pending.length > 0) {
          await openPaths(pending);
        }
      } catch {
        // Sin runtime de Tauri (desarrollo en navegador o tests sin mock).
      }
    })();

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);
}
