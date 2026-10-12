use crate::error::AppError;
use crate::database::repositories::employees::{
    add_employee as insert_employee,
    calculate_mechanic_commission as fetch_commission,
    delete_employee as remove_employee,
    get_employees as fetch_employees,
    update_employee as edit_employee,
    CreateEmployeeInput, Employee, MechanicCommissionSummary,
    UpdateEmployeeInput,
};
use crate::database::get_db_connection;

#[tauri::command]
pub async fn get_employees(app_handle: tauri::AppHandle, token: String) -> Result<Vec<Employee>, AppError> {
    crate::commands::auth::require_admin(&app_handle, &token).await?;
    let pool = get_db_connection(&app_handle).await?;
    fetch_employees(&pool).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn add_employee(app_handle: tauri::AppHandle, token: String, data: CreateEmployeeInput) -> Result<Employee, AppError> {
    crate::commands::auth::require_admin(&app_handle, &token).await?;
    let pool = get_db_connection(&app_handle).await?;
    insert_employee(&pool, data).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_employee(app_handle: tauri::AppHandle, token: String, data: UpdateEmployeeInput) -> Result<Employee, AppError> {
    crate::commands::auth::require_admin(&app_handle, &token).await?;
    let pool = get_db_connection(&app_handle).await?;
    edit_employee(&pool, data).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_employee(app_handle: tauri::AppHandle, token: String, id: i64) -> Result<(), AppError> {
    crate::commands::auth::require_admin(&app_handle, &token).await?;
    let pool = get_db_connection(&app_handle).await?;
    remove_employee(&pool, id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn calculate_mechanic_commission(
    app_handle: tauri::AppHandle,
    token: String,
    date_from: Option<String>,
    date_to: Option<String>,
) -> Result<Vec<MechanicCommissionSummary>, AppError> {
    crate::commands::auth::require_admin(&app_handle, &token).await?;
    let pool = get_db_connection(&app_handle).await?;
    fetch_commission(&pool, date_from.as_deref(), date_to.as_deref())
        .await
        .map_err(|e| e.to_string())
}
