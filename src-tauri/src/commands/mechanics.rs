use crate::error::AppError;
use crate::database::repositories::mechanics::{
    get_mechanics as fetch_mechanics, create_mechanic as insert_mechanic,
    update_mechanic as edit_mechanic, delete_mechanic as remove_mechanic,
    toggle_mechanic_active as set_mechanic_active, Mechanic,
};
use crate::database::get_db_connection;
use anyhow::Result;

#[tauri::command]
pub async fn get_mechanics(app_handle: tauri::AppHandle, active_only: bool) -> Result<Vec<Mechanic>, AppError> {
    let pool = get_db_connection(&app_handle).await?;
    fetch_mechanics(&pool, active_only).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_mechanic(app_handle: tauri::AppHandle, name: String) -> Result<Mechanic, AppError> {
    let pool = get_db_connection(&app_handle).await?;
    insert_mechanic(&pool, &name).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_mechanic(app_handle: tauri::AppHandle, id: i64, name: String) -> Result<Mechanic, AppError> {
    let pool = get_db_connection(&app_handle).await?;
    edit_mechanic(&pool, id, &name).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_mechanic(app_handle: tauri::AppHandle, id: i64) -> Result<(), AppError> {
    let pool = get_db_connection(&app_handle).await?;
    remove_mechanic(&pool, id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn toggle_mechanic_active(app_handle: tauri::AppHandle, id: i64, is_active: i32) -> Result<(), AppError> {
    let pool = get_db_connection(&app_handle).await?;
    set_mechanic_active(&pool, id, is_active).await.map_err(|e| e.to_string())
}
