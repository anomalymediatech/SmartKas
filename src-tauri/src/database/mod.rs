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

#[cfg(test)]
mod tests {
    #[tokio::test]
    async fn vacuum_into_backup_preserves_data() {
        let dir = std::env::temp_dir().join(format!("smartkas-backup-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let src = dir.join("main.db");
        let bkp = dir.join("backup.db");

        let db = libsql::Builder::new_local(format!("file:{}", src.to_string_lossy())).build().await.unwrap();
        let conn = db.connect().unwrap();
        conn.execute_batch(crate::database::init::SCHEMA_SQL).await.unwrap();
        conn.execute("INSERT INTO mechanics (name) VALUES ('Budi')", ()).await.unwrap();

        let escaped = bkp.to_string_lossy().replace('\'', "''");
        conn.execute(&format!("VACUUM INTO '{}'", escaped), ()).await.unwrap();
        assert!(bkp.exists());
        assert!(std::fs::metadata(&bkp).unwrap().len() > 0);

        // Restore = copy backup over main db, then reopen
        std::fs::copy(&bkp, &src).unwrap();
        let db2 = libsql::Builder::new_local(format!("file:{}", src.to_string_lossy())).build().await.unwrap();
        let conn2 = db2.connect().unwrap();
        let mut rows = conn2.query("SELECT name FROM mechanics", ()).await.unwrap();
        let mut names = Vec::new();
        while let Some(row) = rows.next().await.unwrap() {
            names.push(row.get::<String>(0).unwrap());
        }
        assert_eq!(names, vec!["Budi".to_string()]);

        let _ = std::fs::remove_dir_all(&dir);
    }
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
