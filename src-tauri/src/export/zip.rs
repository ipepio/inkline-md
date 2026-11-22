//! Escritor ZIP mínimo (método STORE, CRC-32 IEEE 802.3) en Rust puro.
//!
//! Tanto OOXML (`.docx`) como ODF 1.2 (`.odt`) son archivos ZIP estándar.
//! Usar STORE (método 0) evita dependencias externas y cumple de forma nativa
//! el requisito de ODF 1.2 de que `mimetype` sea la primera entrada sin
//! compresión ni campo extra.

struct ZipEntry {
    name: Vec<u8>,
    crc32: u32,
    size: u32,
    offset: u32,
    flags: u16,
}

pub struct ZipWriter {
    buf: Vec<u8>,
    entries: Vec<ZipEntry>,
}

impl ZipWriter {
    pub fn new() -> Self {
        Self {
            buf: Vec::with_capacity(16 * 1024),
            entries: Vec::new(),
        }
    }

    pub fn add_file(&mut self, name: &str, data: &[u8]) {
        let name_bytes = name.as_bytes();
        let crc = crc32(data);
        let size = data.len() as u32;
        let offset = self.buf.len() as u32;
        // Bit 11 (UTF-8) solo si el nombre contiene bytes no ASCII: mantiene
        // flags == 0 en `mimetype` y el resto de rutas estándar.
        let flags: u16 = if name.is_ascii() { 0 } else { 0x0800 };

        // Local file header (30 bytes + name)
        self.push_u32(0x0403_4b50); // signature PK\x03\x04
        self.push_u16(20); // version needed to extract (2.0)
        self.push_u16(flags);
        self.push_u16(0); // compression method: STORE
        self.push_u16(0); // mod time
        self.push_u16(0x0021); // mod date: 1980-01-01
        self.push_u32(crc);
        self.push_u32(size);
        self.push_u32(size);
        self.push_u16(name_bytes.len() as u16);
        self.push_u16(0); // extra field length
        self.buf.extend_from_slice(name_bytes);
        self.buf.extend_from_slice(data);

        self.entries.push(ZipEntry {
            name: name_bytes.to_vec(),
            crc32: crc,
            size,
            offset,
            flags,
        });
    }

    pub fn finish(mut self) -> Vec<u8> {
        let cd_offset = self.buf.len() as u32;
        let count = self.entries.len() as u16;

        let entries = std::mem::take(&mut self.entries);
        for entry in &entries {
            // Central directory file header (46 bytes + name)
            self.push_u32(0x0201_4b50); // signature PK\x01\x02
            self.push_u16(20); // version made by
            self.push_u16(20); // version needed
            self.push_u16(entry.flags);
            self.push_u16(0); // compression method: STORE
            self.push_u16(0); // mod time
            self.push_u16(0x0021); // mod date: 1980-01-01
            self.push_u32(entry.crc32);
            self.push_u32(entry.size);
            self.push_u32(entry.size);
            self.push_u16(entry.name.len() as u16);
            self.push_u16(0); // extra field length
            self.push_u16(0); // file comment length
            self.push_u16(0); // disk number start
            self.push_u16(0); // internal file attributes
            self.push_u32(0); // external file attributes
            self.push_u32(entry.offset);
            self.buf.extend_from_slice(&entry.name);
        }

        let cd_size = (self.buf.len() as u32) - cd_offset;

        // End of central directory record (22 bytes)
        self.push_u32(0x0605_4b50); // signature PK\x05\x06
        self.push_u16(0); // disk number
        self.push_u16(0); // disk with central directory
        self.push_u16(count);
        self.push_u16(count);
        self.push_u32(cd_size);
        self.push_u32(cd_offset);
        self.push_u16(0); // comment length

        self.buf
    }

    fn push_u16(&mut self, value: u16) {
        self.buf.extend_from_slice(&value.to_le_bytes());
    }

    fn push_u32(&mut self, value: u32) {
        self.buf.extend_from_slice(&value.to_le_bytes());
    }
}

/// CRC-32 IEEE 802.3 (polinomio reflejado `0xEDB88320`).
pub fn crc32(bytes: &[u8]) -> u32 {
    let mut crc: u32 = 0xFFFF_FFFF;
    for &byte in bytes {
        crc ^= byte as u32;
        for _ in 0..8 {
            if (crc & 1) != 0 {
                crc = (crc >> 1) ^ 0xEDB8_8320;
            } else {
                crc >>= 1;
            }
        }
    }
    !crc
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn crc32_matches_standard_check_vector() {
        assert_eq!(crc32(b"123456789"), 0xCBF4_3926);
        assert_eq!(crc32(b""), 0x0000_0000);
    }

    #[test]
    fn zip_writer_produces_valid_structure_and_entry_names() {
        let mut zip = ZipWriter::new();
        zip.add_file("mimetype", b"application/vnd.oasis.opendocument.text");
        zip.add_file("content.xml", b"<doc/>");
        let bytes = zip.finish();

        assert!(bytes.starts_with(b"PK\x03\x04"));
        // EOCD está en los últimos 22 bytes (sin comentario).
        let eocd = &bytes[bytes.len() - 22..];
        assert_eq!(&eocd[0..4], b"PK\x05\x06");
        let total_entries = u16::from_le_bytes([eocd[10], eocd[11]]);
        assert_eq!(total_entries, 2);
    }
}
