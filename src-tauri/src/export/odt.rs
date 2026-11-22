//! Generador nativo de OpenDocument Text (`.odt` / OASIS ODF 1.2).
//!
//! Produce un paquete ZIP ODF 1.2 completo (`mimetype` sin comprimir en primera
//! posición, `META-INF/manifest.xml`, `meta.xml`, `styles.xml` y `content.xml`)
//! compatible con LibreOffice Writer, OpenOffice, Word y Google Docs en
//! Windows, Linux y macOS.

use super::model::{
    escape_xml, OfficeBlock, OfficeDoc, OfficeListItem, OfficeRun, OfficeTableCell, TextAlign,
};
use super::zip::ZipWriter;

const ODT_MIMETYPE: &[u8] = b"application/vnd.oasis.opendocument.text";

const MANIFEST_XML: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2">
  <manifest:file-entry manifest:full-path="/" manifest:version="1.2" manifest:media-type="application/vnd.oasis.opendocument.text"/>
  <manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
  <manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>
  <manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/>
</manifest:manifest>
"#;

const STYLES_XML: &str = r##"<?xml version="1.0" encoding="UTF-8"?>
<office:document-styles
  xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
  xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"
  xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"
  xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"
  xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0"
  office:version="1.2">
  <office:font-face-decls>
    <style:font-face style:name="Liberation Sans" svg:font-family="'Liberation Sans', Inter, sans-serif" style:font-family-generic="swiss"/>
    <style:font-face style:name="Liberation Mono" svg:font-family="'Liberation Mono', 'Courier New', monospace" style:font-family-generic="modern" style:font-pitch="fixed"/>
  </office:font-face-decls>
  <office:styles>
    <style:default-style style:family="paragraph">
      <style:paragraph-properties fo:margin-top="0cm" fo:margin-bottom="0.22cm" fo:line-height="115%"/>
      <style:text-properties style:font-name="Liberation Sans" fo:font-size="11pt" fo:color="#1f2328" fo:language="es" fo:country="ES"/>
    </style:default-style>

    <style:style style:name="Standard" style:family="paragraph" style:class="text"/>

    <style:style style:name="Heading_20_1" style:display-name="Heading 1" style:family="paragraph" style:parent-style-name="Standard" style:next-style-name="Standard" style:default-outline-level="1">
      <style:paragraph-properties fo:margin-top="0.55cm" fo:margin-bottom="0.24cm" fo:keep-with-next="always"/>
      <style:text-properties fo:font-size="22pt" fo:font-weight="bold"/>
    </style:style>
    <style:style style:name="Heading_20_2" style:display-name="Heading 2" style:family="paragraph" style:parent-style-name="Standard" style:next-style-name="Standard" style:default-outline-level="2">
      <style:paragraph-properties fo:margin-top="0.45cm" fo:margin-bottom="0.20cm" fo:keep-with-next="always"/>
      <style:text-properties fo:font-size="17pt" fo:font-weight="bold"/>
    </style:style>
    <style:style style:name="Heading_20_3" style:display-name="Heading 3" style:family="paragraph" style:parent-style-name="Standard" style:next-style-name="Standard" style:default-outline-level="3">
      <style:paragraph-properties fo:margin-top="0.36cm" fo:margin-bottom="0.16cm" fo:keep-with-next="always"/>
      <style:text-properties fo:font-size="14pt" fo:font-weight="bold"/>
    </style:style>
    <style:style style:name="Heading_20_4" style:display-name="Heading 4" style:family="paragraph" style:parent-style-name="Standard" style:next-style-name="Standard" style:default-outline-level="4">
      <style:paragraph-properties fo:margin-top="0.30cm" fo:margin-bottom="0.14cm" fo:keep-with-next="always"/>
      <style:text-properties fo:font-size="12pt" fo:font-weight="bold"/>
    </style:style>
    <style:style style:name="Heading_20_5" style:display-name="Heading 5" style:family="paragraph" style:parent-style-name="Standard" style:next-style-name="Standard" style:default-outline-level="5">
      <style:paragraph-properties fo:margin-top="0.26cm" fo:margin-bottom="0.12cm" fo:keep-with-next="always"/>
      <style:text-properties fo:font-size="11pt" fo:font-weight="bold"/>
    </style:style>
    <style:style style:name="Heading_20_6" style:display-name="Heading 6" style:family="paragraph" style:parent-style-name="Standard" style:next-style-name="Standard" style:default-outline-level="6">
      <style:paragraph-properties fo:margin-top="0.22cm" fo:margin-bottom="0.10cm" fo:keep-with-next="always"/>
      <style:text-properties fo:font-size="10pt" fo:font-weight="bold" fo:color="#57606a"/>
    </style:style>

    <style:style style:name="Quotations" style:family="paragraph" style:parent-style-name="Standard">
      <style:paragraph-properties fo:margin-left="0.7cm" fo:margin-top="0.12cm" fo:margin-bottom="0.20cm" fo:padding-left="0.3cm" fo:border-left="2pt solid #c8d1d9"/>
      <style:text-properties fo:font-style="italic" fo:color="#57606a"/>
    </style:style>

    <style:style style:name="Preformatted_20_Text" style:display-name="Preformatted Text" style:family="paragraph" style:parent-style-name="Standard">
      <style:paragraph-properties fo:margin-top="0.16cm" fo:margin-bottom="0.24cm" fo:padding="0.22cm" fo:background-color="#f4f6f8" fo:border="0.5pt solid #e1e6eb" fo:line-height="115%"/>
      <style:text-properties style:font-name="Liberation Mono" fo:font-size="9.5pt"/>
    </style:style>

    <style:style style:name="Code_20_Language" style:display-name="Code Language" style:family="paragraph" style:parent-style-name="Standard">
      <style:paragraph-properties fo:margin-top="0.18cm" fo:margin-bottom="0.04cm" fo:keep-with-next="always"/>
      <style:text-properties fo:font-size="8pt" fo:font-weight="bold" fo:color="#57606a"/>
    </style:style>

    <style:style style:name="Horizontal_20_Line" style:display-name="Horizontal Line" style:family="paragraph" style:parent-style-name="Standard">
      <style:paragraph-properties fo:margin-top="0.2cm" fo:margin-bottom="0.28cm" fo:border-bottom="0.75pt solid #d0d7de"/>
    </style:style>

    <style:style style:name="Internet_20_link" style:display-name="Internet Link" style:family="text">
      <style:text-properties fo:color="#0969da" style:text-underline-style="solid" style:text-underline-width="auto" style:text-underline-color="font-color"/>
    </style:style>

    <text:list-style style:name="List_20_Bullet">
      <text:list-level-style-bullet text:level="1" text:bullet-char="•"><style:list-level-properties text:space-before="0.6cm" text:min-label-width="0.45cm"/></text:list-level-style-bullet>
      <text:list-level-style-bullet text:level="2" text:bullet-char="◦"><style:list-level-properties text:space-before="1.2cm" text:min-label-width="0.45cm"/></text:list-level-style-bullet>
      <text:list-level-style-bullet text:level="3" text:bullet-char="▪"><style:list-level-properties text:space-before="1.8cm" text:min-label-width="0.45cm"/></text:list-level-style-bullet>
      <text:list-level-style-bullet text:level="4" text:bullet-char="•"><style:list-level-properties text:space-before="2.4cm" text:min-label-width="0.45cm"/></text:list-level-style-bullet>
      <text:list-level-style-bullet text:level="5" text:bullet-char="◦"><style:list-level-properties text:space-before="3.0cm" text:min-label-width="0.45cm"/></text:list-level-style-bullet>
    </text:list-style>

    <text:list-style style:name="List_20_Number">
      <text:list-level-style-number text:level="1" style:num-suffix="." style:num-format="1"><style:list-level-properties text:space-before="0.6cm" text:min-label-width="0.55cm"/></text:list-level-style-number>
      <text:list-level-style-number text:level="2" style:num-suffix="." style:num-format="a"><style:list-level-properties text:space-before="1.2cm" text:min-label-width="0.55cm"/></text:list-level-style-number>
      <text:list-level-style-number text:level="3" style:num-suffix="." style:num-format="i"><style:list-level-properties text:space-before="1.8cm" text:min-label-width="0.55cm"/></text:list-level-style-number>
      <text:list-level-style-number text:level="4" style:num-suffix="." style:num-format="1"><style:list-level-properties text:space-before="2.4cm" text:min-label-width="0.55cm"/></text:list-level-style-number>
      <text:list-level-style-number text:level="5" style:num-suffix="." style:num-format="a"><style:list-level-properties text:space-before="3.0cm" text:min-label-width="0.55cm"/></text:list-level-style-number>
    </text:list-style>
  </office:styles>

  <office:automatic-styles>
    <style:page-layout style:name="Mpm1">
      <style:page-layout-properties fo:page-width="21cm" fo:page-height="29.7cm" style:print-orientation="portrait" fo:margin-top="2cm" fo:margin-bottom="2cm" fo:margin-left="2cm" fo:margin-right="2cm"/>
    </style:page-layout>
  </office:automatic-styles>
  <office:master-styles>
    <style:master-page style:name="Standard" style:page-layout-name="Mpm1"/>
  </office:master-styles>
</office:document-styles>
"##;

struct OdtBuilder {
    body: String,
    table_count: usize,
    text_styles: Vec<(String, bool, bool, bool, bool)>, // (name, bold, italic, strike, code)
}

impl OdtBuilder {
    fn new() -> Self {
        Self {
            body: String::with_capacity(4096),
            table_count: 0,
            text_styles: Vec::new(),
        }
    }

    fn text_style_name(&mut self, bold: bool, italic: bool, strike: bool, code: bool) -> String {
        let mut name = String::from("T_");
        if bold {
            name.push('b');
        }
        if italic {
            name.push('i');
        }
        if strike {
            name.push('s');
        }
        if code {
            name.push('c');
        }
        if !self.text_styles.iter().any(|(n, ..)| n == &name) {
            self.text_styles
                .push((name.clone(), bold, italic, strike, code));
        }
        name
    }

    fn write_blocks(&mut self, blocks: &[OfficeBlock], in_quote: bool) {
        for block in blocks {
            self.write_block(block, in_quote);
        }
    }

    fn write_block(&mut self, block: &OfficeBlock, in_quote: bool) {
        match block {
            OfficeBlock::Heading { level, runs } => {
                let clamped = (*level).clamp(1, 6);
                self.body.push_str(&format!(
                    "<text:h text:style-name=\"Heading_20_{clamped}\" text:outline-level=\"{clamped}\">"
                ));
                self.write_runs(runs, false);
                self.body.push_str("</text:h>");
            }
            OfficeBlock::Paragraph { runs } => {
                let style = if in_quote { "Quotations" } else { "Standard" };
                self.body
                    .push_str(&format!("<text:p text:style-name=\"{style}\">"));
                self.write_runs(runs, false);
                self.body.push_str("</text:p>");
            }
            OfficeBlock::Blockquote { blocks } => {
                self.write_blocks(blocks, true);
            }
            OfficeBlock::CodeBlock { language, code } => {
                self.write_code_block(language.as_deref(), code);
            }
            OfficeBlock::List {
                ordered,
                start,
                items,
            } => {
                self.write_list(*ordered, *start, items);
            }
            OfficeBlock::Table { headers, rows } => {
                self.write_table(headers, rows);
            }
            OfficeBlock::ThematicBreak => {
                self.body
                    .push_str("<text:p text:style-name=\"Horizontal_20_Line\"/>");
            }
        }
    }

    fn write_list(&mut self, ordered: bool, start: Option<u32>, items: &[OfficeListItem]) {
        let style = if ordered {
            "List_20_Number"
        } else {
            "List_20_Bullet"
        };
        self.body
            .push_str(&format!("<text:list text:style-name=\"{style}\">"));
        for (idx, item) in items.iter().enumerate() {
            if idx == 0 && ordered {
                if let Some(s) = start.filter(|&v| v > 1) {
                    self.body
                        .push_str(&format!("<text:list-item text:start-value=\"{s}\">"));
                } else {
                    self.body.push_str("<text:list-item>");
                }
            } else {
                self.body.push_str("<text:list-item>");
            }

            let mut is_first_paragraph = true;
            for block in &item.blocks {
                match block {
                    OfficeBlock::Paragraph { runs } => {
                        self.body.push_str("<text:p text:style-name=\"Standard\">");
                        if is_first_paragraph {
                            if let Some(checked) = item.checked {
                                write_odt_text(
                                    &mut self.body,
                                    if checked { "☑ " } else { "☐ " },
                                );
                            }
                        }
                        self.write_runs(runs, false);
                        self.body.push_str("</text:p>");
                        is_first_paragraph = false;
                    }
                    other => {
                        self.write_block(other, false);
                        is_first_paragraph = false;
                    }
                }
            }
            if is_first_paragraph {
                self.body
                    .push_str("<text:p text:style-name=\"Standard\"/>");
            }
            self.body.push_str("</text:list-item>");
        }
        self.body.push_str("</text:list>");
    }

    fn write_runs(&mut self, runs: &[OfficeRun], force_bold: bool) {
        for run in runs {
            match run {
                OfficeRun::Break => {
                    self.body.push_str("<text:line-break/>");
                }
                OfficeRun::Text {
                    text,
                    bold,
                    italic,
                    strike,
                    code,
                    href,
                } => {
                    let is_bold = *bold || force_bold;
                    let has_style = is_bold || *italic || *strike || *code;
                    let link_url = href.as_deref().filter(|u| !u.is_empty());

                    if let Some(url) = link_url {
                        self.body.push_str(&format!(
                            "<text:a xlink:type=\"simple\" xlink:href=\"{}\" text:style-name=\"Internet_20_link\">",
                            escape_xml(url)
                        ));
                    }
                    if has_style {
                        let style = self.text_style_name(is_bold, *italic, *strike, *code);
                        self.body
                            .push_str(&format!("<text:span text:style-name=\"{style}\">"));
                        write_odt_text(&mut self.body, text);
                        self.body.push_str("</text:span>");
                    } else {
                        write_odt_text(&mut self.body, text);
                    }
                    if link_url.is_some() {
                        self.body.push_str("</text:a>");
                    }
                }
            }
        }
    }

    fn write_code_block(&mut self, language: Option<&str>, code: &str) {
        if let Some(lang) = language.filter(|l| !l.trim().is_empty()) {
            self.body
                .push_str("<text:p text:style-name=\"Code_20_Language\">");
            write_odt_text(&mut self.body, &lang.to_uppercase());
            self.body.push_str("</text:p>");
        }

        self.body
            .push_str("<text:p text:style-name=\"Preformatted_20_Text\">");
        let trimmed = code.strip_suffix('\n').unwrap_or(code);
        for (idx, line) in trimmed.split('\n').enumerate() {
            if idx > 0 {
                self.body.push_str("<text:line-break/>");
            }
            let clean = line.strip_suffix('\r').unwrap_or(line);
            write_odt_text(&mut self.body, clean);
        }
        self.body.push_str("</text:p>");
    }

    fn write_table(&mut self, headers: &[OfficeTableCell], rows: &[Vec<OfficeTableCell>]) {
        let col_count = headers
            .len()
            .max(rows.iter().map(Vec::len).max().unwrap_or(0));
        if col_count == 0 {
            return;
        }
        self.table_count += 1;
        let name = format!("Tabla{}", self.table_count);

        self.body.push_str(&format!(
            "<table:table table:name=\"{name}\" table:style-name=\"Tbl\">\
             <table:table-column table:number-columns-repeated=\"{col_count}\"/>"
        ));

        if !headers.is_empty() {
            self.body.push_str("<table:table-header-rows><table:table-row>");
            for i in 0..col_count {
                self.write_table_cell(headers.get(i), true);
            }
            self.body
                .push_str("</table:table-row></table:table-header-rows>");
        }

        for row in rows {
            self.body.push_str("<table:table-row>");
            for i in 0..col_count {
                self.write_table_cell(row.get(i), false);
            }
            self.body.push_str("</table:table-row>");
        }

        self.body.push_str("</table:table>");
    }

    fn write_table_cell(&mut self, cell: Option<&OfficeTableCell>, is_header: bool) {
        let cell_style = if is_header { "TblHead" } else { "TblCell" };
        let para_style = match cell.and_then(|c| c.align.as_ref()) {
            Some(TextAlign::Center) => "P_center",
            Some(TextAlign::Right) => "P_right",
            _ => "P_left",
        };
        self.body.push_str(&format!(
            "<table:table-cell table:style-name=\"{cell_style}\" office:value-type=\"string\">\
             <text:p text:style-name=\"{para_style}\">"
        ));
        if let Some(c) = cell {
            self.write_runs(&c.runs, is_header);
        }
        self.body.push_str("</text:p></table:table-cell>");
    }

    fn build_content_xml(&self) -> String {
        let mut auto_styles = String::from(
            "    <style:style style:name=\"Tbl\" style:family=\"table\">\
               <style:table-properties style:width=\"17cm\" table:align=\"margins\" fo:margin-top=\"0.2cm\" fo:margin-bottom=\"0.28cm\"/>\
             </style:style>\n\
             <style:style style:name=\"TblHead\" style:family=\"table-cell\">\
               <style:table-cell-properties fo:background-color=\"#f4f6f8\" fo:padding=\"0.14cm\" fo:border=\"0.5pt solid #d0d7de\"/>\
             </style:style>\n\
             <style:style style:name=\"TblCell\" style:family=\"table-cell\">\
               <style:table-cell-properties fo:padding=\"0.14cm\" fo:border=\"0.5pt solid #d0d7de\"/>\
             </style:style>\n\
             <style:style style:name=\"P_left\" style:family=\"paragraph\" style:parent-style-name=\"Standard\">\
               <style:paragraph-properties fo:text-align=\"start\" fo:margin-bottom=\"0cm\"/>\
             </style:style>\n\
             <style:style style:name=\"P_center\" style:family=\"paragraph\" style:parent-style-name=\"Standard\">\
               <style:paragraph-properties fo:text-align=\"center\" fo:margin-bottom=\"0cm\"/>\
             </style:style>\n\
             <style:style style:name=\"P_right\" style:family=\"paragraph\" style:parent-style-name=\"Standard\">\
               <style:paragraph-properties fo:text-align=\"end\" fo:margin-bottom=\"0cm\"/>\
             </style:style>\n",
        );

        for (name, bold, italic, strike, code) in &self.text_styles {
            auto_styles.push_str(&format!(
                "    <style:style style:name=\"{name}\" style:family=\"text\"><style:text-properties"
            ));
            if *bold {
                auto_styles.push_str(" fo:font-weight=\"bold\"");
            }
            if *italic {
                auto_styles.push_str(" fo:font-style=\"italic\"");
            }
            if *strike {
                auto_styles.push_str(" style:text-line-through-style=\"solid\"");
            }
            if *code {
                auto_styles.push_str(
                    " style:font-name=\"Liberation Mono\" fo:font-size=\"10pt\" fo:background-color=\"#f0f3f6\"",
                );
            }
            auto_styles.push_str("/></style:style>\n");
        }

        format!(
            concat!(
                "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n",
                "<office:document-content ",
                "xmlns:office=\"urn:oasis:names:tc:opendocument:xmlns:office:1.0\" ",
                "xmlns:style=\"urn:oasis:names:tc:opendocument:xmlns:style:1.0\" ",
                "xmlns:text=\"urn:oasis:names:tc:opendocument:xmlns:text:1.0\" ",
                "xmlns:table=\"urn:oasis:names:tc:opendocument:xmlns:table:1.0\" ",
                "xmlns:fo=\"urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0\" ",
                "xmlns:xlink=\"http://www.w3.org/1999/xlink\" ",
                "xmlns:svg=\"urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0\" ",
                "office:version=\"1.2\">\n",
                "  <office:font-face-decls>\n",
                "    <style:font-face style:name=\"Liberation Sans\" svg:font-family=\"'Liberation Sans', Inter, sans-serif\" style:font-family-generic=\"swiss\"/>\n",
                "    <style:font-face style:name=\"Liberation Mono\" svg:font-family=\"'Liberation Mono', 'Courier New', monospace\" style:font-family-generic=\"modern\" style:font-pitch=\"fixed\"/>\n",
                "  </office:font-face-decls>\n",
                "  <office:automatic-styles>\n{auto_styles}  </office:automatic-styles>\n",
                "  <office:body>\n    <office:text>{body}</office:text>\n  </office:body>\n",
                "</office:document-content>\n"
            ),
            auto_styles = auto_styles,
            body = self.body
        )
    }
}

/// Escribe texto ODF preservando tabulaciones (`<text:tab/>`) y espacios
/// consecutivos (`<text:s text:c="N"/>`), que de otro modo ODF colapsaría.
fn write_odt_text(out: &mut String, text: &str) {
    let mut chars = text.chars().peekable();
    while let Some(ch) = chars.next() {
        match ch {
            '\t' => out.push_str("<text:tab/>"),
            ' ' => {
                let mut count = 1usize;
                while matches!(chars.peek(), Some(' ')) {
                    chars.next();
                    count += 1;
                }
                if count == 1 {
                    out.push(' ');
                } else {
                    out.push(' ');
                    let extra = count - 1;
                    if extra == 1 {
                        out.push_str("<text:s/>");
                    } else {
                        out.push_str(&format!("<text:s text:c=\"{extra}\"/>"));
                    }
                }
            }
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&apos;"),
            '\n' | '\r' => {}
            c if (c as u32) < 0x20 => {}
            c => out.push(c),
        }
    }
}

fn build_meta_xml(title: &str) -> String {
    format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n\
         <office:document-meta \
         xmlns:office=\"urn:oasis:names:tc:opendocument:xmlns:office:1.0\" \
         xmlns:dc=\"http://purl.org/dc/elements/1.1/\" \
         xmlns:meta=\"urn:oasis:names:tc:opendocument:xmlns:meta:1.0\" \
         office:version=\"1.2\">\n\
           <office:meta>\n\
             <dc:title>{}</dc:title>\n\
             <meta:generator>Inkline</meta:generator>\n\
           </office:meta>\n\
         </office:document-meta>\n",
        escape_xml(title)
    )
}

/// Construye el paquete `.odt` completo en memoria.
pub fn build_odt(doc: &OfficeDoc) -> Vec<u8> {
    let mut builder = OdtBuilder::new();
    builder.write_blocks(&doc.blocks, false);

    let content_xml = builder.build_content_xml();
    let meta_xml = build_meta_xml(&doc.title);

    let mut zip = ZipWriter::new();
    // ODF 1.2: `mimetype` DEBE ser la primera entrada, sin comprimir y sin campo extra.
    zip.add_file("mimetype", ODT_MIMETYPE);
    zip.add_file("META-INF/manifest.xml", MANIFEST_XML.as_bytes());
    zip.add_file("meta.xml", meta_xml.as_bytes());
    zip.add_file("styles.xml", STYLES_XML.as_bytes());
    zip.add_file("content.xml", content_xml.as_bytes());
    zip.finish()
}
