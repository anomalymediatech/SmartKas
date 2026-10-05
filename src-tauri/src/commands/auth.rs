use crate::error::AppError;
use crate::auth::{generate_token, verify_password};
use crate::database::get_db_connection;
use libsql::params;
use serde::Serialize;

#[derive(Debug, Serialize, Clone)]
pub struct SessionUser {
    pub id: i64,
    pub username: String,
    pub role: String,
    pub token: String,
}

#[tauri::command]
pub async fn login(app_handle: tauri::AppHandle, username: String, password: String) -> Result<SessionUser, AppError> {
    let pool = get_db_connection(&app_handle).await?;
    let conn = pool.lock().await;

    let mut rows = conn
        .query(
            "SELECT id, username, password_hash, role FROM users WHERE username = ? AND is_active = 1",
            params![username],
        )
        .await
        .map_err(|e| e.to_string())?;

    let (id, name, hash, role): (i64, String, String, String) = match rows.next().await.map_err(|e| e.to_string())? {
        Some(row) => (row.get(0).map_err(|e| e.to_string())?, row.get(1).map_err(|e| e.to_string())?, row.get(2).map_err(|e| e.to_string())?, row.get(3).map_err(|e| e.to_string())?),
        None => return Err("Username atau password salah".to_string()),
    };

    if !verify_password(&password, &hash) {
        return Err("Username atau password salah".to_string());
    }

    let token = generate_token();
    conn.execute(
        "INSERT INTO sessions (token, user_id) VALUES (?, ?)",
        params![token.clone(), id],
    )
    .await
    .map_err(|e| e.to_string())?;

    Ok(SessionUser { id, username: name, role, token })
}

#[tauri::command]
pub async fn logout(app_handle: tauri::AppHandle, token: String) -> Result<(), AppError> {
    let pool = get_db_connection(&app_handle).await?;
    let conn = pool.lock().await;
    let _ = conn
        .execute("DELETE FROM sessions WHERE token = ?", params![token])
        .await;
    Ok(())
}

#[tauri::command]
pub async fn check_session(app_handle: tauri::AppHandle, token: String) -> Result<SessionUser, AppError> {
    let pool = get_db_connection(&app_handle).await?;
    let conn = pool.lock().await;

    let mut rows = conn
        .query(
            "SELECT u.id, u.username, u.role FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND u.is_active = 1",
            params![token.clone()],
        )
        .await
        .map_err(|e| e.to_string())?;

    match rows.next().await.map_err(|e| e.to_string())? {
        Some(row) => Ok(SessionUser {
            id: row.get(0).map_err(|e| e.to_string())?,
            username: row.get(1).map_err(|e| e.to_string())?,
            role: row.get(2).map_err(|e| e.to_string())?,
            token: token.clone(),
        }),
        None => Err("Sesi tidak valid".to_string()),
    }
}

/// Helper: resolve a token to (user_id, role); used by require_admin and require_auth.
pub async fn resolve_token(pool: &crate::database::DbPool, token: &str) -> Result<(i64, String), AppError> {
    let conn = pool.lock().await;
    let mut rows = conn
        .query(
            "SELECT u.id, u.role FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND u.is_active = 1",
            params![token],
        )
        .await
        .map_err(|e| e.to_string())?;
    match rows.next().await.map_err(|e| e.to_string())? {
        Some(row) => Ok((row.get(0).map_err(|e| e.to_string())?, row.get(1).map_err(|e| e.to_string())?)),
        None => Err("Sesi tidak valid, silakan login ulang".to_string()),
    }
}

pub async fn require_admin(app_handle: &tauri::AppHandle, token: &str) -> Result<(), AppError> {
    let pool = get_db_connection(app_handle).await?;
    let (_, role) = resolve_token(&pool, token).await?;
    if role != "admin" {
        return Err("Akses ditolak: hanya admin".to_string());
    }
    Ok(())
}
