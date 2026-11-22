//! Exportación multiplataforma a formatos de oficina (`.docx` y `.odt`).
//!
//! Genera directamente paquetes OOXML (`.docx`) y ODF 1.2 (`.odt`) en Rust
//! puro a partir del modelo estructural enviado por el frontend, sin depender
//! de `textutil`, pandoc ni LibreOffice: funciona por igual en Windows, Linux
//! y macOS.
//!
//! La escritura al archivo de destino es atómica (`commands::write_bytes_atomically`:
//! temporal en el mismo directorio + `sync_all` + `rename`), así que nunca
//! deja archivos truncados ni temporales residuales.

mod docx;
pub mod model;
mod odt;
mod zip;

use std::path::Path;

use crate::commands::write_bytes_atomically;
use model::OfficeDoc;

/// Formatos de oficina soportados en todos los sistemas operativos.
const OFFICE_FORMATS: [&str; 2] = ["docx", "odt"];

/// Genera un documento de oficina (`.docx` u `.odt`) a partir de `doc` y lo
/// escribe de forma atómica en `target`.
///
/// Devuelve la ruta escrita para que el frontend la muestre en la barra de estado.
#[tauri::command]
pub fn convert_to_office(
    doc: OfficeDoc,
    format: String,
    target: String,
) -> Result<String, String> {
    if !OFFICE_FORMATS.contains(&format.as_str()) {
        return Err(format!(
            "formato no soportado: {format} (usa docx u odt)"
        ));
    }

    let target_path = Path::new(&target);
    if !has_parent(target_path) {
        return Err("la ruta no tiene directorio padre".to_string());
    }

    let bytes = match format.as_str() {
        "docx" => docx::build_docx(&doc),
        "odt" => odt::build_odt(&doc),
        _ => unreachable!(),
    };

    write_bytes_atomically(&target, &bytes)
        .map_err(|e| format!("no se pudo convertir a {format}: {e}"))?;

    Ok(target)
}

fn has_parent(path: &Path) -> bool {
    matches!(path.parent(), Some(parent) if !parent.as_os_str().is_empty())
}

#[cfg(test)]
mod tests {
    use super::*;
    use model::{OfficeBlock, OfficeListItem, OfficeRun, OfficeTableCell, TextAlign};
    use std::fs;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn scratch_dir(tag: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir =
            std::env::temp_dir().join(format!("inkline-office-{tag}-{}-{nanos}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn sample_doc() -> OfficeDoc {
        OfficeDoc {
            title: "Guía <rápida> & notas".to_string(),
            blocks: vec![
                OfficeBlock::Heading {
                    level: 1,
                    runs: vec![OfficeRun::Text {
                        text: "Título principal".to_string(),
                        bold: false,
                        italic: false,
                        strike: false,
                        code: false,
                        href: None,
                    }],
                },
                OfficeBlock::Paragraph {
                    runs: vec![
                        OfficeRun::Text {
                            text: "Texto con ".to_string(),
                            bold: false,
                            italic: false,
                            strike: false,
                            code: false,
                            href: None,
                        },
                        OfficeRun::Text {
                            text: "negrita".to_string(),
                            bold: true,
                            italic: false,
                            strike: false,
                            code: false,
                            href: None,
                        },
                        OfficeRun::Text {
                            text: ", ".to_string(),
                            bold: false,
                            italic: false,
                            strike: false,
                            code: false,
                            href: None,
                        },
                        OfficeRun::Text {
                            text: "código".to_string(),
                            bold: false,
                            italic: false,
                            strike: false,
                            code: true,
                            href: None,
                        },
                        OfficeRun::Text {
                            text: " y ".to_string(),
                            bold: false,
                            italic: false,
                            strike: false,
                            code: false,
                            href: None,
                        },
                        OfficeRun::Text {
                            text: "enlace".to_string(),
                            bold: false,
                            italic: false,
                            strike: false,
                            code: false,
                            href: Some("https://example.com/?a=1&b=2".to_string()),
                        },
                    ],
                },
                OfficeBlock::List {
                    ordered: false,
                    start: None,
                    items: vec![
                        OfficeListItem {
                            checked: Some(true),
                            blocks: vec![OfficeBlock::Paragraph {
                                runs: vec![OfficeRun::Text {
                                    text: "Hecho".to_string(),
                                    bold: false,
                                    italic: false,
                                    strike: false,
                                    code: false,
                                    href: None,
                                }],
                            }],
                        },
                        OfficeListItem {
                            checked: Some(false),
                            blocks: vec![OfficeBlock::Paragraph {
                                runs: vec![OfficeRun::Text {
                                    text: "Pendiente".to_string(),
                                    bold: false,
                                    italic: false,
                                    strike: false,
                                    code: false,
                                    href: None,
                                }],
                            }],
                        },
                    ],
                },
                OfficeBlock::List {
                    ordered: true,
                    start: Some(3),
                    items: vec![OfficeListItem {
                        checked: None,
                        blocks: vec![OfficeBlock::Paragraph {
                            runs: vec![OfficeRun::Text {
                                text: "Tercero".to_string(),
                                bold: false,
                                italic: false,
                                strike: false,
                                code: false,
                                href: None,
                            }],
                        }],
                    }],
                },
                OfficeBlock::Blockquote {
                    blocks: vec![OfficeBlock::Paragraph {
                        runs: vec![OfficeRun::Text {
                            text: "Cita destacada".to_string(),
                            bold: false,
                            italic: false,
                            strike: false,
                            code: false,
                            href: None,
                        }],
                    }],
                },
                OfficeBlock::CodeBlock {
                    language: Some("rust".to_string()),
                    code: "fn main() {\n    println!(\"hola\");\n}\n".to_string(),
                },
                OfficeBlock::Table {
                    headers: vec![
                        OfficeTableCell {
                            align: Some(TextAlign::Left),
                            runs: vec![OfficeRun::Text {
                                text: "Sistema".to_string(),
                                bold: false,
                                italic: false,
                                strike: false,
                                code: false,
                                href: None,
                            }],
                        },
                        OfficeTableCell {
                            align: Some(TextAlign::Center),
                            runs: vec![OfficeRun::Text {
                                text: "Estado".to_string(),
                                bold: false,
                                italic: false,
                                strike: false,
                                code: false,
                                href: None,
                            }],
                        },
                    ],
                    rows: vec![vec![
                        OfficeTableCell {
                            align: Some(TextAlign::Left),
                            runs: vec![OfficeRun::Text {
                                text: "Windows".to_string(),
                                bold: false,
                                italic: false,
                                strike: false,
                                code: false,
                                href: None,
                            }],
                        },
                        OfficeTableCell {
                            align: Some(TextAlign::Center),
                            runs: vec![OfficeRun::Text {
                                text: "OK".to_string(),
                                bold: false,
                                italic: false,
                                strike: false,
                                code: false,
                                href: None,
                            }],
                        },
                    ]],
                },
                OfficeBlock::ThematicBreak,
            ],
        }
    }

    /// Extrae todas las entradas de un ZIP STORE para inspeccionar su contenido.
    fn read_stored_zip_entries(bytes: &[u8]) -> Vec<(String, Vec<u8>)> {
        let mut entries = Vec::new();
        let mut pos = 0usize;
        while pos + 30 <= bytes.len() && &bytes[pos..pos + 4] == b"PK\x03\x04" {
            let method = u16::from_le_bytes([bytes[pos + 8], bytes[pos + 9]]);
            assert_eq!(method, 0, "se esperaba método STORE");
            let size = u32::from_le_bytes([
                bytes[pos + 18],
                bytes[pos + 19],
                bytes[pos + 20],
                bytes[pos + 21],
            ]) as usize;
            let name_len = u16::from_le_bytes([bytes[pos + 26], bytes[pos + 27]]) as usize;
            let extra_len = u16::from_le_bytes([bytes[pos + 28], bytes[pos + 29]]) as usize;
            let name_start = pos + 30;
            let data_start = name_start + name_len + extra_len;
            let name = String::from_utf8(bytes[name_start..name_start + name_len].to_vec()).unwrap();
            let data = bytes[data_start..data_start + size].to_vec();
            entries.push((name, data));
            pos = data_start + size;
        }
        entries
    }

    #[test]
    fn convert_to_office_writes_valid_docx_and_odt_without_external_tools() {
        let dir = scratch_dir("office");
        let doc = sample_doc();

        for format in ["docx", "odt"] {
            let target = dir.join(format!("documento.{format}"));
            let target_str = target.to_str().unwrap().to_string();

            let returned = convert_to_office(doc.clone(), format.to_string(), target_str.clone())
                .unwrap_or_else(|e| panic!("{format}: {e}"));

            assert_eq!(returned, target_str);
            let bytes = fs::read(&target).unwrap();
            assert!(bytes.starts_with(b"PK\x03\x04"), "{format} no es un ZIP");

            let entries = read_stored_zip_entries(&bytes);
            if format == "docx" {
                let names: Vec<&str> = entries.iter().map(|(n, _)| n.as_str()).collect();
                assert!(names.contains(&"[Content_Types].xml"));
                assert!(names.contains(&"word/document.xml"));
                assert!(names.contains(&"word/styles.xml"));
                assert!(names.contains(&"word/numbering.xml"));
                assert!(names.contains(&"word/_rels/document.xml.rels"));

                let document_xml = std::str::from_utf8(
                    &entries
                        .iter()
                        .find(|(n, _)| n == "word/document.xml")
                        .unwrap()
                        .1,
                )
                .unwrap();
                assert!(document_xml.contains("Heading1"));
                assert!(document_xml.contains("Título principal"));
                assert!(document_xml.contains("☑ "));
                assert!(document_xml.contains("☐ "));
                assert!(document_xml.contains("RUST"));
                assert!(document_xml.contains("<w:tbl>"));
                assert!(document_xml.contains("w:hyperlink r:id=\"rId3\""));

                let rels_xml = std::str::from_utf8(
                    &entries
                        .iter()
                        .find(|(n, _)| n == "word/_rels/document.xml.rels")
                        .unwrap()
                        .1,
                )
                .unwrap();
                assert!(rels_xml.contains("https://example.com/?a=1&amp;b=2"));

                let numbering_xml = std::str::from_utf8(
                    &entries
                        .iter()
                        .find(|(n, _)| n == "word/numbering.xml")
                        .unwrap()
                        .1,
                )
                .unwrap();
                assert!(numbering_xml.contains("startOverride w:val=\"3\""));
            } else {
                // ODF 1.2: `mimetype` debe ser la primera entrada exacta.
                assert_eq!(entries[0].0, "mimetype");
                assert_eq!(
                    entries[0].1,
                    b"application/vnd.oasis.opendocument.text"
                );
                let content_xml = std::str::from_utf8(
                    &entries
                        .iter()
                        .find(|(n, _)| n == "content.xml")
                        .unwrap()
                        .1,
                )
                .unwrap();
                assert!(content_xml.contains("Heading_20_1"));
                assert!(content_xml.contains("Título principal"));
                assert!(content_xml.contains("☑ "));
                assert!(content_xml.contains("text:start-value=\"3\""));
                assert!(content_xml.contains("https://example.com/?a=1&amp;b=2"));
                assert!(content_xml.contains("<table:table"));
                // Espacios de sangría en bloques de código preservados con <text:s/>.
                assert!(content_xml.contains("<text:s text:c=\"3\"/>"));
            }
        }

        // Ningún temporal residual en el directorio destino.
        let leftovers: Vec<String> = fs::read_dir(&dir)
            .unwrap()
            .filter_map(|e| e.ok())
            .map(|e| e.file_name().to_string_lossy().to_string())
            .filter(|n| n.contains(".inkline-tmp-"))
            .collect();
        assert!(leftovers.is_empty(), "temporales residuales: {leftovers:?}");

        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn convert_to_office_rejects_unknown_format() {
        let dir = scratch_dir("formato");
        let target = dir.join("documento.pdf");

        let err = convert_to_office(
            sample_doc(),
            "pdf".to_string(),
            target.to_str().unwrap().to_string(),
        )
        .unwrap_err();

        assert!(err.contains("pdf"), "error sin el formato: {err}");
        assert!(
            err.contains("docx") && err.contains("odt"),
            "error sin formatos válidos: {err}"
        );
        assert!(
            !target.exists(),
            "un formato inválido no debe escribir nada"
        );

        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn convert_to_office_rejects_target_without_parent_dir() {
        let target = "documento-sin-directorio.docx";

        let err = convert_to_office(sample_doc(), "docx".to_string(), target.to_string())
            .unwrap_err();

        assert!(err.contains("directorio padre"), "error inesperado: {err}");
        assert!(!Path::new(target).exists());
    }

    #[test]
    fn convert_to_office_reports_failure_when_parent_dir_is_missing() {
        let dir = scratch_dir("fallo");
        let target = dir.join("carpeta-inexistente").join("documento.docx");

        let err = convert_to_office(
            sample_doc(),
            "docx".to_string(),
            target.to_str().unwrap().to_string(),
        )
        .unwrap_err();

        assert!(
            err.contains("no se pudo convertir a docx"),
            "error inesperado: {err}"
        );
        assert!(!target.exists());

        fs::remove_dir_all(&dir).unwrap();
    }
}
