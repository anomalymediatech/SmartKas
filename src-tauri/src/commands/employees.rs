use crate::database::repositories::employees::{
    add_employee as insert_employee,
    calculate_mechanic_commission as fetch_commission,
    delete_employee as remove_employee,
    get_employees as fetch_employees,
    get_mechanic_monthly_summary as fetch_monthly,
    CreateEmployeeInput, Employee, MechanicCommissionSummary, MechanicMonthlySummary,
};
use crate::database::get_db_connection;

#[tauri::command]
pub async fn get_employees(app_handle: tauri::AppHandle) -> Result<Vec<Employee>, String> {
    let pool = get_db_connection(&app_handle).await?;
    fetch_employees(&pool).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn add_employee(app_handle: tauri::AppHandle, data: CreateEmployeeInput) -> Result<Employee, String> {
    let pool = get_db_connection(&app_handle).await?;
    insert_employee(&pool, data).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_employee(app_handle: tauri::AppHandle, id: i64) -> Result<(), String> {
    let pool = get_db_connection(&app_handle).await?;
    remove_employee(&pool, id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn calculate_mechanic_commission(
    app_handle: tauri::AppHandle,
    date_from: Option<String>,
    date_to: Option<String>,
) -> Result<Vec<MechanicCommissionSummary>, String> {
    let pool = get_db_connection(&app_handle).await?;
    fetch_commission(&pool, date_from.as_deref(), date_to.as_deref())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_mechanic_monthly_summary(
    app_handle: tauri::AppHandle,
    employee_id: i64,
    month: i32,
    year: i32,
) -> Result<MechanicMonthlySummary, String> {
    let pool = get_db_connection(&app_handle).await?;
    fetch_monthly(&pool, employee_id, month, year)
        .await
        .map_err(|e| e.to_string())
}
