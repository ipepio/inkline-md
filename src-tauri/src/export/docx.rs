//! Generador nativo de Word (`.docx` / OOXML ECMA-376).
//!
//! Produce un paquete ZIP completo (`[Content_Types].xml`, `_rels/.rels`,
//! `docProps/{core,app}.xml`, `word/{document,styles,numbering}.xml` y
//! `word/_rels/document.xml.rels`) compatible con Microsoft Word, LibreOffice
//! Writer, Apple Pages y Google Docs en Windows, Linux y macOS.

use super::model::{
    escape_xml, OfficeBlock, OfficeDoc, OfficeListItem, OfficeRun, OfficeTableCell, TextAlign,
};
use super::zip::ZipWriter;

const CONTENT_TYPES_XML: &str = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>
"#;

const ROOT_RELS_XML: &str = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>
"#;

const APP_PROPS_XML: &str = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
  <Application>Inkline</Application>
</Properties>
"#;

const STYLES_XML: &str = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
        <w:color w:val="1F2328"/>
        <w:sz w:val="22"/>
        <w:szCs w:val="22"/>
        <w:lang w:val="es-ES"/>
      </w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr>
        <w:spacing w:after="160" w:line="276" w:lineRule="auto"/>
      </w:pPr>
    </w:pPrDefault>
  </w:docDefaults>

  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:qFormat/>
  </w:style>

  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr>
      <w:keepNext/>
      <w:spacing w:before="360" w:after="160"/>
      <w:outlineLvl w:val="0"/>
    </w:pPr>
    <w:rPr>
      <w:b/>
      <w:sz w:val="44"/>
      <w:szCs w:val="44"/>
    </w:rPr>
  </w:style>

  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr>
      <w:keepNext/>
      <w:spacing w:before="300" w:after="140"/>
      <w:outlineLvl w:val="1"/>
    </w:pPr>
    <w:rPr>
      <w:b/>
      <w:sz w:val="34"/>
      <w:szCs w:val="34"/>
    </w:rPr>
  </w:style>

  <w:style w:type="paragraph" w:styleId="Heading3">
    <w:name w:val="heading 3"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr>
      <w:keepNext/>
      <w:spacing w:before="240" w:after="120"/>
      <w:outlineLvl w:val="2"/>
    </w:pPr>
    <w:rPr>
      <w:b/>
      <w:sz w:val="28"/>
      <w:szCs w:val="28"/>
    </w:rPr>
  </w:style>

  <w:style w:type="paragraph" w:styleId="Heading4">
    <w:name w:val="heading 4"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr>
      <w:keepNext/>
      <w:spacing w:before="200" w:after="100"/>
      <w:outlineLvl w:val="3"/>
    </w:pPr>
    <w:rPr>
      <w:b/>
      <w:sz w:val="24"/>
      <w:szCs w:val="24"/>
    </w:rPr>
  </w:style>

  <w:style w:type="paragraph" w:styleId="Heading5">
    <w:name w:val="heading 5"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr>
      <w:keepNext/>
      <w:spacing w:before="180" w:after="80"/>
      <w:outlineLvl w:val="4"/>
    </w:pPr>
    <w:rPr>
      <w:b/>
      <w:sz w:val="22"/>
      <w:szCs w:val="22"/>
    </w:rPr>
  </w:style>

  <w:style w:type="paragraph" w:styleId="Heading6">
    <w:name w:val="heading 6"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr>
      <w:keepNext/>
      <w:spacing w:before="160" w:after="80"/>
      <w:outlineLvl w:val="5"/>
    </w:pPr>
    <w:rPr>
      <w:b/>
      <w:color w:val="57606A"/>
      <w:sz w:val="20"/>
      <w:szCs w:val="20"/>
    </w:rPr>
  </w:style>

  <w:style w:type="paragraph" w:styleId="Quote">
    <w:name w:val="Quote"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr>
      <w:pBdr>
        <w:left w:val="single" w:sz="18" w:space="12" w:color="C8D1D9"/>
      </w:pBdr>
      <w:ind w:left="480"/>
      <w:spacing w:before="80" w:after="140"/>
    </w:pPr>
    <w:rPr>
      <w:i/>
      <w:color w:val="57606A"/>
    </w:rPr>
  </w:style>

  <w:style w:type="paragraph" w:styleId="CodeBlock">
    <w:name w:val="Code Block"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr>
      <w:shd w:val="clear" w:color="auto" w:fill="F4F6F8"/>
      <w:pBdr>
        <w:top w:val="single" w:sz="4" w:space="6" w:color="E1E6EB"/>
        <w:left w:val="single" w:sz="4" w:space="8" w:color="E1E6EB"/>
        <w:bottom w:val="single" w:sz="4" w:space="6" w:color="E1E6EB"/>
        <w:right w:val="single" w:sz="4" w:space="8" w:color="E1E6EB"/>
      </w:pBdr>
      <w:ind w:left="180" w:right="180"/>
      <w:spacing w:before="120" w:after="160" w:line="240" w:lineRule="auto"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="Courier New" w:hAnsi="Courier New" w:cs="Courier New"/>
      <w:sz w:val="19"/>
      <w:szCs w:val="19"/>
    </w:rPr>
  </w:style>

  <w:style w:type="character" w:styleId="CodeInline">
    <w:name w:val="Code Inline"/>
    <w:rPr>
      <w:rFonts w:ascii="Courier New" w:hAnsi="Courier New" w:cs="Courier New"/>
      <w:shd w:val="clear" w:color="auto" w:fill="F0F3F6"/>
      <w:sz w:val="20"/>
      <w:szCs w:val="20"/>
    </w:rPr>
  </w:style>

  <w:style w:type="character" w:styleId="Hyperlink">
    <w:name w:val="Hyperlink"/>
    <w:rPr>
      <w:color w:val="0969DA"/>
      <w:u w:val="single"/>
    </w:rPr>
  </w:style>
</w:styles>
"#;

struct DocxBuilder {
    body: String,
    hyperlinks: Vec<(String, String)>,
    ordered_lists: Vec<(u32, u32)>, // (numId, start)
    next_num_id: u32,
}

impl DocxBuilder {
    fn new() -> Self {
        Self {
            body: String::with_capacity(4096),
            hyperlinks: Vec::new(),
            ordered_lists: Vec::new(),
            // numId 1 está reservado para listas con viñetas.
            next_num_id: 2,
        }
    }

    fn register_hyperlink(&mut self, url: &str) -> String {
        // rId1 = styles, rId2 = numbering.
        let id = format!("rId{}", self.hyperlinks.len() + 3);
        self.hyperlinks.push((id.clone(), url.to_string()));
        id
    }

    fn alloc_ordered_num_id(&mut self, start: u32) -> u32 {
        let id = self.next_num_id;
        self.next_num_id += 1;
        self.ordered_lists.push((id, start));
        id
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
                let style = format!("Heading{clamped}");
                self.write_paragraph(runs, Some(&style), None, None);
            }
            OfficeBlock::Paragraph { runs } => {
                let style = if in_quote { Some("Quote") } else { None };
                self.write_paragraph(runs, style, None, None);
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
                let num_id = if *ordered {
                    self.alloc_ordered_num_id(start.unwrap_or(1).max(1))
                } else {
                    1
                };
                self.write_list_items(items, *ordered, num_id, 0);
            }
            OfficeBlock::Table { headers, rows } => {
                self.write_table(headers, rows);
            }
            OfficeBlock::ThematicBreak => {
                self.body.push_str(
                    "<w:p><w:pPr><w:pBdr><w:bottom w:val=\"single\" w:sz=\"6\" w:space=\"1\" w:color=\"D0D7DE\"/></w:pBdr><w:spacing w:before=\"120\" w:after=\"180\"/></w:pPr></w:p>",
                );
            }
        }
    }

    fn write_list_items(
        &mut self,
        items: &[OfficeListItem],
        ordered: bool,
        num_id: u32,
        depth: u8,
    ) {
        let ilvl = depth.min(8);
        for item in items {
            let mut is_first_paragraph = true;
            for block in &item.blocks {
                match block {
                    OfficeBlock::Paragraph { runs } => {
                        let mut effective_runs = Vec::with_capacity(runs.len() + 1);
                        if is_first_paragraph {
                            if let Some(checked) = item.checked {
                                effective_runs.push(OfficeRun::Text {
                                    text: if checked { "☑ " } else { "☐ " }.to_string(),
                                    bold: false,
                                    italic: false,
                                    strike: false,
                                    code: false,
                                    href: None,
                                });
                            }
                        }
                        effective_runs.extend(runs.iter().cloned());

                        if is_first_paragraph && item.checked.is_none() {
                            self.write_paragraph(&effective_runs, None, Some((num_id, ilvl)), None);
                        } else if is_first_paragraph {
                            // Task list: sangría acorde al nivel sin viñeta duplicada.
                            let indent = 360 * (u32::from(ilvl) + 1);
                            self.write_indented_paragraph(&effective_runs, indent);
                        } else {
                            let indent = 360 * (u32::from(ilvl) + 1);
                            self.write_indented_paragraph(&effective_runs, indent);
                        }
                        is_first_paragraph = false;
                    }
                    OfficeBlock::List {
                        ordered: nested_ordered,
                        start: nested_start,
                        items: nested_items,
                    } => {
                        let nested_num_id = if *nested_ordered {
                            if ordered && nested_start.is_none() {
                                num_id
                            } else {
                                self.alloc_ordered_num_id(nested_start.unwrap_or(1).max(1))
                            }
                        } else {
                            1
                        };
                        self.write_list_items(
                            nested_items,
                            *nested_ordered,
                            nested_num_id,
                            depth.saturating_add(1),
                        );
                        is_first_paragraph = false;
                    }
                    other => {
                        self.write_block(other, false);
                        is_first_paragraph = false;
                    }
                }
            }
            if is_first_paragraph {
                self.write_paragraph(&[], None, Some((num_id, ilvl)), None);
            }
        }
    }

    fn write_indented_paragraph(&mut self, runs: &[OfficeRun], indent_twips: u32) {
        self.body.push_str("<w:p><w:pPr>");
        self.body
            .push_str(&format!("<w:ind w:left=\"{indent_twips}\"/>"));
        self.body.push_str("</w:pPr>");
        self.write_runs(runs, false);
        self.body.push_str("</w:p>");
    }

    fn write_paragraph(
        &mut self,
        runs: &[OfficeRun],
        style: Option<&str>,
        numbering: Option<(u32, u8)>,
        align: Option<&TextAlign>,
    ) {
        self.body.push_str("<w:p>");
        if style.is_some() || numbering.is_some() || align.is_some() {
            self.body.push_str("<w:pPr>");
            if let Some(style_id) = style {
                self.body
                    .push_str(&format!("<w:pStyle w:val=\"{style_id}\"/>"));
            }
            if let Some((num_id, ilvl)) = numbering {
                self.body.push_str(&format!(
                    "<w:numPr><w:ilvl w:val=\"{ilvl}\"/><w:numId w:val=\"{num_id}\"/></w:numPr>"
                ));
            }
            if let Some(a) = align {
                let val = match a {
                    TextAlign::Left => "left",
                    TextAlign::Center => "center",
                    TextAlign::Right => "right",
                };
                self.body.push_str(&format!("<w:jc w:val=\"{val}\"/>"));
            }
            self.body.push_str("</w:pPr>");
        }
        self.write_runs(runs, false);
        self.body.push_str("</w:p>");
    }

    fn write_runs(&mut self, runs: &[OfficeRun], force_bold: bool) {
        for run in runs {
            match run {
                OfficeRun::Break => {
                    self.body.push_str("<w:r><w:br/></w:r>");
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
                    if let Some(url) = href.as_deref().filter(|u| !u.is_empty()) {
                        let rid = self.register_hyperlink(url);
                        self.body
                            .push_str(&format!("<w:hyperlink r:id=\"{rid}\">"));
                        self.write_text_run(text, is_bold, *italic, *strike, *code, true);
                        self.body.push_str("</w:hyperlink>");
                    } else {
                        self.write_text_run(text, is_bold, *italic, *strike, *code, false);
                    }
                }
            }
        }
    }

    fn write_text_run(
        &mut self,
        text: &str,
        bold: bool,
        italic: bool,
        strike: bool,
        code: bool,
        is_link: bool,
    ) {
        self.body.push_str("<w:r>");
        if bold || italic || strike || code || is_link {
            self.body.push_str("<w:rPr>");
            if is_link {
                self.body.push_str("<w:rStyle w:val=\"Hyperlink\"/>");
            } else if code {
                self.body.push_str("<w:rStyle w:val=\"CodeInline\"/>");
            }
            if bold {
                self.body.push_str("<w:b/>");
            }
            if italic {
                self.body.push_str("<w:i/>");
            }
            if strike {
                self.body.push_str("<w:strike/>");
            }
            if is_link && code {
                self.body.push_str(
                    "<w:rFonts w:ascii=\"Courier New\" w:hAnsi=\"Courier New\" w:cs=\"Courier New\"/>",
                );
            }
            self.body.push_str("</w:rPr>");
        }
        self.body.push_str("<w:t xml:space=\"preserve\">");
        self.body.push_str(&escape_xml(text));
        self.body.push_str("</w:t></w:r>");
    }

    fn write_code_block(&mut self, language: Option<&str>, code: &str) {
        if let Some(lang) = language.filter(|l| !l.trim().is_empty()) {
            self.body.push_str(
                "<w:p><w:pPr><w:spacing w:before=\"120\" w:after=\"40\"/><w:ind w:left=\"180\"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val=\"57606A\"/><w:sz w:val=\"16\"/></w:rPr><w:t xml:space=\"preserve\">",
            );
            self.body.push_str(&escape_xml(&lang.to_uppercase()));
            self.body.push_str("</w:t></w:r></w:p>");
        }

        self.body
            .push_str("<w:p><w:pPr><w:pStyle w:val=\"CodeBlock\"/></w:pPr>");
        let trimmed = code.strip_suffix('\n').unwrap_or(code);
        for (idx, line) in trimmed.split('\n').enumerate() {
            if idx > 0 {
                self.body.push_str("<w:r><w:br/></w:r>");
            }
            let clean = line.strip_suffix('\r').unwrap_or(line);
            self.body.push_str("<w:r><w:t xml:space=\"preserve\">");
            self.body.push_str(&escape_xml(clean));
            self.body.push_str("</w:t></w:r>");
        }
        self.body.push_str("</w:p>");
    }

    fn write_table(&mut self, headers: &[OfficeTableCell], rows: &[Vec<OfficeTableCell>]) {
        let col_count = headers
            .len()
            .max(rows.iter().map(Vec::len).max().unwrap_or(0));
        if col_count == 0 {
            return;
        }

        // Ancho útil de A4 con márgenes de 1": 11906 - 2880 = 9026 twips.
        let col_width = 9026 / (col_count as u32);

        self.body.push_str(
            "<w:tbl><w:tblPr>\
             <w:tblW w:w=\"5000\" w:type=\"pct\"/>\
             <w:tblBorders>\
               <w:top w:val=\"single\" w:sz=\"4\" w:space=\"0\" w:color=\"D0D7DE\"/>\
               <w:left w:val=\"single\" w:sz=\"4\" w:space=\"0\" w:color=\"D0D7DE\"/>\
               <w:bottom w:val=\"single\" w:sz=\"4\" w:space=\"0\" w:color=\"D0D7DE\"/>\
               <w:right w:val=\"single\" w:sz=\"4\" w:space=\"0\" w:color=\"D0D7DE\"/>\
               <w:insideH w:val=\"single\" w:sz=\"4\" w:space=\"0\" w:color=\"D0D7DE\"/>\
               <w:insideV w:val=\"single\" w:sz=\"4\" w:space=\"0\" w:color=\"D0D7DE\"/>\
             </w:tblBorders>\
             <w:tblCellMar>\
               <w:top w:w=\"80\" w:type=\"dxa\"/>\
               <w:left w:w=\"120\" w:type=\"dxa\"/>\
               <w:bottom w:w=\"80\" w:type=\"dxa\"/>\
               <w:right w:w=\"120\" w:type=\"dxa\"/>\
             </w:tblCellMar>\
             </w:tblPr><w:tblGrid>",
        );
        for _ in 0..col_count {
            self.body
                .push_str(&format!("<w:gridCol w:w=\"{col_width}\"/>"));
        }
        self.body.push_str("</w:tblGrid>");

        if !headers.is_empty() {
            self.body.push_str("<w:tr><w:trPr><w:tblHeader/></w:trPr>");
            for i in 0..col_count {
                let cell = headers.get(i);
                self.write_table_cell(cell, col_width, true);
            }
            self.body.push_str("</w:tr>");
        }

        for row in rows {
            self.body.push_str("<w:tr>");
            for i in 0..col_count {
                let cell = row.get(i);
                self.write_table_cell(cell, col_width, false);
            }
            self.body.push_str("</w:tr>");
        }

        self.body.push_str("</w:tbl>");
        // Párrafo vacío breve tras la tabla para separar bloques consecutivos.
        self.body
            .push_str("<w:p><w:pPr><w:spacing w:before=\"0\" w:after=\"80\"/></w:pPr></w:p>");
    }

    fn write_table_cell(&mut self, cell: Option<&OfficeTableCell>, width: u32, is_header: bool) {
        self.body.push_str("<w:tc><w:tcPr>");
        self.body
            .push_str(&format!("<w:tcW w:w=\"{width}\" w:type=\"dxa\"/>"));
        if is_header {
            self.body
                .push_str("<w:shd w:val=\"clear\" w:color=\"auto\" w:fill=\"F4F6F8\"/>");
        }
        self.body.push_str("</w:tcPr><w:p><w:pPr><w:spacing w:before=\"0\" w:after=\"0\"/>");
        if let Some(align) = cell.and_then(|c| c.align.as_ref()) {
            let val = match align {
                TextAlign::Left => "left",
                TextAlign::Center => "center",
                TextAlign::Right => "right",
            };
            self.body.push_str(&format!("<w:jc w:val=\"{val}\"/>"));
        }
        self.body.push_str("</w:pPr>");
        if let Some(c) = cell {
            self.write_runs(&c.runs, is_header);
        }
        self.body.push_str("</w:p></w:tc>");
    }

    fn build_document_xml(&self) -> String {
        format!(
            concat!(
                "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n",
                "<w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\" ",
                "xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\">\n",
                "<w:body>{body}",
                "<w:sectPr><w:pgSz w:w=\"11906\" w:h=\"16838\"/>",
                "<w:pgMar w:top=\"1440\" w:right=\"1440\" w:bottom=\"1440\" w:left=\"1440\" ",
                "w:header=\"720\" w:footer=\"720\" w:gutter=\"0\"/></w:sectPr>",
                "</w:body>\n</w:document>\n"
            ),
            body = self.body
        )
    }

    fn build_document_rels_xml(&self) -> String {
        let mut xml = String::from(
            "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n\
             <Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">\n\
               <Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles\" Target=\"styles.xml\"/>\n\
               <Relationship Id=\"rId2\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering\" Target=\"numbering.xml\"/>\n",
        );
        for (id, target) in &self.hyperlinks {
            xml.push_str(&format!(
                "  <Relationship Id=\"{id}\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink\" Target=\"{}\" TargetMode=\"External\"/>\n",
                escape_xml(target)
            ));
        }
        xml.push_str("</Relationships>\n");
        xml
    }

    fn build_numbering_xml(&self) -> String {
        let mut xml = String::from(
            "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n\
             <w:numbering xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\">\n",
        );

        // abstractNum 0: viñetas
        xml.push_str("  <w:abstractNum w:abstractNumId=\"0\">\n");
        let bullets = ["•", "◦", "▪"];
        for lvl in 0..9u32 {
            let left = 720 + lvl * 360;
            let glyph = bullets[(lvl as usize) % bullets.len()];
            xml.push_str(&format!(
                "    <w:lvl w:ilvl=\"{lvl}\">\
                 <w:start w:val=\"1\"/>\
                 <w:numFmt w:val=\"bullet\"/>\
                 <w:lvlText w:val=\"{glyph}\"/>\
                 <w:lvlJc w:val=\"left\"/>\
                 <w:pPr><w:ind w:left=\"{left}\" w:hanging=\"360\"/></w:pPr>\
                 </w:lvl>\n"
            ));
        }
        xml.push_str("  </w:abstractNum>\n");

        // abstractNum 1: numerada
        xml.push_str("  <w:abstractNum w:abstractNumId=\"1\">\n");
        let formats = ["decimal", "lowerLetter", "lowerRoman"];
        for lvl in 0..9u32 {
            let left = 720 + lvl * 360;
            let fmt = formats[(lvl as usize) % formats.len()];
            let placeholder = lvl + 1;
            xml.push_str(&format!(
                "    <w:lvl w:ilvl=\"{lvl}\">\
                 <w:start w:val=\"1\"/>\
                 <w:numFmt w:val=\"{fmt}\"/>\
                 <w:lvlText w:val=\"%{placeholder}.\"/>\
                 <w:lvlJc w:val=\"left\"/>\
                 <w:pPr><w:ind w:left=\"{left}\" w:hanging=\"360\"/></w:pPr>\
                 </w:lvl>\n"
            ));
        }
        xml.push_str("  </w:abstractNum>\n");

        // numId 1: viñetas
        xml.push_str(
            "  <w:num w:numId=\"1\"><w:abstractNumId w:val=\"0\"/></w:num>\n",
        );

        // Cada lista ordenada recibe su propio numId para reiniciar numeración.
        for (num_id, start) in &self.ordered_lists {
            xml.push_str(&format!(
                "  <w:num w:numId=\"{num_id}\">\
                 <w:abstractNumId w:val=\"1\"/>\
                 <w:lvlOverride w:ilvl=\"0\"><w:startOverride w:val=\"{start}\"/></w:lvlOverride>\
                 </w:num>\n"
            ));
        }

        xml.push_str("</w:numbering>\n");
        xml
    }
}

fn build_core_props_xml(title: &str) -> String {
    format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n\
         <cp:coreProperties xmlns:cp=\"http://schemas.openxmlformats.org/package/2006/metadata/core-properties\" \
         xmlns:dc=\"http://purl.org/dc/elements/1.1/\">\n\
           <dc:title>{}</dc:title>\n\
           <dc:creator>Inkline</dc:creator>\n\
         </cp:coreProperties>\n",
        escape_xml(title)
    )
}

/// Construye el paquete `.docx` completo en memoria.
pub fn build_docx(doc: &OfficeDoc) -> Vec<u8> {
    let mut builder = DocxBuilder::new();
    builder.write_blocks(&doc.blocks, false);

    let document_xml = builder.build_document_xml();
    let rels_xml = builder.build_document_rels_xml();
    let numbering_xml = builder.build_numbering_xml();
    let core_xml = build_core_props_xml(&doc.title);

    let mut zip = ZipWriter::new();
    zip.add_file("[Content_Types].xml", CONTENT_TYPES_XML.as_bytes());
    zip.add_file("_rels/.rels", ROOT_RELS_XML.as_bytes());
    zip.add_file("docProps/core.xml", core_xml.as_bytes());
    zip.add_file("docProps/app.xml", APP_PROPS_XML.as_bytes());
    zip.add_file("word/document.xml", document_xml.as_bytes());
    zip.add_file("word/styles.xml", STYLES_XML.as_bytes());
    zip.add_file("word/numbering.xml", numbering_xml.as_bytes());
    zip.add_file("word/_rels/document.xml.rels", rels_xml.as_bytes());
    zip.finish()
}
