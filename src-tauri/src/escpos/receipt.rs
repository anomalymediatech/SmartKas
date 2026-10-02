use crate::escpos::commands::*;
use crate::database::repositories::transactions::Transaction;
use crate::database::repositories::transactions::TransactionDetail;
use crate::database::repositories::settings::Settings;

/// Build ESC/POS receipt bytes for thermal printer
pub fn build_receipt_bytes(
    transaction: &Transaction,
    details: &[TransactionDetail],
    settings: &Settings,
    paper_width: u8,
) -> Vec<u8> {
    let mut buf = Vec::new();
    
    // Paper width in characters (approximate)
    let chars_per_line = match paper_width {
        58 => 32,
        80 => 48,
        _ => 48,
    };
    
    // Initialize
    buf.extend(init());
    buf.extend(line_spacing(30)); // Tighter line spacing
    
    // Header - Shop Name
    buf.extend(align_center());
    buf.extend(bold_on());
    buf.extend(char_size(1, 1)); // Double height
    if let Some(name) = &settings.shop_name {
        buf.extend(encode_text(name));
    }
    buf.extend(char_size_normal());
    buf.extend(feed_lines(1));
    buf.extend(bold_off());
    
    // Address
    if let Some(addr) = &settings.shop_address {
        buf.extend(encode_text(addr));
        buf.extend(feed_lines(1));
    }
    
    // Separator
    buf.extend(encode_text(&"-".repeat(chars_per_line)));
    buf.extend(feed_lines(1));
    
    // Transaction Info
    buf.extend(align_left());
    buf.extend(encode_text(&format!("No Nota: {}", transaction.invoice_number)));
    buf.extend(encode_text(&format!("  Antrian: {}", transaction.queue_number.unwrap_or(0))));
    buf.extend(feed_lines(1));
    buf.extend(encode_text(&format!("Pelanggan: {}", transaction.customer_name.as_deref().unwrap_or("-"))));
    buf.extend(feed_lines(1));
    
    // Format date: DD/MM/YYYY - HH:mm
    let formatted_date = format_date_indonesian(&transaction.transaction_date);
    buf.extend(encode_text(&format!("Tanggal: {}", formatted_date)));
    buf.extend(feed_lines(1));
    buf.extend(encode_text(&format!("Kasir: {}", transaction.cashier_name)));
    buf.extend(encode_text(&format!("  Mekanik: {}", transaction.mechanic_name.as_deref().unwrap_or("-"))));
    buf.extend(feed_lines(1));
    
    // Separator
    buf.extend(encode_text(&"-".repeat(chars_per_line)));
    buf.extend(feed_lines(1));
    
    // LAYANAN Section
    let layanan_items: Vec<&TransactionDetail> = details.iter().filter(|d| d.item_type == "layanan").collect();
    if !layanan_items.is_empty() {
        buf.extend(bold_on());
        buf.extend(encode_text("LAYANAN"));
        buf.extend(bold_off());
        buf.extend(feed_lines(1));
        
        for item in &layanan_items {
            buf.extend(format_item_line(item, chars_per_line));
        }
        
        let layanan_total: f64 = layanan_items.iter().map(|d| d.total_price).sum();
        buf.extend(encode_text(&format!("{:>width$}", format_currency(layanan_total), width = chars_per_line)));
        buf.extend(encode_text(&format!("Total Layanan: {:>width$}", "", width = chars_per_line - 14)));
        buf.extend(feed_lines(1));
    }
    
    // Separator
    buf.extend(encode_text(&"-".repeat(chars_per_line)));
    buf.extend(feed_lines(1));
    
    // SPARE PART Section
    let sparepart_items: Vec<&TransactionDetail> = details.iter().filter(|d| d.item_type == "sparepart").collect();
    if !sparepart_items.is_empty() {
        buf.extend(bold_on());
        buf.extend(encode_text("SPARE PART"));
        buf.extend(bold_off());
        buf.extend(feed_lines(1));
        
        for item in &sparepart_items {
            buf.extend(format_item_line(item, chars_per_line));
        }
        
        let sparepart_total: f64 = sparepart_items.iter().map(|d| d.total_price).sum();
        buf.extend(encode_text(&format!("Total Sparepart: {:>width$}", format_currency(sparepart_total), width = chars_per_line - 16)));
        buf.extend(feed_lines(1));
    }
    
    // Separator
    buf.extend(encode_text(&"-".repeat(chars_per_line)));
    buf.extend(feed_lines(1));
    
    // Totals
    buf.extend(encode_text(&format!("SubTotal: {:>width$}", format_currency(transaction.subtotal), width = chars_per_line - 9)));
    buf.extend(feed_lines(1));
    buf.extend(encode_text(&format!("Diskon: {:>width$}", format_currency(transaction.discount), width = chars_per_line - 7)));
    buf.extend(feed_lines(1));
    
    buf.extend(bold_on());
    buf.extend(encode_text(&format!("Total: {:>width$}", format_currency(transaction.total_amount), width = chars_per_line - 6)));
    buf.extend(bold_off());
    buf.extend(feed_lines(1));
    
    buf.extend(encode_text(&format!("DiBayar: {:>width$}", format_currency(transaction.paid_amount), width = chars_per_line - 8)));
    buf.extend(feed_lines(1));
    buf.extend(encode_text(&format!("Kembalian: {:>width$}", format_currency(transaction.change_amount), width = chars_per_line - 10)));
    buf.extend(feed_lines(1));
    
    // Separator
    buf.extend(encode_text(&"-".repeat(chars_per_line)));
    buf.extend(feed_lines(1));
    
    // Footer
    buf.extend(align_center());
    if let Some(footer) = &settings.receipt_footer {
        // Word wrap footer
        for line in wrap_text(footer, chars_per_line) {
            buf.extend(encode_text(&line));
            buf.extend(feed_lines(1));
        }
    }
    buf.extend(feed_lines(1));
    buf.extend(encode_text("Terimakasih"));
    buf.extend(feed_lines(3));
    
    // Cut paper
    buf.extend(cut_paper(true));
    
    buf
}

fn format_item_line(item: &TransactionDetail, width: usize) -> Vec<u8> {
    let mut buf = Vec::new();
    let qty_str = format!("x{}", item.quantity);
    let price_str = format_currency(item.unit_price);
    let total_str = format_currency(item.total_price);
    
    // Line 1: Item name
    let name = truncate(&item.item_name, width - 1);
    buf.extend(encode_text(&name));
    buf.extend(feed_lines(1));
    
    // Line 2: qty @ price = total
    let line2 = format!("{} @ {} = {}", qty_str, price_str, total_str);
    let padded = format!("{:>width$}", line2, width = width);
    buf.extend(encode_text(&padded));
    buf.extend(feed_lines(1));
    
    buf
}

fn format_currency(amount: f64) -> String {
    // Indonesian Rupiah format without decimal
    let formatted = format!("{:.0}", amount);
    let mut result = String::new();
    let chars: Vec<char> = formatted.chars().collect();
    for (i, ch) in chars.iter().rev().enumerate() {
        if i > 0 && i % 3 == 0 {
            result.insert(0, '.');
        }
        result.insert(0, *ch);
    }
    format!("Rp {}", result)
}

fn format_date_indonesian(date_str: &str) -> String {
    // Parse ISO date and format as DD/MM/YYYY - HH:mm
    if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(date_str) {
        dt.format("%d/%m/%Y - %H:%M").to_string()
    } else if let Ok(dt) = chrono::NaiveDateTime::parse_from_str(date_str, "%Y-%m-%d %H:%M:%S") {
        dt.format("%d/%m/%Y - %H:%M").to_string()
    } else if let Ok(dt) = chrono::NaiveDateTime::parse_from_str(date_str, "%Y-%m-%dT%H:%M:%S") {
        dt.format("%d/%m/%Y - %H:%M").to_string()
    } else {
        date_str.to_string()
    }
}

fn truncate(s: &str, max_len: usize) -> String {
    if s.chars().count() <= max_len {
        s.to_string()
    } else {
        s.chars().take(max_len - 3).collect::<String>() + "..."
    }
}

fn wrap_text(text: &str, width: usize) -> Vec<String> {
    let words: Vec<&str> = text.split_whitespace().collect();
    let mut lines = Vec::new();
    let mut current_line = String::new();
    
    for word in words {
        if current_line.len() + word.len() + 1 <= width {
            if !current_line.is_empty() {
                current_line.push(' ');
            }
            current_line.push_str(word);
        } else {
            if !current_line.is_empty() {
                lines.push(current_line);
            }
            current_line = word.to_string();
        }
    }
    
    if !current_line.is_empty() {
        lines.push(current_line);
    }
    
    if lines.is_empty() {
        lines.push(text.to_string());
    }
    
    lines
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            id: 1,
            shop_name: Some("KASMINI BENGKEL".to_string()),
            shop_address: Some("Jl. Raya No. 123, Jakarta".to_string()),
            receipt_footer: Some("Service > 7x Gratis 1x. Barang yang sudah dibeli tidak dapat dikembalikan.".to_string()),
        }
    }
}