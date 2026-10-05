use crate::database::repositories::vehicle::{
    get_vehicle_history as fetch_vehicle_history,
    get_vehicle_reminder as fetch_vehicle_reminder,
    get_upcoming_reminders as fetch_upcoming_reminders,
    search_vehicle_plates as fetch_vehicle_plates,
    VehicleVisit, VehicleReminder, UpcomingReminder,
};
use crate::database::get_db_connection;

#[tauri::command]
pub async fn get_vehicle_history(app_handle: tauri::AppHandle, plate_number: String) -> Result<Vec<VehicleVisit>, String> {
    let pool = get_db_connection(&app_handle).await?;
    fetch_vehicle_history(&pool, &plate_number).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_vehicle_reminder(app_handle: tauri::AppHandle, plate_number: String) -> Result<Option<VehicleReminder>, String> {
    let pool = get_db_connection(&app_handle).await?;
    fetch_vehicle_reminder(&pool, &plate_number).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_upcoming_reminders(app_handle: tauri::AppHandle) -> Result<Vec<UpcomingReminder>, String> {
    let pool = get_db_connection(&app_handle).await?;
    fetch_upcoming_reminders(&pool).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn search_vehicle_plates(app_handle: tauri::AppHandle, query: String) -> Result<Vec<String>, String> {
    let pool = get_db_connection(&app_handle).await?;
    fetch_vehicle_plates(&pool, &query).await.map_err(|e| e.to_string())
}
