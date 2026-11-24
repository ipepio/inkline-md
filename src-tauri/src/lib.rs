mod commands;
mod export;
#[cfg(desktop)]
mod menu;
mod open_files;
mod workspace;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default();

    // Instancia única en escritorio: en Windows y Linux, abrir otro `.md`
    // desde el explorador o la terminal reenvía la ruta a la ventana ya
    // abierta y la trae al frente en lugar de lanzar una segunda ventana.
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            let base = if cwd.is_empty() {
                None
            } else {
                Some(std::path::Path::new(&cwd))
            };
            let paths = open_files::paths_from_args_in(args.into_iter().skip(1), base);
            if paths.is_empty() {
                open_files::focus_main_window(app);
            } else {
                open_files::dispatch_open_files(app, paths);
            }
        }));
    }

    builder = builder
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(open_files::PendingOpenFiles::default())
        .invoke_handler(tauri::generate_handler![
            commands::read_file,
            commands::write_file,
            export::convert_to_office,
            open_files::take_pending_open_files,
            workspace::list_tree,
            workspace::get_workspace,
            workspace::set_workspace,
            workspace::get_recents,
            workspace::push_recent
        ]);

    // Barra de menús nativa (T7): los ítems emiten `inkline://menu` y el
    // frontend los despacha a las mismas acciones que los atajos.
    // También se capturan los archivos pasados como argumentos al arrancar.
    #[cfg(desktop)]
    {
        builder = builder
            .setup(|app| {
                menu::install(app.handle())?;
                let initial = open_files::paths_from_args(std::env::args_os().skip(1));
                open_files::dispatch_open_files(app.handle(), initial);
                Ok(())
            })
            .on_menu_event(menu::on_menu_event);
    }

    let app = builder
        .build(tauri::generate_context!())
        .expect("error al construir la aplicación Inkline");

    app.run(|app_handle, event| {
        #[cfg(any(target_os = "macos", target_os = "ios"))]
        if let tauri::RunEvent::Opened { urls } = event {
            let paths = open_files::paths_from_urls(&urls);
            open_files::dispatch_open_files(app_handle, paths);
        }
        #[cfg(not(any(target_os = "macos", target_os = "ios")))]
        let _ = (app_handle, event);
    });
}
