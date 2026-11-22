//! Espacio de trabajo de Inkline: árbol de archivos, recuerdos y recientes.
//!
//! ODD T4 (S2 · S4). El módulo mantiene dos responsabilidades pequeñas y
//! separadas de la E/S de Tauri:
//!
//! 1. Construir el árbol del drawer (`build_tree`), puro sobre el sistema de
//!    archivos y acotado en profundidad.
//! 2. Recordar la carpeta raíz y los archivos recientes (`WorkspaceConfig`),
//!    persistidos en un JSON dentro del directorio de configuración de la app.
//!
//! Toda la escritura pasa por `commands::write_atomically` para no dejar nunca
//! un JSON truncado detrás.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Manager;

/// Profundidad máxima del árbol: la raíz no cuenta, sus hijos son nivel 1.
pub const MAX_DEPTH: usize = 8;

/// Carpetas que nunca interesan en un espacio de escritura Markdown.
const SKIP_DIRS: [&str; 3] = ["node_modules", "target", ".git"];

/// Extensiones que Inkline sabe leer y editar.
const DOC_EXTENSIONS: [&str; 3] = ["md", "markdown", "txt"];

/// Número máximo de archivos recientes recordados.
pub const MAX_RECENTS: usize = 10;

/// Nombre del archivo de configuración dentro del directorio de la app.
const CONFIG_FILE: &str = "workspace.json";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TreeNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub children: Vec<TreeNode>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentFile {
    pub path: String,
    pub name: String,
    /// Milisegundos desde la época Unix; la UI sólo lo usa para ordenar.
    pub opened_at: u64,
}

/// Estado persistido: raíz recordada + recientes. Ambos opcionales, así un
/// archivo ausente o antiguo se lee como valores por defecto.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct WorkspaceConfig {
    pub root: Option<String>,
    pub recents: Vec<RecentFile>,
}

// ---------------------------------------------------------------------------
// Árbol del drawer
// ---------------------------------------------------------------------------

/// Construye el árbol de `root`: carpetas visibles y archivos Markdown/ texto.
pub fn build_tree(root: &str) -> Result<Vec<TreeNode>, String> {
    let root_path = Path::new(root);
    if !root_path.is_dir() {
        return Err(format!("la carpeta raíz no existe: {root}"));
    }
    read_entries(root_path, 1)
}

fn read_entries(dir: &Path, depth: usize) -> Result<Vec<TreeNode>, String> {
    if depth > MAX_DEPTH {
        return Ok(Vec::new());
    }
    let entries =
        fs::read_dir(dir).map_err(|e| format!("no se pudo leer {}: {e}", dir.display()))?;
    let mut nodes = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        if is_hidden(&name) {
            continue;
        }
        let Ok(file_type) = entry.file_type() else {
            continue;
        };
        // Los enlaces simbólicos podrían crear ciclos o salir del espacio de
        // trabajo: se omiten en lugar de seguirlos.
        if file_type.is_symlink() {
            continue;
        }
        if file_type.is_dir() {
            if SKIP_DIRS.contains(&name.as_str()) {
                continue;
            }
            let children = read_entries(&path, depth + 1).unwrap_or_default();
            nodes.push(TreeNode {
                name,
                path: path.to_string_lossy().to_string(),
                is_dir: true,
                children,
            });
        } else if file_type.is_file() && is_document(&name) {
            nodes.push(TreeNode {
                name,
                path: path.to_string_lossy().to_string(),
                is_dir: false,
                children: Vec::new(),
            });
        }
    }
    sort_nodes(&mut nodes);
    Ok(nodes)
}

/// Carpetas primero, luego archivos; en ambos casos por nombre sin distinguir
/// mayúsculas, que es como se lee una lista de archivos.
fn sort_nodes(nodes: &mut [TreeNode]) {
    nodes.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
            .then_with(|| a.name.cmp(&b.name))
    });
}

fn is_hidden(name: &str) -> bool {
    name.starts_with('.')
}

fn is_document(name: &str) -> bool {
    Path::new(name)
        .extension()
        .map(|ext| ext.to_string_lossy().to_lowercase())
        .map(|ext| DOC_EXTENSIONS.contains(&ext.as_str()))
        .unwrap_or(false)
}

// ---------------------------------------------------------------------------
// Configuración: raíz recordada y recientes
// ---------------------------------------------------------------------------

/// Lee la configuración; un archivo ausente o ilegible da valores por defecto.
pub fn load_config(path: &Path) -> WorkspaceConfig {
    match fs::read_to_string(path) {
        Ok(raw) => parse_config(&raw),
        Err(_) => WorkspaceConfig::default(),
    }
}

/// Interpreta el JSON tolerando un archivo viejo o corrupto: nunca falla.
pub fn parse_config(raw: &str) -> WorkspaceConfig {
    serde_json::from_str(raw).unwrap_or_default()
}

pub fn save_config(path: &Path, config: &WorkspaceConfig) -> Result<(), String> {
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|e| format!("no se pudo crear {}: {e}", dir.display()))?;
    }
    let raw = serde_json::to_string_pretty(config)
        .map_err(|e| format!("no se pudo serializar la configuración: {e}"))?;
    crate::commands::write_atomically(&path.to_string_lossy(), &raw)
        .map_err(|e| format!("no se pudo escribir {}: {e}", path.display()))
}

/// Devuelve la configuración con otra raíz recordada.
pub fn with_root(config: &WorkspaceConfig, root: String) -> WorkspaceConfig {
    WorkspaceConfig {
        root: Some(root),
        recents: config.recents.clone(),
    }
}

/// Devuelve la configuración con `path` al frente de los recientes: sin
/// duplicados (se mueve el existente) y con un tope de `MAX_RECENTS`.
pub fn with_recent(config: &WorkspaceConfig, path: &str, opened_at: u64) -> WorkspaceConfig {
    let recent = RecentFile {
        path: path.to_string(),
        name: file_name_of(path),
        opened_at,
    };
    let mut recents = Vec::with_capacity(MAX_RECENTS);
    recents.push(recent);
    recents.extend(config.recents.iter().filter(|r| r.path != path).cloned());
    recents.truncate(MAX_RECENTS);
    WorkspaceConfig {
        root: config.root.clone(),
        recents,
    }
}

/// Nombre visible del archivo; si la ruta no tiene nombre se usa la ruta tal cual.
pub fn file_name_of(path: &str) -> String {
    Path::new(path)
        .file_name()
        .map(|name| name.to_string_lossy().to_string())
        .unwrap_or_else(|| path.to_string())
}

// ---------------------------------------------------------------------------
// Puente con Tauri
// ---------------------------------------------------------------------------

fn config_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("no se pudo resolver el directorio de configuración: {e}"))?;
    Ok(dir.join(CONFIG_FILE))
}

fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

#[tauri::command]
pub fn list_tree(root: String) -> Result<Vec<TreeNode>, String> {
    build_tree(&root)
}

#[tauri::command]
pub fn get_workspace(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let config = load_config(&config_path(&app)?);
    Ok(config.root)
}

#[tauri::command]
pub fn set_workspace(app: tauri::AppHandle, root: String) -> Result<(), String> {
    let path = config_path(&app)?;
    let config = with_root(&load_config(&path), root);
    save_config(&path, &config)
}

#[tauri::command]
pub fn get_recents(app: tauri::AppHandle) -> Result<Vec<RecentFile>, String> {
    let config = load_config(&config_path(&app)?);
    Ok(config.recents)
}

/// Registra `path` como reciente y devuelve la lista actualizada, para que la
/// UI no necesite una segunda llamada.
#[tauri::command]
pub fn push_recent(app: tauri::AppHandle, path: String) -> Result<Vec<RecentFile>, String> {
    let config_file = config_path(&app)?;
    let config = with_recent(&load_config(&config_file), &path, now_millis());
    save_config(&config_file, &config)?;
    Ok(config.recents)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn scratch_dir(tag: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir =
            std::env::temp_dir().join(format!("inkline-t4-{tag}-{}-{nanos}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn write(dir: &Path, relative: &str, contents: &str) {
        let target = dir.join(relative);
        fs::create_dir_all(target.parent().unwrap()).unwrap();
        fs::write(target, contents).unwrap();
    }

    fn child<'a>(nodes: &'a [TreeNode], name: &str) -> Option<&'a TreeNode> {
        nodes.iter().find(|n| n.name == name)
    }

    #[test]
    fn tree_lists_folders_and_documents_and_skips_noise() {
        let dir = scratch_dir("tree");
        write(&dir, "docs/guia.md", "# Guía");
        write(&dir, "docs/notas.txt", "notas");
        write(&dir, "docs/imagen.png", "no es markdown");
        write(&dir, "docs/.oculto.md", "oculto");
        write(&dir, "node_modules/lib/README.md", "dependencia");
        write(&dir, "target/build.md", "artefacto");
        write(&dir, ".git/config", "git");
        write(&dir, "README.md", "# Inkline");
        write(&dir, "apuntes.MARKDOWN", "mayúsculas");

        let tree = build_tree(dir.to_str().unwrap()).unwrap();
        let names: Vec<&str> = tree.iter().map(|n| n.name.as_str()).collect();
        assert_eq!(names, vec!["docs", "apuntes.MARKDOWN", "README.md"]);

        let docs = child(&tree, "docs").unwrap();
        assert!(docs.is_dir);
        let doc_names: Vec<&str> = docs.children.iter().map(|n| n.name.as_str()).collect();
        assert_eq!(doc_names, vec!["guia.md", "notas.txt"]);
        assert!(docs.children.iter().all(|n| !n.is_dir));
        assert!(docs.path.ends_with("docs"));

        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn tree_stops_at_the_depth_cap() {
        let dir = scratch_dir("depth");
        // f{d} queda en el nivel d; d{d} es la carpeta del siguiente nivel.
        let mut relative = String::new();
        for level in 1..=9 {
            write(&dir, &format!("{relative}f{level}.md"), "x");
            relative.push_str(&format!("d{level}/"));
        }

        let mut level = build_tree(dir.to_str().unwrap()).unwrap();
        for depth in 1..=MAX_DEPTH {
            assert!(
                child(&level, &format!("f{depth}.md")).is_some(),
                "falta f{depth}.md en el nivel {depth}"
            );
            let folder = child(&level, &format!("d{depth}"))
                .unwrap_or_else(|| panic!("falta la carpeta d{depth} en el nivel {depth}"));
            level = folder.children.clone();
        }
        // d8 está en el nivel 8 ya en el tope: no se desciende a d9 ni a f9.md.
        assert!(
            level.is_empty(),
            "el nivel 9 no debería listarse: {level:?}"
        );

        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn tree_errors_when_root_is_missing() {
        let dir = scratch_dir("missing");
        let missing = dir.join("no-existe");
        assert!(build_tree(missing.to_str().unwrap()).is_err());
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn tree_serializes_camel_case() {
        let node = TreeNode {
            name: "README.md".into(),
            path: "/tmp/README.md".into(),
            is_dir: false,
            children: Vec::new(),
        };
        let value = serde_json::to_value(&node).unwrap();
        assert_eq!(value["name"], "README.md");
        assert_eq!(value["isDir"], false);
        assert_eq!(value["path"], "/tmp/README.md");
        assert!(value["children"].as_array().unwrap().is_empty());
        assert!(value.get("is_dir").is_none());
    }

    #[test]
    fn recents_are_most_recent_first_and_deduplicated() {
        let empty = WorkspaceConfig::default();
        let first = with_recent(&empty, "/tmp/a.md", 1);
        assert_eq!(first.recents.len(), 1);
        assert_eq!(first.recents[0].name, "a.md");
        assert_eq!(first.recents[0].opened_at, 1);

        let second = with_recent(&first, "/tmp/b.md", 2);
        let paths: Vec<&str> = second.recents.iter().map(|r| r.path.as_str()).collect();
        assert_eq!(paths, vec!["/tmp/b.md", "/tmp/a.md"]);

        // Reabrir a.md lo mueve al frente sin duplicarlo.
        let third = with_recent(&second, "/tmp/a.md", 3);
        let paths: Vec<&str> = third.recents.iter().map(|r| r.path.as_str()).collect();
        assert_eq!(paths, vec!["/tmp/a.md", "/tmp/b.md"]);
        assert_eq!(third.recents[0].opened_at, 3);
    }

    #[test]
    fn recents_cap_at_ten() {
        let mut config = WorkspaceConfig::default();
        for index in 0..15 {
            config = with_recent(&config, &format!("/tmp/doc-{index}.md"), index as u64);
        }
        assert_eq!(config.recents.len(), MAX_RECENTS);
        assert_eq!(config.recents[0].path, "/tmp/doc-14.md");
        assert_eq!(config.recents[MAX_RECENTS - 1].path, "/tmp/doc-5.md");
    }

    #[test]
    fn missing_config_file_yields_defaults() {
        let dir = scratch_dir("config-missing");
        let config = load_config(&dir.join(CONFIG_FILE));
        assert_eq!(config, WorkspaceConfig::default());
        assert!(config.root.is_none());
        assert!(config.recents.is_empty());
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn config_roundtrips_atomically_in_camel_case() {
        let dir = scratch_dir("config-roundtrip");
        let path = dir.join("anidado").join(CONFIG_FILE);
        let config = with_recent(
            &with_root(&WorkspaceConfig::default(), "/tmp/espacio".into()),
            "/tmp/espacio/README.md",
            7,
        );

        save_config(&path, &config).unwrap();
        assert_eq!(load_config(&path), config);

        let raw = fs::read_to_string(&path).unwrap();
        assert!(raw.contains("\"openedAt\""));
        assert!(raw.contains("\"root\""));
        assert!(raw.contains("\"recents\""));

        let leftovers: Vec<String> = fs::read_dir(path.parent().unwrap())
            .unwrap()
            .filter_map(|e| e.ok())
            .map(|e| e.file_name().to_string_lossy().to_string())
            .filter(|name| name.contains("tmp"))
            .collect();
        assert!(leftovers.is_empty(), "temporales residuales: {leftovers:?}");

        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn corrupt_config_falls_back_to_defaults() {
        assert_eq!(parse_config("no es json"), WorkspaceConfig::default());
        assert_eq!(
            parse_config(r#"{"recents":[{"path":"/tmp/a.md","name":"a.md","openedAt":1}]}"#),
            WorkspaceConfig {
                root: None,
                recents: vec![RecentFile {
                    path: "/tmp/a.md".into(),
                    name: "a.md".into(),
                    opened_at: 1,
                }],
            }
        );
    }

    #[test]
    fn file_name_of_uses_the_last_path_segment() {
        assert_eq!(file_name_of("/tmp/espacio/README.md"), "README.md");
        assert_eq!(file_name_of("suelto.md"), "suelto.md");
        assert_eq!(file_name_of("/tmp/espacio/"), "espacio");
    }
}
