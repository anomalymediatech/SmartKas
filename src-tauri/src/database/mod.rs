pub mod init;
pub mod repositories;

use tauri::Manager;
use libsql::{Builder, Connection};
use std::sync::Arc;
use tokio::sync::Mutex;

pub type DbPool = Arc<Mutex<Connection>>;

pub fn get_db_path(app_handle: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    std::fs::create_dir_all(&app_data_dir)
        .map_err(|e| format!("Failed to create app data dir: {}", e))?;

    Ok(app_data_dir.join("smartkas.db"))
}

pub async fn get_db_connection(app_handle: &tauri::AppHandle) -> Result<DbPool, String> {
    let db_path = get_db_path(app_handle)?;
    let db_url = format!("file:{}", db_path.to_string_lossy());

    let db = Builder::new_local(db_url)
        .build()
        .await
        .map_err(|e| format!("Failed to build database: {}", e))?;

    let conn = db.connect().map_err(|e| format!("Failed to connect to database: {}", e))?;

    // Enable WAL mode and foreign keys (PRAGMA returns a row, so use query)
    let mut rows = conn.query("PRAGMA journal_mode=WAL;", ())
        .await
        .map_err(|e| format!("Failed to enable WAL: {}", e))?;
    let _ = rows.next().await
        .map_err(|e| format!("Failed to enable WAL: {}", e))?;

    let mut rows = conn.query("PRAGMA foreign_keys=ON;", ())
        .await
        .map_err(|e| format!("Failed to enable foreign keys: {}", e))?;
    let _ = rows.next().await
        .map_err(|e| format!("Failed to enable foreign keys: {}", e))?;

    Ok(Arc::new(Mutex::new(conn)))
}
