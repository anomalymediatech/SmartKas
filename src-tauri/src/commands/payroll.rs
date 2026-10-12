use crate::error::AppError;
use crate::database::repositories::payroll::{
    delete_commission_line_override as remove_line_override,
    delete_helper_day as remove_helper_day,
    get_helper_daily_logs as fetch_helper_logs,
    get_weekly_commission_summary as fetch_commission_summary,
    get_weekly_payroll_preview as fetch_preview,
    get_weekly_payrolls as fetch_payrolls,
    log_helper_day as insert_helper_log,
    save_commission_line_override as upsert_line_override,
    save_weekly_payroll as upsert_payroll,
    HelperDailyLog, HelperDailyLogSummary, PayrollRow, WeeklyCommissionSummary, WeeklyPayrollPreviewRow,
};
use crate::database::get_db_connection;

#[tauri::command]
pub async fn get_helper_daily_logs(
    app_handle: tauri::AppHandle,
    token: String,
    employee_id: i64,
    date_from: String,
    date_to: String,
) -> Result<HelperDailyLogSummary, AppError> {
    crate::commands::auth::require_admin(&app_handle, &token).await?;
    let pool = get_db_connection(&app_handle).await?;
    fetch_helper_logs(&pool, employee_id, &date_from, &date_to).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn log_helper_day(
    app_handle: tauri::AppHandle,
    token: String,
    employee_id: i64,
    work_date: String,
    days: f64,
    note: Option<String>,
) -> Result<HelperDailyLog, AppError> {
    crate::commands::auth::require_admin(&app_handle, &token).await?;
    let pool = get_db_connection(&app_handle).await?;
    insert_helper_log(&pool, employee_id, &work_date, days, note.as_deref())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_helper_day(app_handle: tauri::AppHandle, token: String, id: i64) -> Result<(), AppError> {
    crate::commands::auth::require_admin(&app_handle, &token).await?;
    let pool = get_db_connection(&app_handle).await?;
    remove_helper_day(&pool, id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_weekly_payroll_preview(
    app_handle: tauri::AppHandle,
    token: String,
    date_from: String,
    date_to: String,
) -> Result<Vec<WeeklyPayrollPreviewRow>, AppError> {
    crate::commands::auth::require_admin(&app_handle, &token).await?;
    let pool = get_db_connection(&app_handle).await?;
    fetch_preview(&pool, &date_from, &date_to).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_weekly_payroll(
    app_handle: tauri::AppHandle,
    token: String,
    employee_id: i64,
    date_from: String,
    date_to: String,
    final_amount: f64,
    status: String,
    note: Option<String>,
    weekly_salary_override: Option<f64>,
) -> Result<PayrollRow, AppError> {
    crate::commands::auth::require_admin(&app_handle, &token).await?;
    let pool = get_db_connection(&app_handle).await?;
    upsert_payroll(&pool, employee_id, &date_from, &date_to, final_amount, &status, note.as_deref(), weekly_salary_override)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_weekly_payrolls(
    app_handle: tauri::AppHandle,
    token: String,
    date_from: String,
) -> Result<Vec<PayrollRow>, AppError> {
    crate::commands::auth::require_admin(&app_handle, &token).await?;
    let pool = get_db_connection(&app_handle).await?;
    fetch_payrolls(&pool, &date_from).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_weekly_commission_summary(
    app_handle: tauri::AppHandle,
    token: String,
    employee_id: i64,
    date_from: String,
    date_to: String,
) -> Result<WeeklyCommissionSummary, AppError> {
    crate::commands::auth::require_admin(&app_handle, &token).await?;
    let pool = get_db_connection(&app_handle).await?;
    fetch_commission_summary(&pool, employee_id, &date_from, &date_to).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_commission_line_override(
    app_handle: tauri::AppHandle,
    token: String,
    line_kind: String,
    line_ref_id: i64,
    employee_id: i64,
    amount: f64,
    note: Option<String>,
) -> Result<(), AppError> {
    crate::commands::auth::require_admin(&app_handle, &token).await?;
    let pool = get_db_connection(&app_handle).await?;
    upsert_line_override(&pool, &line_kind, line_ref_id, employee_id, amount, note.as_deref())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_commission_line_override(
    app_handle: tauri::AppHandle,
    token: String,
    line_kind: String,
    line_ref_id: i64,
) -> Result<(), AppError> {
    crate::commands::auth::require_admin(&app_handle, &token).await?;
    let pool = get_db_connection(&app_handle).await?;
    remove_line_override(&pool, &line_kind, line_ref_id)
        .await
        .map_err(|e| e.to_string())
}
