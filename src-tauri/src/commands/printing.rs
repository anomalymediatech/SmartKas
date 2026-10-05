use crate::error::AppError;
use crate::escpos::receipt::build_receipt_bytes;
use crate::database::repositories::transactions::{get_transaction_details, Transaction};
use crate::database::repositories::settings::get_settings;
use crate::database::get_db_connection;
use anyhow::Result;

#[tauri::command]
pub async fn print_receipt(app_handle: tauri::AppHandle, transaction_id: i64, printer_name: Option<String>, paper_width: u8) -> Result<Vec<u8>, AppError> {
    let pool = get_db_connection(&app_handle).await?;

    // Get transaction
    let conn = pool.lock().await;
    let mut rows = conn.query(
        "SELECT t.id, t.invoice_number, t.queue_number, t.customer_name, t.vehicle_plate, t.mechanic_id, t.cashier_name, t.subtotal, t.discount, t.total_amount, t.paid_amount, t.change_amount, t.payment_method, t.status, t.transaction_date, m.name as mechanic_name
        FROM transactions t
        LEFT JOIN mechanics m ON t.mechanic_id = m.id
        WHERE t.id = ?",
        libsql::params![transaction_id],
    ).await.map_err(|e| e.to_string())?;

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

    // Get transaction details
    let details = get_transaction_details(&pool, transaction_id).await.map_err(|e| e.to_string())?;

    // Get settings
    let settings = get_settings(&pool).await.map_err(|e| e.to_string())?.unwrap_or_default();

    // Build ESC/POS bytes
    let bytes = build_receipt_bytes(&transaction, &details, &settings, paper_width);

    // Print to Windows printer if name provided
    if let Some(name) = printer_name {
        print_to_windows_printer(&name, &bytes).map_err(|e| e.to_string())?;
    }

    Ok(bytes)
}

#[tauri::command]
pub async fn get_printers(_app_handle: tauri::AppHandle) -> Result<Vec<PrinterInfo>, AppError> {
    let printers = get_windows_printers().map_err(|e| e.to_string())?;
    Ok(printers)
}

#[derive(serde::Serialize)]
pub struct PrinterInfo {
    pub name: String,
    pub is_default: bool,
}

fn get_windows_printers() -> Result<Vec<PrinterInfo>> {
    use windows::Win32::Graphics::Printing::*;
    use windows::core::*;

    let mut printers = Vec::new();

    unsafe {
        let mut needed = 0u32;
        let mut returned = 0u32;
        let flags = PRINTER_ENUM_LOCAL | PRINTER_ENUM_CONNECTIONS;

        // First call to get required buffer size
        let _ = EnumPrintersW(flags, PCWSTR::null(), 2, None, &mut needed, &mut returned);

        if needed == 0 {
            return Ok(printers);
        }

        let mut buffer = vec![0u8; needed as usize];
        if EnumPrintersW(flags, PCWSTR::null(), 2, Some(&mut buffer), &mut needed, &mut returned).is_ok() {
            let pinfo = buffer.as_ptr() as *const PRINTER_INFO_2W;
            for i in 0..returned as usize {
                let info = &*pinfo.add(i);
                let name = pwstr_to_string(info.pPrinterName);
                let is_default = (info.Attributes & PRINTER_ATTRIBUTE_DEFAULT) != 0;

                printers.push(PrinterInfo { name, is_default });
            }
        }
    }

    Ok(printers)
}

unsafe fn pwstr_to_string(p: windows::core::PWSTR) -> String {
    if p.0.is_null() {
        return String::new();
    }
    let mut len = 0usize;
    while *p.0.add(len) != 0 {
        len += 1;
    }
    String::from_utf16_lossy(std::slice::from_raw_parts(p.0, len))
}

fn print_to_windows_printer(printer_name: &str, data: &[u8]) -> Result<()> {
    use windows::Win32::Foundation::HANDLE;
    use windows::Win32::Graphics::Printing::*;
    use windows::core::*;

    unsafe {
        let printer_name_wide: Vec<u16> = printer_name.encode_utf16().chain(std::iter::once(0)).collect();
        let mut h_printer = HANDLE::default();

        if let Err(e) = OpenPrinterW(PCWSTR(printer_name_wide.as_ptr()), &mut h_printer, None) {
            return Err(anyhow::anyhow!("Failed to open printer: {}", e));
        }

        // Bind wide strings to locals so the pointers stay valid for doc_info's lifetime
        let doc_name_wide: Vec<u16> = "SmartKas Receipt".encode_utf16().chain(std::iter::once(0)).collect();
        let datatype_wide: Vec<u16> = "RAW".encode_utf16().chain(std::iter::once(0)).collect();
        let doc_info = DOC_INFO_1W {
            pDocName: PWSTR(doc_name_wide.as_ptr() as *mut u16),
            pOutputFile: PWSTR::null(),
            pDatatype: PWSTR(datatype_wide.as_ptr() as *mut u16),
        };

        let job_id = StartDocPrinterW(h_printer, 1, &doc_info);
        if job_id == 0 {
            let _ = ClosePrinter(h_printer);
            return Err(anyhow::anyhow!("Failed to start document"));
        }

        if !StartPagePrinter(h_printer).as_bool() {
            let _ = EndDocPrinter(h_printer);
            let _ = ClosePrinter(h_printer);
            return Err(anyhow::anyhow!("Failed to start page"));
        }

        let mut written = 0u32;
        if !WritePrinter(h_printer, data.as_ptr() as *const _, data.len() as u32, &mut written).as_bool() {
            let _ = EndPagePrinter(h_printer);
            let _ = EndDocPrinter(h_printer);
            let _ = ClosePrinter(h_printer);
            return Err(anyhow::anyhow!("Failed to write to printer"));
        }

        let _ = EndPagePrinter(h_printer);
        let _ = EndDocPrinter(h_printer);
        let _ = ClosePrinter(h_printer);
    }

    Ok(())
}
