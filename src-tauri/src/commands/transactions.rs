use crate::error::AppError;
use crate::database::repositories::transactions::{
    create_transaction as insert_transaction, void_transaction as cancel_transaction,
    get_transactions as fetch_transactions, get_transaction_details as fetch_transaction_details,
    get_stock_movements as fetch_stock_movements, CreateTransactionInput, HistoryFilters,
    Transaction, TransactionDetail, TransactionOutput, SearchResult, StockMovement,
};
use crate::database::get_db_connection;
use anyhow::Result;

#[tauri::command]
pub async fn create_transaction(app_handle: tauri::AppHandle, input: CreateTransactionInput) -> Result<TransactionOutput, AppError> {
    let pool = get_db_connection(&app_handle).await?;
    insert_transaction(&pool, input).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn void_transaction(app_handle: tauri::AppHandle, transaction_id: i64) -> Result<(), AppError> {
    let pool = get_db_connection(&app_handle).await?;
    cancel_transaction(&pool, transaction_id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_transactions(app_handle: tauri::AppHandle, filters: HistoryFilters) -> Result<SearchResult<Transaction>, AppError> {
    let pool = get_db_connection(&app_handle).await?;
    fetch_transactions(&pool, filters).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_transaction_details(app_handle: tauri::AppHandle, transaction_id: i64) -> Result<Vec<TransactionDetail>, AppError> {
    let pool = get_db_connection(&app_handle).await?;
    fetch_transaction_details(&pool, transaction_id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_next_queue_number(app_handle: tauri::AppHandle) -> Result<i32, AppError> {
    let pool = get_db_connection(&app_handle).await?;
    crate::database::repositories::transactions::get_next_queue_number(&pool).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_daily_close(app_handle: tauri::AppHandle, date: Option<String>) -> Result<DailyCloseReport, AppError> {
    let pool = get_db_connection(&app_handle).await?;
    let (rows, total_count, total_amount) =
        crate::database::repositories::transactions::get_daily_close(&pool, date.as_deref()).await.map_err(|e| e.to_string())?;
    Ok(DailyCloseReport { rows, total_count, total_amount })
}

#[derive(serde::Serialize)]
pub struct DailyCloseReport {
    pub rows: Vec<crate::database::repositories::transactions::DailyCloseRow>,
    pub total_count: i64,
    pub total_amount: f64,
}

#[tauri::command]
pub async fn get_stock_movements(app_handle: tauri::AppHandle, sparepart_id: Option<i64>) -> Result<Vec<StockMovement>, AppError> {
    let pool = get_db_connection(&app_handle).await?;
    fetch_stock_movements(&pool, sparepart_id).await.map_err(|e| e.to_string())
}
