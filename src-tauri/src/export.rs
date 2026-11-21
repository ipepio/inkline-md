//! Exportación a formatos de oficina (ODD T7 · S4 «Exportación»).
//!
//! Inkline es macOS-first (S3) y macOS trae `/usr/bin/textutil`, que convierte
//! HTML en documentos de Word (`doc`, `docx`) y OpenDocument (`odt`) de verdad
//! (contenedores ZIP válidos), sin instalar pandoc ni LibreOffice. La
//! conversión vive en Rust, no en el frontend, por dos razones:
//!
//! 1. El frontend sólo produce el HTML estructural del documento; el binario
//!    del sistema lo ejecuta el backend, que es quien puede hablar con él.
//! 2. El archivo final lo escribe textutil directamente en la ruta elegida:
//!    Inkline nunca escribe bytes binarios a mano.
//!
//! Contrato de fallo: nunca se deja un temporal detrás (se borra tanto en el
//! camino feliz como en el de error) y nunca se entra en pánico: el error
//! vuelve como texto en español con el diagnóstico de textutil para que el
//! menú de exportación lo muestre tal cual.

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

/// Formatos de textutil que Inkline acepta. La UI ofrece `docx` y `odt`; `doc`
/// (el formato clásico de Word) se mantiene porque no cuesta nada soportarlo.
const OFFICE_FORMATS: [&str; 3] = ["doc", "docx", "odt"];

/// Convierte `html` a un documento de oficina en `target` usando `textutil`.
///
/// Devuelve la ruta escrita para que el frontend la muestre en el estado.
#[tauri::command]
pub fn convert_to_office(html: String, format: String, target: String) -> Result<String, String> {
    if !OFFICE_FORMATS.contains(&format.as_str()) {
        return Err(format!(
            "formato no soportado: {format} (usa doc, docx u odt)"
        ));
    }

    let target_path = Path::new(&target);
    if !has_parent(target_path) {
        return Err("la ruta no tiene directorio padre".to_string());
    }

    // La extensión `.html` del temporal es la que hace que textutil interprete
    // la entrada como HTML en vez de texto plano.
    let tmp_path = unique_temp_path();
    fs::write(&tmp_path, html.as_bytes())
        .map_err(|e| format!("no se pudo preparar la conversión: {e}"))?;

    let output = Command::new("textutil")
        .arg("-convert")
        .arg(&format)
        .arg("-output")
        .arg(&target)
        .arg(&tmp_path)
        .output();

    let converted = match output {
        Err(e) => Err(format!("no se pudo ejecutar textutil: {e}")),
        // textutil sale con código 0 incluso cuando no pudo leer la entrada
        // («Error reading …»), así que el éxito se confirma en el destino.
        Ok(out) if out.status.success() && is_non_empty(target_path) => Ok(target.clone()),
        Ok(out) => Err(format!(
            "no se pudo convertir a {format}: {}",
            stderr_tail(&out.stderr)
        )),
    };

    let _ = fs::remove_file(&tmp_path);
    converted
}

/// Mismo criterio que `commands::write_atomically`: sin directorio padre no hay
/// destino válido. Se duplica aquí (tres líneas) para no acoplar los módulos.
fn has_parent(path: &Path) -> bool {
    matches!(path.parent(), Some(parent) if !parent.as_os_str().is_empty())
}

fn is_non_empty(path: &Path) -> bool {
    fs::metadata(path).map(|meta| meta.len() > 0).unwrap_or(false)
}

/// Última línea del stderr de textutil: es donde repite el mensaje útil.
fn stderr_tail(raw: &[u8]) -> String {
    let text = String::from_utf8_lossy(raw);
    let last = text
        .lines()
        .rev()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .unwrap_or("");
    if last.is_empty() {
        "textutil no dio detalles".to_string()
    } else {
        last.to_string()
    }
}

/// Temporal único en el directorio temporal del sistema, con el prefijo propio
/// para poder reconocer un residuo si alguna vez queda uno.
fn unique_temp_path() -> PathBuf {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|delta| delta.as_nanos())
        .unwrap_or(0);
    std::env::temp_dir().join(format!(
        "inkline-export-{}-{nanos}.html",
        std::process::id()
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;
    use std::time::{SystemTime, UNIX_EPOCH};

    /// textutil tarda lo suficiente como para que dos tests en paralelo vean el
    /// temporal del otro en `std::env::temp_dir()`: la comprobación de residuos
    /// se serializa para que la foto de antes/después sea fiable.
    static TEMP_SCAN: Mutex<()> = Mutex::new(());

    fn temp_scan_guard() -> std::sync::MutexGuard<'static, ()> {
        TEMP_SCAN.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    const SAMPLE_HTML: &str = "<!doctype html><html lang=\"es\"><head><meta charset=\"utf-8\">\
<title>Título</title></head><body><h1>Título</h1><p>Hola</p></body></html>";

    fn scratch_dir(tag: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!(
            "inkline-t7-{tag}-{}-{nanos}",
            std::process::id()
        ));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    /// Temporales propios que sobreviven en el directorio temporal del sistema.
    fn leftover_exports() -> Vec<String> {
        fs::read_dir(std::env::temp_dir())
            .map(|entries| {
                entries
                    .flatten()
                    .map(|entry| entry.file_name().to_string_lossy().to_string())
                    .filter(|name| name.starts_with("inkline-export-"))
                    .collect()
            })
            .unwrap_or_default()
    }

    fn new_leftovers(before: &[String]) -> Vec<String> {
        leftover_exports()
            .into_iter()
            .filter(|name| !before.contains(name))
            .collect()
    }

    /// El temporal debe desaparecer; se tolera una ventana breve para no ser
    /// frágil ante actividad concurrente del propio directorio temporal.
    fn assert_no_new_leftovers(before: &[String]) {
        let deadline = std::time::Instant::now() + std::time::Duration::from_secs(2);
        loop {
            let created = new_leftovers(before);
            if created.is_empty() {
                return;
            }
            if std::time::Instant::now() >= deadline {
                panic!("temporales residuales: {created:?}");
            }
            std::thread::sleep(std::time::Duration::from_millis(25));
        }
    }

    #[test]
    fn convert_to_office_writes_docx_and_odt() {
        let _scan = temp_scan_guard();
        let dir = scratch_dir("office");
        let before = leftover_exports();

        for format in ["docx", "odt"] {
            let target = dir.join(format!("documento.{format}"));
            let target_str = target.to_str().unwrap().to_string();

            let returned =
                convert_to_office(SAMPLE_HTML.to_string(), format.to_string(), target_str.clone())
                    .unwrap_or_else(|e| panic!("{format}: {e}"));

            assert_eq!(returned, target_str);
            let bytes = fs::read(&target).unwrap();
            assert!(!bytes.is_empty(), "{format} quedó vacío");
            // docx y odt son contenedores ZIP: la conversión es real, no texto.
            assert!(
                bytes.starts_with(b"PK"),
                "{format} no parece un documento de oficina"
            );
        }

        assert_no_new_leftovers(&before);

        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn convert_to_office_rejects_unknown_format() {        let dir = scratch_dir("formato");
        let target = dir.join("documento.pdf");

        let err = convert_to_office(
            SAMPLE_HTML.to_string(),
            "pdf".to_string(),
            target.to_str().unwrap().to_string(),
        )
        .unwrap_err();

        assert!(err.contains("pdf"), "error sin el formato: {err}");
        assert!(
            err.contains("docx") && err.contains("odt"),
            "error sin formatos válidos: {err}"
        );
        assert!(!target.exists(), "un formato inválido no debe escribir nada");

        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn convert_to_office_rejects_target_without_parent_dir() {
        let target = "documento-sin-directorio.docx";

        let err =
            convert_to_office(SAMPLE_HTML.to_string(), "docx".to_string(), target.to_string())
                .unwrap_err();

        assert!(err.contains("directorio padre"), "error inesperado: {err}");
        assert!(!Path::new(target).exists());
    }

    #[test]
    fn convert_to_office_reports_failure_and_cleans_up() {
        let _scan = temp_scan_guard();
        let dir = scratch_dir("fallo");
        // El directorio padre no existe: textutil falla al escribir el destino.
        let target = dir.join("carpeta-inexistente").join("documento.docx");
        let before = leftover_exports();

        let err = convert_to_office(
            SAMPLE_HTML.to_string(),
            "docx".to_string(),
            target.to_str().unwrap().to_string(),
        )
        .unwrap_err();

        assert!(
            err.contains("no se pudo convertir a docx"),
            "error inesperado: {err}"
        );
        assert!(!target.exists());

        assert_no_new_leftovers(&before);

        fs::remove_dir_all(&dir).unwrap();
    }
}
