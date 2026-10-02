use crate::database::repositories::services::{
    get_services as fetch_services, search_services as find_services,
    create_service as insert_service, delete_service as remove_service,
    Service, CreateServiceInput,
};
use crate::database::get_db_connection;
use anyhow::Result;

#[tauri::command]
pub async fn get_services(app_handle: tauri::AppHandle, active_only: bool) -> Result<Vec<Service>, String> {
    let pool = get_db_connection(&app_handle).await?;
    fetch_services(&pool, active_only).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn search_services(app_handle: tauri::AppHandle, query: String) -> Result<Vec<Service>, String> {
    let pool = get_db_connection(&app_handle).await?;
    find_services(&pool, &query).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_service(app_handle: tauri::AppHandle, data: CreateServiceInput) -> Result<Service, String> {
    let pool = get_db_connection(&app_handle).await?;
    insert_service(&pool, data).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_service(app_handle: tauri::AppHandle, id: i64, data: serde_json::Value) -> Result<Service, String> {
    let pool = get_db_connection(&app_handle).await?;

    let name = data.get("name").and_then(|v| v.as_str());
    let price = data.get("price").and_then(|v| v.as_f64());

    crate::database::repositories::services::update_service(&pool, id, name, price)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_service(app_handle: tauri::AppHandle, id: i64) -> Result<(), String> {
    let pool = get_db_connection(&app_handle).await?;
    remove_service(&pool, id).await.map_err(|e| e.to_string())
}
