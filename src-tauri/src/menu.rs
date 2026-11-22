//! Menú nativo de Inkline (ODD editor groups · T7 · S3–S5).
//!
//! macOS trae por defecto la barra de menús estándar de Tauri: ítems en inglés
//! que nadie conectó a nada («New», «Open», «Save»… no existen) y ningún atajo
//! de Inkline. Este módulo construye la barra real con la API de menús de Tauri
//! 2 (`MenuBuilder` / `SubmenuBuilder` / `PredefinedMenuItem`) y enruta sus
//! ítems al webview con UN único evento (`inkline://menu`) cuyo payload es el id
//! estable del ítem. El frontend (`useNativeMenu`) los despacha a las MISMAS
//! acciones que los atajos de teclado, así que menú y teclado no pueden
//! divergir.
//!
//! Los aceleradores están declarados con la forma de Tauri/muda
//! (`CmdOrCtrl+X`): en macOS se muestran como ⌘X y en Windows/Linux como
//! Ctrl+X. Dos detalles de la API que condicionan la tabla:
//!
//! - Tauri parsea el acelerador con `.ok()` (tauri 2.12,
//!   `src/menu/normal.rs`): un acelerador inválido no falla, deja el ítem SIN
//!   atajo. Por eso «Ampliar texto» usa `CmdOrCtrl+=` (⌘=) y no `CmdOrCtrl++`:
//!   `muda` no tiene código físico para la tecla «+» (`parse_code` sólo conoce
//!   nombres como `EQUAL`), así que `CmdOrCtrl++` se descartaría en silencio.
//!   ⌘+ sigue funcionando por el `keydown` del webview, que acepta `=`, `+` y
//!   el `+` del teclado numérico.
//! - No hay acelerador para la paleta de comandos (⌘K) a propósito: la paleta
//!   es del webview y, si macOS reclamara la tecla, el ítem del menú se la
//!   comería y la paleta dejaría de abrirse.
//!
//! El sistema operativo consume el acelerador del menú antes de entregar la
//! pulsación al webview (NSMenu en macOS, `TranslateAcceleratorW` en Windows,
//! `gtk::AccelGroup` en Linux), así que una pulsación produce o el evento del
//! menú o el `keydown` del webview, nunca los dos.

use tauri::menu::{Menu, MenuBuilder, MenuItem, MenuItemBuilder, SubmenuBuilder};
use tauri::{AppHandle, Emitter, Manager, Runtime};

/// Evento que el menú nativo emite al webview. El payload es el id del ítem
/// (`inkline:save`, `inkline:split`…), no la acción: el frontend traduce.
pub const MENU_EVENT: &str = "inkline://menu";

/// Prefijo de los ids propios. Lo que no empieza así (los ítems predefinidos de
/// Editar/Ventana, que los resuelve el sistema) no se emite.
const MENU_ID_PREFIX: &str = "inkline:";

/// Ítem propio del menú: id estable, etiqueta en español y acelerador.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct MenuItemSpec {
    pub id: &'static str,
    pub label: &'static str,
    pub accelerator: &'static str,
}

/// Bloque de ítems propios. Entre bloque y bloque el menú pone un separador
/// nativo, que es lo que separa «Guardar» de «Cerrar documento» sin numerar
/// posiciones a mano.
pub type MenuBlock = &'static [MenuItemSpec];

/// Archivo: documento y preferencias.
pub const FILE_BLOCKS: &[MenuBlock] = &[
    &[
        MenuItemSpec {
            id: "inkline:new",
            label: "Nuevo documento",
            accelerator: "CmdOrCtrl+N",
        },
        MenuItemSpec {
            id: "inkline:open",
            label: "Abrir…",
            accelerator: "CmdOrCtrl+O",
        },
        MenuItemSpec {
            id: "inkline:save",
            label: "Guardar",
            accelerator: "CmdOrCtrl+S",
        },
    ],
    &[MenuItemSpec {
        id: "inkline:close",
        label: "Cerrar documento",
        accelerator: "CmdOrCtrl+W",
    }],
    &[MenuItemSpec {
        id: "inkline:export",
        label: "Exportar HTML",
        accelerator: "CmdOrCtrl+E",
    }],
    &[MenuItemSpec {
        id: "inkline:settings",
        label: "Preferencias…",
        accelerator: "CmdOrCtrl+,",
    }],
];

/// Editar: lo propio de la app va después de los ítems nativos de edición.
pub const EDIT_FORMAT_BLOCK: MenuBlock = &[
    MenuItemSpec {
        id: "inkline:bold",
        label: "Negrita",
        accelerator: "CmdOrCtrl+B",
    },
    MenuItemSpec {
        id: "inkline:italic",
        label: "Cursiva",
        accelerator: "CmdOrCtrl+I",
    },
];

/// Ver: grupos de edición, zoom global y explorador.
pub const VIEW_BLOCKS: &[MenuBlock] = &[
    &[MenuItemSpec {
        id: "inkline:split",
        label: "Dividir editor",
        accelerator: "CmdOrCtrl+D",
    }],
    &[
        MenuItemSpec {
            id: "inkline:zoom-in",
            label: "Ampliar texto",
            // Ver el comentario del módulo: muda no tiene código físico para
            // la tecla «+», así que el acelerador es el «=» sin Shift (⌘=).
            accelerator: "CmdOrCtrl+=",
        },
        MenuItemSpec {
            id: "inkline:zoom-out",
            label: "Reducir texto",
            accelerator: "CmdOrCtrl+-",
        },
        MenuItemSpec {
            id: "inkline:zoom-reset",
            label: "Restablecer zoom",
            accelerator: "CmdOrCtrl+0",
        },
    ],
    &[MenuItemSpec {
        id: "inkline:sidebar",
        label: "Alternar explorador",
        accelerator: "CmdOrCtrl+\\",
    }],
];

/// Añade a `submenu` los bloques de ítems propios, con un separador entre ellos.
fn push_blocks<'m, R: Runtime, M: Manager<R>>(
    mut submenu: SubmenuBuilder<'m, R, M>,
    manager: &'m M,
    blocks: &[MenuBlock],
) -> tauri::Result<SubmenuBuilder<'m, R, M>> {
    for (index, block) in blocks.iter().enumerate() {
        if index > 0 {
            submenu = submenu.separator();
        }
        for spec in *block {
            let item: MenuItem<R> = MenuItemBuilder::with_id(spec.id, spec.label)
                .accelerator(spec.accelerator)
                .build(manager)?;
            submenu = submenu.item(&item);
        }
    }
    Ok(submenu)
}

/// Submenú de la aplicación en macOS (About/Services/Hide/Quit nativos), con el
/// mismo contenido que el menú predefinido de Tauri: es el que macOS usa como
/// menú de la app (primer submenú de la barra).
#[cfg(target_os = "macos")]
fn app_submenu<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<tauri::menu::Submenu<R>> {
    use tauri::menu::{AboutMetadata, PredefinedMenuItem};

    let pkg_info = app.package_info();
    let config = app.config();
    let about = AboutMetadata {
        name: Some(pkg_info.name.clone()),
        version: Some(pkg_info.version.to_string()),
        copyright: config.bundle.copyright.clone(),
        authors: config
            .bundle
            .publisher
            .clone()
            .map(|publisher| vec![publisher]),
        ..Default::default()
    };

    SubmenuBuilder::new(app, pkg_info.name.clone())
        .item(&PredefinedMenuItem::about(app, None, Some(about))?)
        .separator()
        .item(&PredefinedMenuItem::services(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::hide(app, None)?)
        .item(&PredefinedMenuItem::hide_others(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::quit(app, None)?)
        .build()
}

/// Submenú Ventana de macOS. `WINDOW_SUBMENU_ID` lo registra como el menú de
/// ventanas del sistema (macOS añade ahí la lista de ventanas y «Traer todo al
/// frente»).
///
/// No incluye el `close_window` predefinido: muda le da ⌘W en macOS
/// (`PredefinedMenuItemType::CloseWindow`), el MISMO acelerador que «Cerrar
/// documento», y dos ítems con la misma tecla dejan uno muerto (deep link a S5:
/// ⌘W cierra el documento del grupo con foco, no la ventana).
#[cfg(target_os = "macos")]
fn window_submenu<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<tauri::menu::Submenu<R>> {
    use tauri::menu::{PredefinedMenuItem, WINDOW_SUBMENU_ID};

    SubmenuBuilder::with_id(app, WINDOW_SUBMENU_ID, "Ventana")
        .item(&PredefinedMenuItem::minimize(app, Some("Minimizar"))?)
        .separator()
        .item(&PredefinedMenuItem::maximize(app, Some("Zoom"))?)
        .build()
}

/// Construye la barra completa. En macOS el primer submenú es el de la app y el
/// de Ventana es el de ventanas; en Windows/Linux esos dos no existen.
pub fn build<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    let archivo = push_blocks(SubmenuBuilder::new(app, "Archivo"), app, FILE_BLOCKS)?.build()?;

    let editar = push_blocks(
        SubmenuBuilder::new(app, "Editar")
            .undo_with_text("Deshacer")
            .redo_with_text("Rehacer")
            .separator()
            .cut_with_text("Cortar")
            .copy_with_text("Copiar")
            .paste_with_text("Pegar")
            .select_all_with_text("Seleccionar todo")
            .separator(),
        app,
        &[EDIT_FORMAT_BLOCK],
    )?
    .build()?;

    let ver = push_blocks(SubmenuBuilder::new(app, "Ver"), app, VIEW_BLOCKS)?.build()?;

    let mut menu = MenuBuilder::new(app);
    #[cfg(target_os = "macos")]
    {
        menu = menu.item(&app_submenu(app)?);
    }
    menu = menu.item(&archivo).item(&editar).item(&ver);
    #[cfg(target_os = "macos")]
    {
        menu = menu.item(&window_submenu(app)?);
    }
    menu.build()
}

/// Instala la barra: menú de la aplicación (barra global) en macOS y menú de la
/// ventana en Windows/Linux, que es donde el sistema lo dibuja.
pub fn install<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let menu = build(app)?;
    #[cfg(target_os = "macos")]
    {
        app.set_menu(menu)?;
    }
    #[cfg(not(target_os = "macos"))]
    {
        if let Some(window) = app.get_webview_window("main") {
            window.set_menu(menu)?;
        }
    }
    Ok(())
}

/// `on_menu_event`: un solo evento para todos los ítems propios. Los ids que no
/// son nuestros (los predefinidos no emiten) se ignoran.
pub fn on_menu_event<R: Runtime>(app: &AppHandle<R>, event: tauri::menu::MenuEvent) {
    let id = event.id().as_ref();
    if !id.starts_with(MENU_ID_PREFIX) {
        return;
    }
    let _ = app.emit(MENU_EVENT, id.to_string());
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Todos los ítems propios, en el orden en que aparecen en la barra.
    fn custom_items() -> Vec<&'static MenuItemSpec> {
        FILE_BLOCKS
            .iter()
            .chain(std::iter::once(&EDIT_FORMAT_BLOCK))
            .chain(VIEW_BLOCKS.iter())
            .flat_map(|block| block.iter())
            .collect()
    }

    /// La tabla completa del menú: id, etiqueta y acelerador. Es el contrato con
    /// el frontend (`nativeMenu.ts`), así que se fija entero.
    #[test]
    fn la_tabla_del_menu_es_la_esperada() {
        let actual: Vec<(&str, &str, &str)> = custom_items()
            .into_iter()
            .map(|spec| (spec.id, spec.label, spec.accelerator))
            .collect();
        let expected: Vec<(&str, &str, &str)> = vec![
            ("inkline:new", "Nuevo documento", "CmdOrCtrl+N"),
            ("inkline:open", "Abrir…", "CmdOrCtrl+O"),
            ("inkline:save", "Guardar", "CmdOrCtrl+S"),
            ("inkline:close", "Cerrar documento", "CmdOrCtrl+W"),
            ("inkline:export", "Exportar HTML", "CmdOrCtrl+E"),
            ("inkline:settings", "Preferencias…", "CmdOrCtrl+,"),
            ("inkline:bold", "Negrita", "CmdOrCtrl+B"),
            ("inkline:italic", "Cursiva", "CmdOrCtrl+I"),
            ("inkline:split", "Dividir editor", "CmdOrCtrl+D"),
            ("inkline:zoom-in", "Ampliar texto", "CmdOrCtrl+="),
            ("inkline:zoom-out", "Reducir texto", "CmdOrCtrl+-"),
            ("inkline:zoom-reset", "Restablecer zoom", "CmdOrCtrl+0"),
            ("inkline:sidebar", "Alternar explorador", "CmdOrCtrl+\\"),
        ];
        assert_eq!(actual, expected);
    }

    /// Los ids son estables, propios y únicos: el frontend los busca por texto y
    /// `on_menu_event` filtra por el prefijo.
    #[test]
    fn los_ids_son_unicos_y_llevan_el_prefijo() {
        let items = custom_items();
        let mut ids: Vec<&str> = items.iter().map(|spec| spec.id).collect();
        assert!(ids.iter().all(|id| id.starts_with(MENU_ID_PREFIX)));
        assert!(ids.iter().all(|id| !id.trim().is_empty()));

        let total = ids.len();
        ids.sort_unstable();
        ids.dedup();
        assert_eq!(ids.len(), total, "hay ids repetidos en el menú");
    }

    /// Los aceleradores están en la forma declarativa de Tauri (`CmdOrCtrl+` más
    /// un código físico que muda entienda). No se pueden validar con un parseo
    /// aquí (tauri los parsea al construir el menú, y eso pide una app); la
    /// tabla fija es la garantía de que todos son códigos conocidos.
    #[test]
    fn los_aceleradores_son_declarativos_y_no_vacios() {
        for spec in custom_items() {
            let key = spec
                .accelerator
                .strip_prefix("CmdOrCtrl+")
                .unwrap_or_else(|| panic!("{} no usa la forma CmdOrCtrl+X", spec.id));
            assert!(!key.is_empty(), "{} no declara tecla", spec.id);
            assert_ne!(key, "+", "{}: muda no tiene la tecla física «+»", spec.id);
        }
    }

    /// ⌘K no entra en el menú: la paleta de comandos es del webview y si macOS
    /// reclamara la tecla el atajo dejaría de funcionar.
    #[test]
    fn la_paleta_de_comandos_queda_fuera_del_menu() {
        for spec in custom_items() {
            assert_ne!(spec.accelerator, "CmdOrCtrl+K", "{}", spec.id);
            assert!(!spec.id.contains("palette"), "{}", spec.id);
            assert!(!spec.id.contains("command-palette"), "{}", spec.id);
        }
    }
}
