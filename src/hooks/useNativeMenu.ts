/**
 * Menú nativo → acciones del shell (ODD editor groups · T7).
 *
 * Rust construye la barra (Archivo/Editar/Ver y, en macOS, la app y Ventana) y
 * `on_menu_event` emite UN evento `inkline://menu` con el id estable del ítem.
 * Aquí se escucha ese evento y se despacha con `applyShellAction`: los MISMOS
 * manejadores que `useShellShortcuts`, que App monta al lado. Un ítem del menú
 * no puede hacer algo distinto de su acelerador porque comparten el despacho.
 *
 * ## ¿Doble disparo?
 *
 * No: en las tres plataformas el acelerador lo consume el sistema operativo
 * antes de que el webview vea la pulsación, así que una pulsación produce o el
 * evento del menú o el `keydown` del shell, nunca los dos.
 *
 * - **macOS**: muda registra el acelerador como `NSMenuItem.keyEquivalent`
 *   (muda 0.20, `platform_impl/macos/ns_menu_item.rs`). AppKit resuelve los key
 *   equivalents de la barra en `NSApplication.sendEvent` →
 *   `NSMenu.performKeyEquivalent:` antes de entregar el evento al primer
 *   responder, que es el WKWebView: el `keydown` no llega.
 * - **Windows**: muda compila los aceleradores a una tabla `HACCEL` por menú y
 *   Tauri la traduce en el bucle de mensajes con `TranslateAcceleratorW`
 *   (tauri 2.12, `src/app.rs`, `msg_hook`). El `WM_KEYDOWN` se convierte en
 *   `WM_COMMAND` y no se despacha al HWND del webview.
 * - **Linux (GTK)**: muda instala los aceleradores en la ventana con
 *   `gtk::AccelGroup` (GTK 3) o `gtk_application_set_accels_for_action` (GTK 4);
 *   GTK los resuelve al procesar la tecla, antes de que el widget del webview
 *   reciba el `key-press-event`.
 *
 * Por eso no hay deduplicación: deduplicar exigiría comparar marcas de tiempo
 * entre dos caminos que nunca coinciden, y enmascararía un fallo real de
 * enrutado. Si algún día apareciera un doble disparo, el sitio para arreglarlo
 * es aquí (por ejemplo, ignorar el evento del menú cuyo id llegue en el mismo
 * tick que su tecla), y estas tres referencias son lo que habría que revisar.
 *
 * El escucha se registra UNA sola vez: `listen` es asíncrono y los manejadores
 * cambian de identidad con cada documento, así que se leen desde un ref en vez
 * de reabrir el canal (reabrirlo dejaría huecos sin escucha). Fuera de Tauri
 * (`pnpm dev` en un navegador) `listen` falla: se ignora el error, porque no hay
 * menú nativo que escuchar.
 */

import { useEffect, useRef } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { MENU_EVENT, menuAction } from "./nativeMenu";
import { applyShellAction, type ShellActionHandlers } from "./shellAction";

/** Los mismos manejadores que recibe `useShellShortcuts`. */
export type NativeMenuOptions = ShellActionHandlers;

export function useNativeMenu(handlers: NativeMenuOptions): void {
  const handlersRef = useRef(handlers);

  // El ref se actualiza después de cada render y el canal de eventos lee siempre
  // el último valor: cerrar y reabrir el escucha por cada cambio de manejador
  // dejaría ventanas sin escucha (y `listen` es asíncrono).
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    let unlisten: UnlistenFn | undefined;
    let cancelled = false;

    void listen<string>(MENU_EVENT, (event) => {
      const action = menuAction(event.payload);
      // Ids ajenos (ítems nativos, eventos de terceros): no son nuestros.
      if (action === null) return;
      applyShellAction(action, handlersRef.current);
    })
      .then((off) => {
        if (cancelled) off();
        else unlisten = off;
      })
      .catch(() => {
        // Sin Tauri no hay menú nativo (desarrollo en navegador).
      });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);
}
