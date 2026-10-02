use crate::database::repositories::transactions::{
    create_transaction as insert_transaction, void_transaction as cancel_transaction,
    get_transactions as fetch_transactions, get_transaction_details as fetch_transaction_details,
    get_stock_movements as fetch_stock_movements, CreateTransactionInput, HistoryFilters,
    Transaction, TransactionDetail, TransactionOutput, SearchResult, StockMovement,
};
use crate::database::get_db_connection;
use anyhow::Result;

#[tauri::command]
pub async fn create_transaction(app_handle: tauri::AppHandle, input: CreateTransactionInput) -> Result<TransactionOutput, String> {
    let pool = get_db_connection(&app_handle).await?;
    insert_transaction(&pool, input).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn void_transaction(app_handle: tauri::AppHandle, transaction_id: i64) -> Result<(), String> {
    let pool = get_db_connection(&app_handle).await?;
    cancel_transaction(&pool, transaction_id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_transactions(app_handle: tauri::AppHandle, filters: HistoryFilters) -> Result<SearchResult<Transaction>, String> {
    let pool = get_db_connection(&app_handle).await?;
    fetch_transactions(&pool, filters).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_transaction_details(app_handle: tauri::AppHandle, transaction_id: i64) -> Result<Vec<TransactionDetail>, String> {
    let pool = get_db_connection(&app_handle).await?;
    fetch_transaction_details(&pool, transaction_id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_stock_movements(app_handle: tauri::AppHandle, sparepart_id: Option<i64>) -> Result<Vec<StockMovement>, String> {
    let pool = get_db_connection(&app_handle).await?;
    fetch_stock_movements(&pool, sparepart_id).await.map_err(|e| e.to_string())
}
