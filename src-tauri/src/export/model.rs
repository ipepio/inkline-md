//! Modelo intermedio de documento para exportación a formatos de oficina
//! (`.docx` y `.odt`).
//!
//! El frontend parsea el Markdown con el mismo `markdown-it` del visor y envía
//! este árbol tipado al backend Rust, que construye el paquete ZIP/XML nativo
//! sin depender de binarios externos del sistema operativo.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TextAlign {
    Left,
    Center,
    Right,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum OfficeRun {
    Text {
        text: String,
        #[serde(default)]
        bold: bool,
        #[serde(default)]
        italic: bool,
        #[serde(default)]
        strike: bool,
        #[serde(default)]
        code: bool,
        #[serde(default)]
        href: Option<String>,
    },
    Break,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OfficeTableCell {
    #[serde(default)]
    pub align: Option<TextAlign>,
    #[serde(default)]
    pub runs: Vec<OfficeRun>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OfficeListItem {
    #[serde(default)]
    pub checked: Option<bool>,
    #[serde(default)]
    pub blocks: Vec<OfficeBlock>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum OfficeBlock {
    Heading {
        level: u8,
        #[serde(default)]
        runs: Vec<OfficeRun>,
    },
    Paragraph {
        #[serde(default)]
        runs: Vec<OfficeRun>,
    },
    Blockquote {
        #[serde(default)]
        blocks: Vec<OfficeBlock>,
    },
    CodeBlock {
        #[serde(default)]
        language: Option<String>,
        code: String,
    },
    List {
        ordered: bool,
        #[serde(default)]
        start: Option<u32>,
        #[serde(default)]
        items: Vec<OfficeListItem>,
    },
    Table {
        #[serde(default)]
        headers: Vec<OfficeTableCell>,
        #[serde(default)]
        rows: Vec<Vec<OfficeTableCell>>,
    },
    ThematicBreak,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OfficeDoc {
    pub title: String,
    #[serde(default)]
    pub blocks: Vec<OfficeBlock>,
}

/// Escapa texto para XML 1.0 y descarta caracteres de control ilegales en XML
/// (`0x00..=0x08`, `0x0B`, `0x0C`, `0x0E..=0x1F`) para que Word/LibreOffice
/// nunca rechacen el paquete por caracteres inválidos.
pub fn escape_xml(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    for ch in input.chars() {
        match ch {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&apos;"),
            '\t' | '\n' | '\r' => out.push(ch),
            c if (c as u32) < 0x20 => {}
            c => out.push(c),
        }
    }
    out
}
