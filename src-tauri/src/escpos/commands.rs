// ESC/POS Command Builders for Thermal Printers

/// Initialize printer
pub fn init() -> Vec<u8> {
    vec![0x1B, 0x40] // ESC @
}

/// Select character code table
pub fn select_code_table(table: u8) -> Vec<u8> {
    vec![0x1B, 0x74, table] // ESC t n
}

/// Select font
pub fn select_font(font: u8) -> Vec<u8> {
    vec![0x1B, 0x4D, font] // ESC M n
}

/// Set alignment
pub fn align_left() -> Vec<u8> {
    vec![0x1B, 0x61, 0x00] // ESC a 0
}

pub fn align_center() -> Vec<u8> {
    vec![0x1B, 0x61, 0x01] // ESC a 1
}

pub fn align_right() -> Vec<u8> {
    vec![0x1B, 0x61, 0x02] // ESC a 2
}

/// Bold on/off
pub fn bold_on() -> Vec<u8> {
    vec![0x1B, 0x45, 0x01] // ESC E 1
}

pub fn bold_off() -> Vec<u8> {
    vec![0x1B, 0x45, 0x00] // ESC E 0
}

/// Underline
pub fn underline_on() -> Vec<u8> {
    vec![0x1B, 0x2D, 0x01] // ESC - 1
}

pub fn underline_off() -> Vec<u8> {
    vec![0x1B, 0x2D, 0x00] // ESC - 0
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

/// Reset line spacing
pub fn line_spacing_default() -> Vec<u8> {
    vec![0x1B, 0x32] // ESC 2
}

/// Print and feed paper
pub fn print_and_feed(lines: u8) -> Vec<u8> {
    vec![0x1B, 0x4A, lines] // ESC J n
}

/// Select print mode
pub fn print_mode(mode: u8) -> Vec<u8> {
    vec![0x1B, 0x21, mode] // ESC ! n
}

// Print mode flags
pub const PRINT_MODE_NORMAL: u8 = 0x00;
pub const PRINT_MODE_FONT_B: u8 = 0x01;
pub const PRINT_MODE_EMPHASIZED: u8 = 0x08;
pub const PRINT_MODE_DOUBLE_HEIGHT: u8 = 0x10;
pub const PRINT_MODE_DOUBLE_WIDTH: u8 = 0x20;
pub const PRINT_MODE_UNDERLINE: u8 = 0x80;

/// Horizontal line for given paper width (in characters)
pub fn horizontal_line(paper_width_chars: usize, char: u8) -> Vec<u8> {
    vec![char; paper_width_chars]
}

/// Text encoding helper for Indonesian characters (CP858)
pub fn encode_text(text: &str) -> Vec<u8> {
    // For simplicity, use UTF-8. For proper CP858, use encoding_rs crate
    text.as_bytes().to_vec()
}