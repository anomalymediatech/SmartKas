//! SmartKas - Automotive Workshop POS System
//! Tauri v2 backend with SQLite database and ESC/POS printing

mod database;
mod commands;
mod escpos;
mod auth;
mod error;

use database::init::init_database;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // Initialize database on startup
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = init_database(&app_handle).await {
                    eprintln!("Database initialization failed: {}", e);
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Database commands
            commands::database::init_database,
            commands::database::backup_database,
            commands::database::restore_database,
            
            // Settings commands
            commands::settings::get_settings,
            commands::settings::update_settings,
            
            // Mechanics commands
            commands::mechanics::get_mechanics,
            commands::mechanics::create_mechanic,
            commands::mechanics::update_mechanic,
            commands::mechanics::delete_mechanic,
            commands::mechanics::toggle_mechanic_active,
            
            // Spareparts commands
            commands::spareparts::get_spareparts,
            commands::spareparts::search_spareparts,
            commands::spareparts::create_sparepart,
            commands::spareparts::update_sparepart,
            commands::spareparts::delete_sparepart,
            commands::spareparts::adjust_stock,
            
            // Services commands
            commands::services::get_services,
            commands::services::search_services,
            commands::services::create_service,
            commands::services::update_service,
            commands::services::delete_service,
            
            // Transaction commands
            commands::transactions::create_transaction,
            commands::transactions::void_transaction,
            commands::transactions::get_transactions,
            commands::transactions::get_transaction_details,
            commands::transactions::get_stock_movements,
            
            // Printing commands
            commands::printing::print_receipt,
            commands::printing::get_printers,

            // Dashboard commands
            commands::dashboard::get_daily_summary,
            commands::dashboard::get_low_stock_items,
            commands::dashboard::get_mechanic_performance,
            commands::dashboard::get_sales_trend,

            // Vehicle history & reminders
            commands::vehicle::get_vehicle_history,
            commands::vehicle::get_vehicle_reminder,
            commands::vehicle::get_upcoming_reminders,
            commands::vehicle::search_vehicle_plates,

            // Employee & commission commands
            commands::employees::get_employees,
            commands::employees::add_employee,
            commands::employees::delete_employee,
            commands::employees::calculate_mechanic_commission,
            commands::employees::get_mechanic_monthly_summary,

            // Supplies & purchasing
            commands::supplies::get_suppliers,
            commands::supplies::create_supplier,
            commands::supplies::create_purchase_order,
            commands::supplies::receive_purchase_order,
            commands::supplies::get_purchase_orders,

            // Auth
            commands::auth::login,
            commands::auth::logout,
            commands::auth::check_session,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}