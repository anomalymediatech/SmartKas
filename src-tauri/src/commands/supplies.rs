use crate::database::repositories::supplies::{
    create_purchase_order as insert_po,
    create_supplier as insert_supplier,
    get_purchase_orders as fetch_purchase_orders,
    get_suppliers as fetch_suppliers,
    receive_purchase_order as receive_po,
    CreatePurchaseOrderInput, CreateSupplierInput, PurchaseOrder, Supplier,
};
use crate::database::get_db_connection;

#[tauri::command]
pub async fn get_suppliers(app_handle: tauri::AppHandle) -> Result<Vec<Supplier>, String> {
    let pool = get_db_connection(&app_handle).await?;
    fetch_suppliers(&pool).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_supplier(app_handle: tauri::AppHandle, data: CreateSupplierInput) -> Result<Supplier, String> {
    let pool = get_db_connection(&app_handle).await?;
    insert_supplier(&pool, data).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_purchase_order(app_handle: tauri::AppHandle, data: CreatePurchaseOrderInput) -> Result<PurchaseOrder, String> {
    let pool = get_db_connection(&app_handle).await?;
    insert_po(&pool, data).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn receive_purchase_order(app_handle: tauri::AppHandle, po_id: i64) -> Result<(), String> {
    let pool = get_db_connection(&app_handle).await?;
    receive_po(&pool, po_id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_purchase_orders(app_handle: tauri::AppHandle, status: Option<String>) -> Result<Vec<PurchaseOrder>, String> {
    let pool = get_db_connection(&app_handle).await?;
    fetch_purchase_orders(&pool, status.as_deref()).await.map_err(|e| e.to_string())
}
