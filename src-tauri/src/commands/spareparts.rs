use crate::database::repositories::spareparts::{
    get_spareparts as fetch_spareparts, search_spareparts as find_spareparts,
    create_sparepart as insert_sparepart, delete_sparepart as remove_sparepart,
    Sparepart, CreateSparepartInput,
};
use crate::database::get_db_connection;
use anyhow::Result;

#[tauri::command]
pub async fn get_spareparts(app_handle: tauri::AppHandle, active_only: bool) -> Result<Vec<Sparepart>, String> {
    let pool = get_db_connection(&app_handle).await?;
    fetch_spareparts(&pool, active_only).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn search_spareparts(app_handle: tauri::AppHandle, query: String) -> Result<Vec<Sparepart>, String> {
    let pool = get_db_connection(&app_handle).await?;
    find_spareparts(&pool, &query).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_sparepart(app_handle: tauri::AppHandle, data: CreateSparepartInput) -> Result<Sparepart, String> {
    let pool = get_db_connection(&app_handle).await?;
    insert_sparepart(&pool, data).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_sparepart(app_handle: tauri::AppHandle, id: i64, data: serde_json::Value) -> Result<Sparepart, String> {
    let pool = get_db_connection(&app_handle).await?;

    let name = data.get("name").and_then(|v| v.as_str());
    let buy_price = data.get("buy_price").and_then(|v| v.as_f64());
    let sell_price = data.get("sell_price").and_then(|v| v.as_f64());
    let stock = data.get("stock").and_then(|v| v.as_i64()).map(|v| v as i32);
    let is_active = data.get("is_active").and_then(|v| v.as_i64()).map(|v| v as i32);

    crate::database::repositories::spareparts::update_sparepart(&pool, id, name, buy_price, sell_price, stock, is_active)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_sparepart(app_handle: tauri::AppHandle, id: i64) -> Result<(), String> {
    let pool = get_db_connection(&app_handle).await?;
    remove_sparepart(&pool, id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn adjust_stock(app_handle: tauri::AppHandle, sparepart_id: i64, delta: i32, reason: String) -> Result<Sparepart, String> {
    let pool = get_db_connection(&app_handle).await?;
    // Use adjustment type for manual adjustments
    crate::database::repositories::spareparts::adjust_stock(&pool, sparepart_id, delta, &reason, Some("adjustment"), None)
        .await
        .map_err(|e| e.to_string())
}
