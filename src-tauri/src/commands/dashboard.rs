use crate::error::AppError;
use crate::database::repositories::dashboard::{
    get_daily_summary as fetch_daily_summary,
    get_low_stock_items as fetch_low_stock_items,
    get_mechanic_performance as fetch_mechanic_performance,
    get_sales_trend as fetch_sales_trend,
    get_top_spareparts as fetch_top_spareparts,
    DailySummary, LowStockItem, MechanicPerformance, SalesTrendPoint, TopSparepart,
};
use crate::database::get_db_connection;

#[tauri::command]
pub async fn get_daily_summary(app_handle: tauri::AppHandle, date: Option<String>) -> Result<DailySummary, AppError> {
    let pool = get_db_connection(&app_handle).await?;
    fetch_daily_summary(&pool, date.as_deref()).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_low_stock_items(app_handle: tauri::AppHandle, threshold: i32) -> Result<Vec<LowStockItem>, AppError> {
    let pool = get_db_connection(&app_handle).await?;
    fetch_low_stock_items(&pool, threshold).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_mechanic_performance(
    app_handle: tauri::AppHandle,
    date_from: Option<String>,
    date_to: Option<String>,
) -> Result<Vec<MechanicPerformance>, AppError> {
    let pool = get_db_connection(&app_handle).await?;
    fetch_mechanic_performance(&pool, date_from.as_deref(), date_to.as_deref())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_sales_trend(app_handle: tauri::AppHandle, days: i32) -> Result<Vec<SalesTrendPoint>, AppError> {
    let pool = get_db_connection(&app_handle).await?;
    fetch_sales_trend(&pool, days).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_top_spareparts(app_handle: tauri::AppHandle, days: i32, limit: i32) -> Result<Vec<TopSparepart>, AppError> {
    let pool = get_db_connection(&app_handle).await?;
    fetch_top_spareparts(&pool, days, limit).await.map_err(|e| e.to_string())
}
