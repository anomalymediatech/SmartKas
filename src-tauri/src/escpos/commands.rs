// ESC/POS Command Builders for Thermal Printers

/// Initialize printer
pub fn init() -> Vec<u8> {
    vec![0x1B, 0x40] // ESC @
}

/// Set alignment
pub fn align_left() -> Vec<u8> {
    vec![0x1B, 0x61, 0x00] // ESC a 0
}

pub fn align_center() -> Vec<u8> {
    vec![0x1B, 0x61, 0x01] // ESC a 1
}

/// Bold on/off
pub fn bold_on() -> Vec<u8> {
    vec![0x1B, 0x45, 0x01] // ESC E 1
}

pub fn bold_off() -> Vec<u8> {
    vec![0x1B, 0x45, 0x00] // ESC E 0
}

/// Character size (width, height multipliers 0-7)
pub fn char_size(width: u8, height: u8) -> Vec<u8> {
    let n = (width.min(7) << 4) | height.min(7);
    vec![0x1D, 0x21, n] // GS ! n
}

/// Reset character size
pub fn char_size_normal() -> Vec<u8> {
    vec![0x1D, 0x21, 0x00]
}

/// Feed lines
pub fn feed_lines(lines: u8) -> Vec<u8> {
    vec![0x1B, 0x64, lines] // ESC d n
}

/// Cut paper
pub fn cut_paper(partial: bool) -> Vec<u8> {
    if partial {
        vec![0x1D, 0x56, 0x01, 0x00] // GS V 1 0 (partial cut)
    } else {
        vec![0x1D, 0x56, 0x00, 0x00] // GS V 0 0 (full cut)
    }
}

/// Set line spacing
pub fn line_spacing(spacing: u8) -> Vec<u8> {
    vec![0x1B, 0x33, spacing] // ESC 3 n
}

/// Text encoding helper for Indonesian characters (ASCII-safe CP858 superset)
pub fn encode_text(text: &str) -> Vec<u8> {
    // For Indonesian receipt text all characters are ASCII, so UTF-8 bytes are
    // a valid CP858 superset. Non-ASCII characters can be stripped here as a
    // future enhancement.
    text.as_bytes().to_vec()
}
