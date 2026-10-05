use super::super::DbPool;
use serde::{Deserialize, Serialize};
use anyhow::Result;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Settings {
    pub id: i64,
    pub shop_name: Option<String>,
    pub shop_address: Option<String>,
    pub receipt_footer: Option<String>,
    pub printer_name: Option<String>,
    pub paper_width: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct UpdateSettingsInput {
    #[serde(default)]
    pub shop_name: Option<String>,
    #[serde(default)]
    pub shop_address: Option<String>,
    #[serde(default)]
    pub receipt_footer: Option<String>,
    #[serde(default)]
    pub printer_name: Option<String>,
    #[serde(default)]
    pub paper_width: Option<i64>,
}

pub async fn get_settings(pool: &DbPool) -> Result<Option<Settings>> {
    let conn = pool.lock().await;
    let mut rows = conn.query("SELECT id, shop_name, shop_address, receipt_footer, printer_name, paper_width FROM settings WHERE id = 1", ()).await?;
    if let Some(row) = rows.next().await? {
        Ok(Some(Settings {
            id: row.get(0)?,
            shop_name: row.get(1)?,
            shop_address: row.get(2)?,
            receipt_footer: row.get(3)?,
            printer_name: row.get(4)?,
            paper_width: row.get(5)?,
        }))
    } else {
        Ok(None)
    }
}

pub async fn update_settings(pool: &DbPool, input: UpdateSettingsInput) -> Result<Settings> {
    let conn = pool.lock().await;
    
    let mut updates = Vec::new();
    let mut params: Vec<libsql::Value> = Vec::new();
    
    if let Some(n) = input.shop_name {
        updates.push("shop_name = ?");
        params.push(n.into());
    }
    if let Some(a) = input.shop_address {
        updates.push("shop_address = ?");
        params.push(a.into());
    }
    if let Some(f) = input.receipt_footer {
        updates.push("receipt_footer = ?");
        params.push(f.into());
    }
    if let Some(p) = input.printer_name {
        updates.push("printer_name = ?");
        params.push(p.into());
    }
    if let Some(w) = input.paper_width {
        updates.push("paper_width = ?");
        params.push(w.into());
    }
    
    if !updates.is_empty() {
        let sql = format!("UPDATE settings SET {} WHERE id = 1", updates.join(", "));
        conn.execute(&sql, libsql::params_from_iter(params)).await?;
    }
    drop(conn);

    get_settings(pool).await?.ok_or_else(|| anyhow::anyhow!("Settings not found"))
}