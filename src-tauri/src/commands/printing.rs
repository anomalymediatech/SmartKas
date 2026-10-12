use anyhow::Result;
use crate::error::AppError;

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

pub(crate) fn print_to_windows_printer(printer_name: &str, data: &[u8]) -> Result<()> {
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
