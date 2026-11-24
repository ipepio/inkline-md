//! Apertura de archivos enviados por el sistema operativo («Abrir con», doble
//! clic en Finder, arrastrar al icono del Dock o argumentos de línea de órdenes).
//!
//! En macOS el evento `RunEvent::Opened` puede llegar ANTES de que el webview
//! haya montado React y registrado su escucha de eventos. Para no perder esos
//! archivos ni abrirlos dos veces se usa una cola con señal de preparación:
//!
//! 1. Antes de que el frontend llame a `take_pending_open_files`, todas las
//!    rutas (de argumentos CLI o de `RunEvent::Opened`) se acumulan en la cola.
//! 2. Al arrancar, el frontend registra primero `listen("inkline://open-files")`
//!    y después invoca `take_pending_open_files`, que marca la cola como lista y
//!    devuelve las rutas acumuladas en un único paso atómico.
//! 3. A partir de ese instante cualquier `RunEvent::Opened` posterior se emite
//!    directamente al webview y trae la ventana principal al frente.

use std::ffi::OsString;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, Runtime};

/// Evento emitido al webview cuando el sistema operativo pide abrir archivos
/// mientras la aplicación ya está lista.
pub const OPEN_FILES_EVENT: &str = "inkline://open-files";

#[derive(Default)]
struct OpenFilesQueue {
    ready: bool,
    pending: Vec<String>,
}

/// Estado gestionado por Tauri que coordina la entrega sin condiciones de
/// carrera entre `RunEvent::Opened` / argumentos CLI y el arranque del webview.
#[derive(Default)]
pub struct PendingOpenFiles(Mutex<OpenFilesQueue>);

impl PendingOpenFiles {
    /// Registra rutas para abrir. Si el frontend ya está listo devuelve las
    /// rutas para emitirlas al instante; si aún no lo está las encola.
    pub fn enqueue_or_dispatch(&self, paths: Vec<String>) -> Option<Vec<String>> {
        let unique = dedup_non_empty(paths);
        if unique.is_empty() {
            return None;
        }
        let mut queue = self.0.lock().unwrap_or_else(|e| e.into_inner());
        if queue.ready {
            return Some(unique);
        }
        for path in unique {
            if !queue.pending.contains(&path) {
                queue.pending.push(path);
            }
        }
        None
    }

    /// Marca el frontend como listo y vacía las rutas pendientes acumuladas.
    pub fn take_pending_and_mark_ready(&self) -> Vec<String> {
        let mut queue = self.0.lock().unwrap_or_else(|e| e.into_inner());
        queue.ready = true;
        std::mem::take(&mut queue.pending)
    }
}

/// Extrae rutas de archivos existentes a partir de los argumentos de proceso
/// (ignorando flags como `-psn_0_...` en macOS, directorios o rutas inexistentes).
pub fn paths_from_args<I, S>(args: I) -> Vec<String>
where
    I: IntoIterator<Item = S>,
    S: Into<OsString>,
{
    paths_from_args_in(args, None)
}

/// Como [`paths_from_args`], resolviendo rutas relativas contra `base_dir`
/// (útil cuando una segunda instancia reenvía argumentos con su propio `cwd`).
pub fn paths_from_args_in<I, S>(args: I, base_dir: Option<&Path>) -> Vec<String>
where
    I: IntoIterator<Item = S>,
    S: Into<OsString>,
{
    let mut out = Vec::new();
    for raw in args {
        let os: OsString = raw.into();
        if let Some(s) = os.to_str() {
            if s.is_empty() || s.starts_with('-') {
                continue;
            }
        }
        let candidate = PathBuf::from(&os);
        let path = match base_dir {
            Some(dir) if candidate.is_relative() => dir.join(&candidate),
            _ => candidate,
        };
        if let Some(resolved) = existing_file_path(&path) {
            if !out.contains(&resolved) {
                out.push(resolved);
            }
        }
    }
    out
}

/// Extrae rutas de archivos existentes a partir de URLs `file://` entregadas
/// por macOS (`RunEvent::Opened`).
#[cfg_attr(not(any(target_os = "macos", target_os = "ios")), allow(dead_code))]
pub fn paths_from_urls(urls: &[tauri::Url]) -> Vec<String> {
    let mut out = Vec::new();
    for url in urls {
        if let Ok(path) = url.to_file_path() {
            if let Some(resolved) = existing_file_path(&path) {
                if !out.contains(&resolved) {
                    out.push(resolved);
                }
            }
        }
    }
    out
}

/// Muestra y enfoca la ventana principal (p. ej. al recibir archivos o al
/// intentar abrir una segunda instancia).
pub fn focus_main_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// Encola o emite las rutas recibidas del sistema operativo. Cuando la app ya
/// está en marcha también muestra y enfoca la ventana principal.
pub fn dispatch_open_files<R: Runtime>(app: &AppHandle<R>, paths: Vec<String>) {
    let Some(state) = app.try_state::<PendingOpenFiles>() else {
        return;
    };
    if let Some(ready_paths) = state.enqueue_or_dispatch(paths) {
        let _ = app.emit(OPEN_FILES_EVENT, ready_paths);
        focus_main_window(app);
    }
}

/// Comando invocado por el frontend al terminar de registrar su escucha:
/// devuelve los archivos pendientes del arranque y habilita la emisión en vivo.
#[tauri::command]
pub fn take_pending_open_files(state: tauri::State<'_, PendingOpenFiles>) -> Vec<String> {
    state.take_pending_and_mark_ready()
}

fn existing_file_path(path: &Path) -> Option<String> {
    if !path.is_file() {
        return None;
    }
    let normalized = path.canonicalize().unwrap_or_else(|_| path.to_path_buf());
    Some(normalized.to_string_lossy().into_owned())
}

fn dedup_non_empty(paths: Vec<String>) -> Vec<String> {
    let mut out = Vec::with_capacity(paths.len());
    for path in paths {
        if !path.is_empty() && !out.contains(&path) {
            out.push(path);
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn scratch_dir(tag: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir =
            std::env::temp_dir().join(format!("inkline-open-{tag}-{}-{nanos}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn queues_before_ready_deduplicates_and_drains_once() {
        let state = PendingOpenFiles::default();

        assert_eq!(
            state.enqueue_or_dispatch(vec!["/a.md".into(), "/b.md".into(), "/a.md".into()]),
            None
        );
        assert_eq!(
            state.enqueue_or_dispatch(vec!["/b.md".into(), "/c.md".into()]),
            None
        );

        let drained = state.take_pending_and_mark_ready();
        assert_eq!(drained, vec!["/a.md", "/b.md", "/c.md"]);

        // Un segundo drenaje no vuelve a entregar nada.
        assert!(state.take_pending_and_mark_ready().is_empty());

        // Una vez listo, las aperturas posteriores se devuelven al instante.
        assert_eq!(
            state.enqueue_or_dispatch(vec!["/d.md".into(), "".into(), "/d.md".into()]),
            Some(vec!["/d.md".into()])
        );
    }

    #[test]
    fn paths_from_args_filters_flags_dirs_and_missing_files() {
        let dir = scratch_dir("args");
        let md = dir.join("nota.md");
        let subdir = dir.join("carpeta");
        fs::write(&md, "# hola").unwrap();
        fs::create_dir_all(&subdir).unwrap();

        let args = vec![
            "-psn_0_12345".to_string(),
            "--devtools".to_string(),
            subdir.to_string_lossy().into_owned(),
            dir.join("no-existe.md").to_string_lossy().into_owned(),
            md.to_string_lossy().into_owned(),
            md.to_string_lossy().into_owned(),
        ];

        let found = paths_from_args(args);
        assert_eq!(found.len(), 1);
        assert_eq!(
            PathBuf::from(&found[0]),
            md.canonicalize().unwrap()
        );

        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn paths_from_urls_handles_file_urls_with_spaces_and_ignores_non_files() {
        let dir = scratch_dir("urls");
        let md = dir.join("mi nota.md");
        fs::write(&md, "# con espacio").unwrap();

        let file_url = tauri::Url::from_file_path(&md).unwrap();
        let dir_url = tauri::Url::from_file_path(&dir).unwrap();
        let http_url = tauri::Url::parse("https://example.com/doc.md").unwrap();

        let found = paths_from_urls(&[http_url, dir_url, file_url.clone(), file_url]);
        assert_eq!(found.len(), 1);
        assert_eq!(PathBuf::from(&found[0]), md.canonicalize().unwrap());

        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn paths_from_args_in_resolves_relative_paths_against_cwd() {
        let dir = scratch_dir("cwd");
        let md = dir.join("relativo.md");
        fs::write(&md, "# relativo").unwrap();

        let found = paths_from_args_in(["relativo.md", "-v", "no-existe.md"], Some(&dir));
        assert_eq!(found.len(), 1);
        assert_eq!(PathBuf::from(&found[0]), md.canonicalize().unwrap());

        fs::remove_dir_all(&dir).unwrap();
    }
}
