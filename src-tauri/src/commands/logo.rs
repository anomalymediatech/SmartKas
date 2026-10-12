use crate::database::get_db_connection;
use crate::error::AppError;
use tauri::Manager;
use anyhow::Result;
use std::fs;
use std::path::PathBuf;
use base64::{Engine as _, engine::general_purpose};

#[allow(dead_code)]
fn get_logos_dir(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    let logos_dir = app_data_dir.join("logos");
    fs::create_dir_all(&logos_dir)
        .map_err(|e| format!("Failed to create logos dir: {}", e))?;

    Ok(logos_dir)
}

#[allow(dead_code)]
fn get_mime_type(ext: &str) -> &'static str {
    match ext.to_lowercase().as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        _ => "application/octet-stream",
    }
}

#[allow(dead_code)]
#[tauri::command]
pub async fn upload_shop_logo(
    app_handle: tauri::AppHandle,
    file_data: Vec<u8>,
    extension: String,
) -> Result<String, AppError> {
    let logos_dir = get_logos_dir(&app_handle)?;
    
    let ext = extension.to_lowercase();
    if !["png", "jpg", "jpeg"].contains(&ext.as_str()) {
        return Err("Format tidak didukung. Gunakan PNG atau JPG.".to_string());
    }

    let file_name = format!("logo.{}", ext);
    let file_path = logos_dir.join(&file_name);
    
    fs::write(&file_path, &file_data)
        .map_err(|e| format!("Gagal menyimpan logo: {}", e))?;

    let pool = get_db_connection(&app_handle).await?;
    let conn = pool.lock().await;
    conn.execute(
        "UPDATE settings SET shop_logo = ? WHERE id = 1",
        libsql::params![file_name.clone()],
    )
    .await
    .map_err(|e| format!("Gagal update database: {}", e))?;

    Ok(file_name)
}

#[allow(dead_code)]
#[tauri::command]
pub async fn delete_shop_logo(
    app_handle: tauri::AppHandle,
) -> Result<(), AppError> {
    let logos_dir = get_logos_dir(&app_handle)?;
    
    let pool = get_db_connection(&app_handle).await?;
    let conn = pool.lock().await;
    
    let mut rows = conn
        .query("SELECT shop_logo FROM settings WHERE id = 1", ())
        .await
        .map_err(|e| e.to_string())?;
    
    if let Some(row) = rows.next().await.map_err(|e| e.to_string())? {
        let logo_path: Option<String> = row.get(0).map_err(|e| e.to_string())?;
        if let Some(logo) = logo_path {
            let file_path = logos_dir.join(&logo);
            if file_path.exists() {
                fs::remove_file(&file_path)
                    .map_err(|e| format!("Gagal menghapus file logo: {}", e))?;
            }
        }
    }
    
    conn.execute(
        "UPDATE settings SET shop_logo = NULL WHERE id = 1",
        (),
    )
    .await
    .map_err(|e| format!("Gagal update database: {}", e))?;

    Ok(())
}

#[allow(dead_code)]
#[tauri::command]
pub async fn get_shop_logo_path(
    app_handle: tauri::AppHandle,
) -> Result<Option<String>, AppError> {
    let pool = get_db_connection(&app_handle).await?;
    let conn = pool.lock().await;
    
    let mut rows = conn
        .query("SELECT shop_logo FROM settings WHERE id = 1", ())
        .await
        .map_err(|e| e.to_string())?;
    
    if let Some(row) = rows.next().await.map_err(|e| e.to_string())? {
        let logo_path: Option<String> = row.get(0).map_err(|e| e.to_string())?;
        Ok(logo_path)
    } else {
        Ok(None)
    }
}

#[allow(dead_code)]
#[tauri::command]
pub async fn get_shop_logo_base64(
    app_handle: tauri::AppHandle,
) -> Result<Option<String>, AppError> {
    let logos_dir = get_logos_dir(&app_handle)?;
    
    let pool = get_db_connection(&app_handle).await?;
    let conn = pool.lock().await;
    
    let mut rows = conn
        .query("SELECT shop_logo FROM settings WHERE id = 1", ())
        .await
        .map_err(|e| e.to_string())?;
    
    if let Some(row) = rows.next().await.map_err(|e| e.to_string())? {
        let logo_path: Option<String> = row.get(0).map_err(|e| e.to_string())?;
        if let Some(logo) = logo_path {
            let file_path = logos_dir.join(&logo);
            if file_path.exists() {
                let data = fs::read(&file_path)
                    .map_err(|e| format!("Gagal baca logo: {}", e))?;
                let ext = file_path.extension().and_then(|s| s.to_str()).unwrap_or("png");
                let mime = get_mime_type(ext);
                let base64 = general_purpose::STANDARD.encode(&data);
                return Ok(Some(format!("data:{};base64,{}", mime, base64)));
            }
        }
    }
    Ok(None)
}