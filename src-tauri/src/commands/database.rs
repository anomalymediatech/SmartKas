use crate::error::AppError;
use crate::database::{get_db_connection, get_db_path, init::init_database as run_init_database};
use anyhow::Result;

#[tauri::command]
pub async fn init_database(app_handle: tauri::AppHandle) -> Result<(), AppError> {
    run_init_database(&app_handle).await
}

#[tauri::command]
pub async fn backup_database(app_handle: tauri::AppHandle, token: String, path: String) -> Result<(), AppError> {
    crate::commands::auth::require_admin(&app_handle, &token).await?;
    let pool = get_db_connection(&app_handle).await?;

    // VACUUM INTO performs a consistent online backup of the SQLite database
    {
        let conn = pool.lock().await;
        let escaped = path.replace('\'', "''");
        conn.execute(&format!("VACUUM INTO '{}'", escaped), ())
            .await
            .map_err(|e| format!("Backup failed: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
pub async fn restore_database(app_handle: tauri::AppHandle, token: String, path: String) -> Result<(), AppError> {
    crate::commands::auth::require_admin(&app_handle, &token).await?;
    let db_path = get_db_path(&app_handle)?;

    if !std::path::Path::new(&path).exists() {
        return Err("File backup tidak ditemukan".to_string());
    }

    // Remove stale database files (including WAL/SHM) before replacing
    let _ = std::fs::remove_file(&db_path);
    let _ = std::fs::remove_file(format!("{}-wal", db_path.to_string_lossy()));
    let _ = std::fs::remove_file(format!("{}-shm", db_path.to_string_lossy()));

    std::fs::copy(&path, &db_path)
        .map_err(|e| format!("Restore failed: {}", e))?;

    Ok(())
}
