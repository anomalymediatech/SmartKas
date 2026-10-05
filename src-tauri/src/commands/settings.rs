use crate::error::AppError;
use crate::database::repositories::settings::{
    get_settings as fetch_settings, update_settings as persist_settings, Settings,
    UpdateSettingsInput,
};
use crate::database::get_db_connection;
use anyhow::Result;

#[tauri::command]
pub async fn get_settings(app_handle: tauri::AppHandle) -> Result<Option<Settings>, AppError> {
    let pool = get_db_connection(&app_handle).await?;
    fetch_settings(&pool).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_settings(app_handle: tauri::AppHandle, settings: UpdateSettingsInput) -> Result<Settings, AppError> {
    let pool = get_db_connection(&app_handle).await?;
    persist_settings(&pool, settings).await.map_err(|e| e.to_string())
}
