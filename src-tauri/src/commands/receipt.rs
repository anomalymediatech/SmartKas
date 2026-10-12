use crate::commands::printing::print_to_windows_printer;
use crate::database::get_db_connection;
use crate::database::repositories::settings::{get_settings, Settings};
use crate::database::repositories::transactions::{get_transaction_details, Transaction, TransactionDetail};
use crate::error::AppError;
use crate::escpos::commands::*;
use image::GenericImageView;
use std::path::Path;
use tauri::Manager;

/// One line item on a receipt, already grouped by category.
#[derive(Debug, Clone, serde::Serialize)]
pub struct ReceiptItem {
    pub item_type: String, // "layanan" | "sparepart"
    pub item_name: String,
    pub quantity: i32,
    pub unit_price: f64,
    pub total_price: f64,
}

/// Fully prepared receipt payload (used by ESC/POS builder AND React preview).
#[derive(Debug, Clone, serde::Serialize)]
pub struct ReceiptData {
    pub shop_name: String,
    pub shop_address: String,
    pub shop_logo: Option<String>,
    pub invoice_number: String,
    pub queue_number: i32,
    pub customer_name: String,
    pub transaction_date: String,
    pub cashier_name: String,
    pub mechanic_name: String,
    pub layanan: Vec<ReceiptItem>,
    pub sparepart: Vec<ReceiptItem>,
    pub layanan_total: f64,
    pub sparepart_total: f64,
    pub subtotal: f64,
    pub discount: f64,
    pub total_amount: f64,
    pub paid_amount: f64,
    pub change_amount: f64,
    pub status: String,
    pub payment_method: String,
    pub custom_message: String,
}

impl ReceiptData {
    pub fn from_parts(
        transaction: &Transaction,
        details: &[TransactionDetail],
        settings: &Settings,
    ) -> Self {
        let layanan: Vec<ReceiptItem> = details
            .iter()
            .filter(|d| d.item_type == "layanan")
            .map(|d| ReceiptItem {
                item_type: d.item_type.clone(),
                item_name: d.item_name.clone(),
                quantity: d.quantity,
                unit_price: d.unit_price,
                total_price: d.total_price,
            })
            .collect();
        let sparepart: Vec<ReceiptItem> = details
            .iter()
            .filter(|d| d.item_type == "sparepart")
            .map(|d| ReceiptItem {
                item_type: d.item_type.clone(),
                item_name: d.item_name.clone(),
                quantity: d.quantity,
                unit_price: d.unit_price,
                total_price: d.total_price,
            })
            .collect();
        ReceiptData {
            shop_name: settings.shop_name.clone().unwrap_or_default(),
            shop_address: settings.shop_address.clone().unwrap_or_default(),
            shop_logo: settings.shop_logo.clone(),
            invoice_number: transaction.invoice_number.clone(),
            queue_number: transaction.queue_number.unwrap_or(0),
            customer_name: transaction.customer_name.clone().unwrap_or_else(|| "-".into()),
            transaction_date: format_date_indonesian(&transaction.transaction_date),
            cashier_name: transaction.cashier_name.clone(),
            mechanic_name: transaction.mechanic_name.clone().unwrap_or_else(|| "-".into()),
            layanan_total: layanan.iter().map(|i| i.total_price).sum(),
            sparepart_total: sparepart.iter().map(|i| i.total_price).sum(),
            subtotal: transaction.subtotal,
            discount: transaction.discount,
            total_amount: transaction.total_amount,
            paid_amount: transaction.paid_amount,
            change_amount: transaction.change_amount,
            status: transaction.status.clone(),
            payment_method: transaction.payment_method.clone(),
            custom_message: settings.receipt_footer.clone().unwrap_or_default(),
            layanan,
            sparepart,
        }
    }
}

/// Build ESC/POS byte stream for a 58mm/80mm thermal printer.
pub fn build_receipt_bytes(receipt: &ReceiptData, paper_width: u8, logos_dir: Option<&Path>) -> Vec<u8> {
    let mut buf = Vec::new();
    let w = match paper_width {
        58 => 32usize,
        _ => 48usize,
    };

    let max_dots = match paper_width {
        58 => 384u32,
        _ => 576u32,
    };

    buf.extend(init());
    buf.extend(line_spacing(30));

    // LOGO (centered, at top)
    if let Some(logo_path) = &receipt.shop_logo {
        if let Some(dir) = logos_dir {
            let full_path = dir.join(logo_path);
            if full_path.exists() {
                if let Ok(logo_bytes) = load_and_encode_logo(&full_path, max_dots) {
                    buf.extend(align_center());
                    buf.extend(logo_bytes);
                    buf.extend(feed_lines(1));
                }
            }
        }
    }

    // HEADER (centered)
    buf.extend(align_center());
    buf.extend(bold_on());
    buf.extend(encode_text(&receipt.shop_name));
    buf.extend(bold_off());
    buf.extend(feed_lines(1));
    if !receipt.shop_address.is_empty() {
        buf.extend(encode_text(&receipt.shop_address));
        buf.extend(feed_lines(1));
    }
    separator(&mut buf, w);

    // INFO BLOCK
    buf.extend(align_left());
    info_line(&mut buf, "No Nota", &receipt.invoice_number, w);
    info_line(&mut buf, "Antrian", &receipt.queue_number.to_string(), w);
    info_line(&mut buf, "Pelanggan", &receipt.customer_name, w);
    info_line(&mut buf, "Tanggal", &receipt.transaction_date, w);
    info_line(&mut buf, "Kasir", &receipt.cashier_name, w);
    info_line(&mut buf, "Mekanik", &receipt.mechanic_name, w);
    separator(&mut buf, w);

    // LAYANAN (centered header, foto referensi)
    if !receipt.layanan.is_empty() {
        buf.extend(align_center());
        buf.extend(encode_text("LAYANAN"));
        buf.extend(align_left());
        buf.extend(feed_lines(1));
        for item in &receipt.layanan {
            item_block(&mut buf, item, w);
        }
        total_line(&mut buf, "Total", receipt.layanan_total, w);
        separator(&mut buf, w);
    }

    // SPARE PART (centered header)
    if !receipt.sparepart.is_empty() {
        buf.extend(align_center());
        buf.extend(encode_text("SPARE PART"));
        buf.extend(align_left());
        buf.extend(feed_lines(1));
        for item in &receipt.sparepart {
            item_block(&mut buf, item, w);
        }
        total_line(&mut buf, "Total", receipt.sparepart_total, w);
        separator(&mut buf, w);
    }

    // FOOTER TOTALS (foto: Status, Metode Bayar, SubTotal, Diskon, Total, DiBayar, Kembalian)
    total_line_text(&mut buf, "Status", &receipt.status, w);
    total_line_text(&mut buf, "Metode Bayar", &receipt.payment_method, w);
    total_line(&mut buf, "SubTotal", receipt.subtotal, w);
    total_line(&mut buf, "Diskon", receipt.discount, w);
    buf.extend(bold_on());
    total_line(&mut buf, "Total", receipt.total_amount, w);
    buf.extend(bold_off());
    total_line(&mut buf, "DiBayar", receipt.paid_amount, w);
    total_line(&mut buf, "Kembalian", receipt.change_amount, w);
    separator(&mut buf, w);

    // CUSTOM MESSAGE (left-aligned lines, centered "Terimakasih")
    buf.extend(align_left());
    for line in wrap_text(&receipt.custom_message, w) {
        buf.extend(encode_text(&line));
        buf.extend(feed_lines(1));
    }
    buf.extend(feed_lines(1));
    buf.extend(align_center());
    buf.extend(encode_text("Terimakasih"));
    buf.extend(feed_lines(3));
    buf.extend(cut_paper(true));
    buf
}

/// Load transaction + details + settings, lalu rakit payload nota.
/// Satu-satunya tempat query transaksi untuk cetak & preview.
async fn load_receipt_data(
    pool: &crate::database::DbPool,
    transaction_id: i64,
) -> Result<(ReceiptData, Settings), AppError> {
    let conn = pool.lock().await;
    let mut rows = conn
        .query(
            "SELECT t.id, t.invoice_number, t.queue_number, t.customer_name, t.vehicle_plate, t.mechanic_id, t.cashier_name, t.subtotal, t.discount, t.total_amount, t.paid_amount, t.change_amount, t.payment_method, t.status, t.transaction_date, m.name as mechanic_name
             FROM transactions t
             LEFT JOIN mechanics m ON t.mechanic_id = m.id
             WHERE t.id = ?",
            libsql::params![transaction_id],
        )
        .await
        .map_err(|e| e.to_string())?;

    let transaction = if let Some(row) = rows.next().await.map_err(|e| e.to_string())? {
        Transaction {
            id: row.get(0).map_err(|e| e.to_string())?,
            invoice_number: row.get(1).map_err(|e| e.to_string())?,
            queue_number: row.get(2).map_err(|e| e.to_string())?,
            customer_name: row.get(3).map_err(|e| e.to_string())?,
            vehicle_plate: row.get(4).map_err(|e| e.to_string())?,
            mechanic_id: row.get(5).map_err(|e| e.to_string())?,
            cashier_name: row.get(6).map_err(|e| e.to_string())?,
            subtotal: row.get(7).map_err(|e| e.to_string())?,
            discount: row.get(8).map_err(|e| e.to_string())?,
            total_amount: row.get(9).map_err(|e| e.to_string())?,
            paid_amount: row.get(10).map_err(|e| e.to_string())?,
            change_amount: row.get(11).map_err(|e| e.to_string())?,
            payment_method: row.get(12).map_err(|e| e.to_string())?,
            status: row.get(13).map_err(|e| e.to_string())?,
            transaction_date: row.get(14).map_err(|e| e.to_string())?,
            mechanic_name: row.get(15).map_err(|e| e.to_string())?,
        }
    } else {
        return Err("Transaction not found".to_string());
    };
    drop(conn);

    let details = get_transaction_details(pool, transaction_id)
        .await
        .map_err(|e| e.to_string())?;
    let settings = get_settings(pool)
        .await
        .map_err(|e| e.to_string())?
        .unwrap_or_default();

    Ok((ReceiptData::from_parts(&transaction, &details, &settings), settings))
}

#[tauri::command]
pub async fn print_receipt(
    app_handle: tauri::AppHandle,
    transaction_id: i64,
    printer_name: Option<String>,
    paper_width: Option<u8>,
) -> Result<Vec<u8>, AppError> {
    let pool = get_db_connection(&app_handle).await?;
    let (receipt, settings) = load_receipt_data(&pool, transaction_id).await?;

    let printer_name = printer_name.or_else(|| settings.printer_name.clone());
    let paper_width = paper_width
        .or(settings.paper_width.map(|w| w as u8))
        .unwrap_or(80);

    let logos_dir = app_handle.path().app_data_dir().ok().map(|p| p.join("logos"));
    let bytes = build_receipt_bytes(&receipt, paper_width, logos_dir.as_deref());

    match printer_name {
        Some(name) => print_to_windows_printer(&name, &bytes).map_err(|e| e.to_string())?,
        None => {
            return Err("Printer belum dikonfigurasi di Pengaturan -> Toko".to_string());
        }
    }
    Ok(bytes)
}

/// Print "Tutup Kasir" daily summary slip for the owner.
#[tauri::command]
pub async fn print_daily_close(
    app_handle: tauri::AppHandle,
    date: Option<String>,
    printer_name: Option<String>,
    paper_width: Option<u8>,
) -> Result<Vec<u8>, AppError> {
    let pool = get_db_connection(&app_handle).await?;
    let (rows, total_count, total_amount) =
        crate::database::repositories::transactions::get_daily_close(&pool, date.as_deref())
            .await
            .map_err(|e| e.to_string())?;
    let settings = get_settings(&pool)
        .await
        .map_err(|e| e.to_string())?
        .unwrap_or_default();

    let printer_name = printer_name.or_else(|| settings.printer_name.clone());
    let paper_width = paper_width
        .or(settings.paper_width.map(|w| w as u8))
        .unwrap_or(80);

    let w = match paper_width {
        58 => 32usize,
        _ => 48usize,
    };
    let mut buf = Vec::new();
    buf.extend(init());
    buf.extend(line_spacing(30));
    buf.extend(align_center());
    buf.extend(bold_on());
    buf.extend(encode_text("LAPORAN HARIAN"));
    buf.extend(bold_off());
    buf.extend(feed_lines(1));
    if let Some(name) = &settings.shop_name {
        buf.extend(encode_text(name));
        buf.extend(feed_lines(1));
    }
    buf.extend(align_left());
    separator(&mut buf, w);
    for row in &rows {
        let value = format_currency(row.total);
        let label = format!("{} ({}x)", row.payment_method, row.count);
        let line = format!(
            "{:<pad$}{}",
            label,
            value,
            pad = w.saturating_sub(value.chars().count())
        );
        buf.extend(encode_text(&line));
        buf.extend(feed_lines(1));
    }
    separator(&mut buf, w);
    total_line_text(&mut buf, &format!("Total Transaksi"), &total_count.to_string(), w);
    buf.extend(bold_on());
    total_line(&mut buf, "Total Omzet", total_amount, w);
    buf.extend(bold_off());
    separator(&mut buf, w);
    buf.extend(align_center());
    buf.extend(encode_text("Terimakasih"));
    buf.extend(feed_lines(3));
    buf.extend(cut_paper(true));

    match printer_name {
        Some(name) => print_to_windows_printer(&name, &buf).map_err(|e| e.to_string())?,
        None => {
            return Err("Printer belum dikonfigurasi di Pengaturan -> Toko".to_string());
        }
    }
    Ok(buf)
}

/// Returns the receipt layout data (for the React 58mm preview component).
#[tauri::command]
pub async fn get_receipt_data(
    app_handle: tauri::AppHandle,
    transaction_id: i64,
) -> Result<ReceiptData, AppError> {
    let pool = get_db_connection(&app_handle).await?;
    let (receipt, _settings) = load_receipt_data(&pool, transaction_id).await?;
    Ok(receipt)
}

fn separator(buf: &mut Vec<u8>, w: usize) {
    buf.extend(encode_text(&"-".repeat(w)));
    buf.extend(feed_lines(1));
}

/// "Label .......... Value" — label left, value right, no colon (foto referensi).
fn info_line(buf: &mut Vec<u8>, label: &str, value: &str, w: usize) {
    let value_trimmed = if value.chars().count() + label.len() + 1 > w {
        truncate(value, w.saturating_sub(label.len() + 1))
    } else {
        value.to_string()
    };
    let line = format!(
        "{:<pad$}{}",
        label,
        value_trimmed,
        pad = w.saturating_sub(value_trimmed.chars().count())
    );
    buf.extend(encode_text(&line));
    buf.extend(feed_lines(1));
}

fn total_line(buf: &mut Vec<u8>, label: &str, amount: f64, w: usize) {
    total_line_text(buf, label, &format_currency(amount), w);
}

fn total_line_text(buf: &mut Vec<u8>, label: &str, value: &str, w: usize) {
    let line = format!(
        "{:<pad$}{}",
        label,
        value,
        pad = w.saturating_sub(value.chars().count())
    );
    buf.extend(encode_text(&line));
    buf.extend(feed_lines(1));
}

fn item_block(buf: &mut Vec<u8>, item: &ReceiptItem, w: usize) {
    // Line 1: item name
    buf.extend(encode_text(&truncate(&item.item_name, w)));
    buf.extend(feed_lines(1));
    // Line 2: "qty x price" left, total right
    let left = format!("{} x {}", item.quantity, format_currency(item.unit_price));
    let right = format_currency(item.total_price);
    let line = if left.chars().count() + right.chars().count() + 1 <= w {
        format!(
            "{:<pad$}{}",
            left,
            right,
            pad = w.saturating_sub(right.chars().count())
        )
    } else {
        format!("{} = {}", left, right)
    };
    buf.extend(encode_text(&line));
    buf.extend(feed_lines(1));
}

fn format_currency(amount: f64) -> String {
    // Sesuai foto nota: ribuan dengan koma, tanpa "Rp"
    let formatted = format!("{:.0}", amount);
    let negative = formatted.starts_with('-');
    let digits: String = formatted.chars().filter(|c| c.is_ascii_digit()).collect();
    let mut result = String::new();
    for (i, ch) in digits.chars().rev().enumerate() {
        if i > 0 && i % 3 == 0 {
            result.insert(0, ',');
        }
        result.insert(0, ch);
    }
    if negative {
        format!("-{}", result)
    } else {
        result
    }
}

fn format_date_indonesian(date_str: &str) -> String {
    if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(date_str) {
        dt.format("%d/%m/%Y - %H:%M").to_string()
    } else if let Ok(dt) =
        chrono::NaiveDateTime::parse_from_str(date_str, "%Y-%m-%d %H:%M:%S")
    {
        dt.format("%d/%m/%Y - %H:%M").to_string()
    } else if let Ok(dt) =
        chrono::NaiveDateTime::parse_from_str(date_str, "%Y-%m-%dT%H:%M:%S")
    {
        dt.format("%d/%m/%Y - %H:%M").to_string()
    } else {
        date_str.to_string()
    }
}

fn truncate(s: &str, max_len: usize) -> String {
    if s.chars().count() <= max_len {
        s.to_string()
    } else {
        s.chars().take(max_len.saturating_sub(3)).collect::<String>() + "..."
    }
}

fn wrap_text(text: &str, width: usize) -> Vec<String> {
    let words: Vec<&str> = text.split_whitespace().collect();
    let mut lines = Vec::new();
    let mut current = String::new();
    for word in words {
        if current.len() + word.len() + 1 <= width {
            if !current.is_empty() {
                current.push(' ');
            }
            current.push_str(word);
        } else {
            if !current.is_empty() {
                lines.push(current);
            }
            current = word.to_string();
        }
    }
    if !current.is_empty() {
        lines.push(current);
    }
    if lines.is_empty() {
        lines.push(String::new());
    }
    lines
}

/// Load logo image, resize to fit paper width, dither to 1-bit, encode as ESC/POS GS v 0 raster bitmap.
fn load_and_encode_logo(path: &Path, max_dots: u32) -> Result<Vec<u8>, String> {
    let img = image::open(path).map_err(|e| format!("Gagal buka logo: {}", e))?;
    
    let (orig_w, orig_h) = img.dimensions();
    let ratio = max_dots as f32 / orig_w as f32;
    let new_h = (orig_h as f32 * ratio) as u32;
    let new_h = new_h.min(200); // Cap height to avoid wasting paper
    
    let resized = img.resize_exact(max_dots, new_h, image::imageops::FilterType::Lanczos3);
    let gray = resized.to_luma8();
    
    // Floyd-Steinberg dithering to 1-bit
    let mut dithered = gray.clone();
    for y in 0..new_h {
        for x in 0..max_dots {
            let old_pixel = dithered.get_pixel(x, y)[0];
            let new_pixel = if old_pixel > 128 { 255u8 } else { 0u8 };
            let err = old_pixel as i16 - new_pixel as i16;
            dithered.put_pixel(x, y, image::Luma([new_pixel]));
            
            // Distribute error to neighbors
            if x + 1 < max_dots {
                let p = dithered.get_pixel_mut(x + 1, y);
                p[0] = (p[0] as i16 + (err * 7 / 16)).clamp(0, 255) as u8;
            }
            if x > 0 && y + 1 < new_h {
                let p = dithered.get_pixel_mut(x - 1, y + 1);
                p[0] = (p[0] as i16 + (err * 3 / 16)).clamp(0, 255) as u8;
            }
            if y + 1 < new_h {
                let p = dithered.get_pixel_mut(x, y + 1);
                p[0] = (p[0] as i16 + (err * 5 / 16)).clamp(0, 255) as u8;
            }
            if x + 1 < max_dots && y + 1 < new_h {
                let p = dithered.get_pixel_mut(x + 1, y + 1);
                p[0] = (p[0] as i16 + (err / 16)).clamp(0, 255) as u8;
            }
        }
    }
    
    // Pack into bytes (1 bit per pixel, MSB first)
    let bytes_per_row = (max_dots + 7) / 8;
    let mut raster_data = Vec::with_capacity((bytes_per_row * new_h) as usize);
    
    for y in 0..new_h {
        for byte_idx in 0..bytes_per_row {
            let mut byte = 0u8;
            for bit in 0..8 {
                let x = byte_idx * 8 + bit;
                if x < max_dots {
                    let pixel = dithered.get_pixel(x, y)[0];
                    if pixel == 0 {
                        byte |= 0x80 >> bit;
                    }
                }
            }
            raster_data.push(byte);
        }
    }
    
    // ESC/POS GS v 0 command: GS v 0 m xL xH yL yH d1...dk
    // m = 0 (normal), xL/xH = width in bytes (low/high), yL/yH = height in pixels (low/high)
    let x_l = (bytes_per_row % 256) as u8;
    let x_h = (bytes_per_row / 256) as u8;
    let y_l = (new_h % 256) as u8;
    let y_h = (new_h / 256) as u8;
    
    let mut cmd = Vec::new();
    cmd.extend([0x1D, 0x76, 0x30, 0x00, x_l, x_h, y_l, y_h]); // GS v 0 m xL xH yL yH
    cmd.extend(raster_data);
    
    Ok(cmd)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_receipt() -> ReceiptData {
        let tx = Transaction {
            id: 1,
            invoice_number: "INV-20261005-0001".into(),
            queue_number: Some(3),
            customer_name: Some("Bapak Andi".into()),
            vehicle_plate: "B 1234 ABC".into(),
            mechanic_id: None,
            cashier_name: "Admin".into(),
            subtotal: 125000.0,
            discount: 0.0,
            total_amount: 125000.0,
            paid_amount: 130000.0,
            change_amount: 5000.0,
            payment_method: "Cash".into(),
            status: "Lunas".into(),
            transaction_date: "2026-10-05T10:30:00+07:00".into(),
            mechanic_name: None,
        };
        let details = vec![
            TransactionDetail {
                id: 1,
                transaction_id: 1,
                item_type: "layanan".into(),
                item_name: "Ganti Kampas Rem".into(),
                quantity: 1,
                unit_price: 30000.0,
                total_price: 30000.0,
                service_type: None,
            },
            TransactionDetail {
                id: 2,
                transaction_id: 1,
                item_type: "sparepart".into(),
                item_name: "Roller".into(),
                quantity: 1,
                unit_price: 95000.0,
                total_price: 95000.0,
                service_type: None,
            },
        ];
        let settings = Settings {
            id: 1,
            shop_name: Some("POS Bengkel".into()),
            shop_address: Some("Jl. Raya No. 123".into()),
            receipt_footer: Some("Terima kasih sudah berbelanja".into()),
            printer_name: None,
            paper_width: Some(80),
            shop_logo: None,
        };
        ReceiptData::from_parts(&tx, &details, &settings)
    }

    #[test]
    fn receipt_has_layers_before_sparepart_and_dashed_separators() {
        let receipt = sample_receipt();
        let bytes = build_receipt_bytes(&receipt, 80, None);
        let text = String::from_utf8_lossy(&bytes);

        let layanan_pos = text.find("LAYANAN").expect("LAYANAN header missing");
        let spare_pos = text.find("SPARE PART").expect("SPARE PART header missing");
        assert!(layanan_pos < spare_pos, "LAYANAN must appear before SPARE PART");

        assert!(text.contains("--------"), "dashed separators missing");
        assert!(text.contains("Ganti Kampas Rem"));
        assert!(text.contains("Roller"));
        assert!(text.contains("Terima kasih sudah berbelanja"));
        assert!(text.contains("125,000"), "subtotal must use thousands separator");
        assert!(!text.contains("Total Layanan:\n"), "layanan total label must be on same line as value");
    }

    #[test]
    fn receipt_uses_utf8_for_indonesian_text() {
        let receipt = sample_receipt();
        let bytes = build_receipt_bytes(&receipt, 80, None);
        assert!(String::from_utf8(bytes).is_ok());
    }

    #[test]
    fn receipt_58mm_uses_narrow_column() {
        let receipt = sample_receipt();
        let narrow = build_receipt_bytes(&receipt, 58, None);
        let wide = build_receipt_bytes(&receipt, 80, None);
        assert!(narrow.len() < wide.len(), "58mm stream must be narrower than 80mm");
    }
}
