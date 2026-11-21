mod commands;
mod export;
mod workspace;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
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
        ])
        .run(tauri::generate_context!())
        .expect("error al ejecutar la aplicación Inkline");
}
