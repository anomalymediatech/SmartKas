use super::super::DbPool;
use libsql::params;
use serde::{Deserialize, Serialize};
use anyhow::Result;

#[derive(Debug, Serialize, Deserialize)]
pub struct Mechanic {
    pub id: i64,
    pub name: String,
    pub is_active: i32,
}

pub async fn get_mechanics(pool: &DbPool, active_only: bool) -> Result<Vec<Mechanic>> {
    let conn = pool.lock().await;
    let sql = if active_only {
        "SELECT id, name, is_active FROM mechanics WHERE is_active = 1 ORDER BY name"
    } else {
        "SELECT id, name, is_active FROM mechanics ORDER BY name"
    };
    let mut rows = conn.query(sql, ()).await?;
    let mut mechanics = Vec::new();
    while let Some(row) = rows.next().await? {
        mechanics.push(Mechanic {
            id: row.get(0)?,
            name: row.get(1)?,
            is_active: row.get(2)?,
        });
    }
    Ok(mechanics)
}

pub async fn create_mechanic(pool: &DbPool, name: &str) -> Result<Mechanic> {
    let conn = pool.lock().await;
    conn.execute("INSERT INTO mechanics (name) VALUES (?)", params![name]).await?;
    let id = conn.last_insert_rowid();
    Ok(Mechanic { id, name: name.to_string(), is_active: 1 })
}

pub async fn update_mechanic(pool: &DbPool, id: i64, name: &str) -> Result<Mechanic> {
    let conn = pool.lock().await;
    conn.execute("UPDATE mechanics SET name = ? WHERE id = ?", params![name, id]).await?;
    Ok(Mechanic { id, name: name.to_string(), is_active: 1 })
}

pub async fn delete_mechanic(pool: &DbPool, id: i64) -> Result<()> {
    let conn = pool.lock().await;
    conn.execute("DELETE FROM mechanics WHERE id = ?", params![id]).await?;
    Ok(())
}

pub async fn toggle_mechanic_active(pool: &DbPool, id: i64, is_active: i32) -> Result<()> {
    let conn = pool.lock().await;
    conn.execute("UPDATE mechanics SET is_active = ? WHERE id = ?", params![is_active, id]).await?;
    Ok(())
}