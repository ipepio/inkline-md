use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Serialize, Deserialize)]
pub struct TextDoc {
    pub path: String,
    pub contents: String,
}

#[tauri::command]
pub fn read_file(path: String) -> Result<TextDoc, String> {
    let contents = fs::read_to_string(&path).map_err(|e| format!("no se pudo leer {path}: {e}"))?;
    Ok(TextDoc { path, contents })
}

#[tauri::command]
pub fn write_file(path: String, contents: String) -> Result<(), String> {
    write_atomically(&path, &contents).map_err(|e| format!("no se pudo escribir {path}: {e}"))
}

/// Write via a temp file in the same directory plus rename, so a crash never
/// leaves a truncated document behind.
pub fn write_atomically(path: &str, contents: &str) -> std::io::Result<()> {
    let target = Path::new(path);
    let dir = match target.parent() {
        Some(p) if !p.as_os_str().is_empty() => p,
        _ => return Err(invalid_input("la ruta no tiene directorio padre")),
    };
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let tmp_path = dir.join(format!(".inkline-tmp-{}-{nanos}.tmp", std::process::id()));
    {
        let mut file = fs::File::create(&tmp_path)?;
        file.write_all(contents.as_bytes())?;
        file.sync_all()?;
    }
    match fs::rename(&tmp_path, target) {
        Ok(()) => Ok(()),
        Err(e) => {
            let _ = fs::remove_file(&tmp_path);
            Err(e)
        }
    }
}

fn invalid_input(msg: &str) -> std::io::Error {
    std::io::Error::new(std::io::ErrorKind::InvalidInput, msg)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scratch_dir(tag: &str) -> std::path::PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir =
            std::env::temp_dir().join(format!("inkline-t1-{tag}-{}-{nanos}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn write_file_replaces_content_without_leaving_temporaries() {
        let dir = scratch_dir("write");
        let doc = dir.join("doc.md");
        let doc_str = doc.to_str().unwrap().to_string();

        write_atomically(&doc_str, "uno").unwrap();
        assert_eq!(fs::read_to_string(&doc).unwrap(), "uno");

        write_atomically(&doc_str, "dos").unwrap();
        assert_eq!(fs::read_to_string(&doc).unwrap(), "dos");

        let leftovers: Vec<String> = fs::read_dir(&dir)
            .unwrap()
            .filter_map(|e| e.ok())
            .map(|e| e.file_name().to_string_lossy().to_string())
            .filter(|n| n.contains("tmp"))
            .collect();
        assert!(leftovers.is_empty(), "temporales residuales: {leftovers:?}");

        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn write_file_rejects_path_without_parent_dir() {
        let err = write_atomically("doc-sin-directorio.md", "x").unwrap_err();
        assert_eq!(err.kind(), std::io::ErrorKind::InvalidInput);
    }

    #[test]
    fn read_file_returns_doc_and_errors_on_missing() {
        let dir = scratch_dir("read");
        let doc = dir.join("doc.md");
        fs::write(&doc, "hola inkline").unwrap();

        let doc_str = doc.to_str().unwrap().to_string();
        let text = read_file(doc_str.clone()).unwrap();
        assert_eq!(text.contents, "hola inkline");
        assert_eq!(text.path, doc_str);

        let missing = read_file(dir.join("no-existe.md").to_str().unwrap().to_string());
        assert!(missing.is_err());

        fs::remove_dir_all(&dir).unwrap();
    }
}
