/// User-friendly error type for all Tauri commands.
/// A String alias so existing repositories (anyhow::Error mapped with to_string)
/// remain compatible while giving every command a single, consistent error type.
pub type AppError = String;
