mod commands;
mod export;
#[cfg(desktop)]
mod menu;
mod workspace;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::read_file,
            commands::write_file,
            export::convert_to_office,
            workspace::list_tree,
            workspace::get_workspace,
            workspace::set_workspace,
            workspace::get_recents,
            workspace::push_recent
        ]);

    // Barra de menús nativa (T7): los ítems emiten `inkline://menu` y el
    // frontend los despacha a las mismas acciones que los atajos.
    #[cfg(desktop)]
    {
        builder = builder
            .setup(|app| {
                menu::install(app.handle())?;
                Ok(())
            })
            .on_menu_event(menu::on_menu_event);
    }

    builder
        .run(tauri::generate_context!())
        .expect("error al ejecutar la aplicación Inkline");
}
