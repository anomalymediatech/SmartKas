use super::super::DbPool;
use libsql::{params};
use serde::{Deserialize, Serialize};
use anyhow::Result;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Sparepart {
    pub id: i64,
    pub name: String,
    pub buy_price: f64,
    pub sell_price: f64,
    pub stock: i32,
    pub is_active: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateSparepartInput {
    pub name: String,
    pub buy_price: f64,
    pub sell_price: f64,
    pub stock: i32,
    pub is_active: i32,
}

impl From<CreateSparepartInput> for Sparepart {
    fn from(input: CreateSparepartInput) -> Self {
        Self {
            id: 0,
            name: input.name,
            buy_price: input.buy_price,
            sell_price: input.sell_price,
            stock: input.stock,
            is_active: input.is_active,
        }
    }
}

pub async fn get_spareparts(pool: &DbPool, active_only: bool) -> Result<Vec<Sparepart>> {
    let conn = pool.lock().await;
    let sql = if active_only {
        "SELECT id, name, buy_price, sell_price, stock, is_active FROM spareparts WHERE is_active = 1 ORDER BY name"
    } else {
        "SELECT id, name, buy_price, sell_price, stock, is_active FROM spareparts ORDER BY name"
    };
    let mut rows = conn.query(sql, ()).await?;
    let mut parts = Vec::new();
    while let Some(row) = rows.next().await? {
        parts.push(Sparepart {
            id: row.get(0)?,
            name: row.get(1)?,
            buy_price: row.get(2)?,
            sell_price: row.get(3)?,
            stock: row.get(4)?,
            is_active: row.get(5)?,
        });
    }
    Ok(parts)
}

pub async fn search_spareparts(pool: &DbPool, query: &str) -> Result<Vec<Sparepart>> {
    let conn = pool.lock().await;
    let search_pattern = format!("%{}%", query);
    let mut rows = conn.query(
        "SELECT id, name, buy_price, sell_price, stock, is_active FROM spareparts WHERE name LIKE ? AND is_active = 1 ORDER BY name",
        params![search_pattern],
    ).await?;
    let mut parts = Vec::new();
    while let Some(row) = rows.next().await? {
        parts.push(Sparepart {
            id: row.get(0)?,
            name: row.get(1)?,
            buy_price: row.get(2)?,
            sell_price: row.get(3)?,
            stock: row.get(4)?,
            is_active: row.get(5)?,
        });
    }
    Ok(parts)
}

pub async fn create_sparepart(pool: &DbPool, input: CreateSparepartInput) -> Result<Sparepart> {
    let conn = pool.lock().await;
    let sparepart = Sparepart {
        id: 0,
        name: input.name.clone(),
        buy_price: input.buy_price,
        sell_price: input.sell_price,
        stock: input.stock,
        is_active: input.is_active,
    };
    conn.execute(
        "INSERT INTO spareparts (name, buy_price, sell_price, stock, is_active) VALUES (?, ?, ?, ?, ?)",
        params![input.name, input.buy_price, input.sell_price, input.stock, input.is_active],
    ).await?;
    let id = conn.last_insert_rowid();
    Ok(Sparepart { id, ..sparepart })
}

pub async fn update_sparepart(pool: &DbPool, id: i64, name: Option<&str>, buy_price: Option<f64>, sell_price: Option<f64>, stock: Option<i32>, is_active: Option<i32>) -> Result<Sparepart> {
    let conn = pool.lock().await;
    
    let mut updates = Vec::new();
    let mut params: Vec<libsql::Value> = Vec::new();
    
    if let Some(n) = name {
        updates.push("name = ?");
        params.push(n.to_string().into());
    }
    if let Some(bp) = buy_price {
        updates.push("buy_price = ?");
        params.push(bp.into());
    }
    if let Some(sp) = sell_price {
        updates.push("sell_price = ?");
        params.push(sp.into());
    }
    if let Some(st) = stock {
        updates.push("stock = ?");
        params.push(st.into());
    }
    if let Some(ia) = is_active {
        updates.push("is_active = ?");
        params.push(ia.into());
    }
    
    if updates.is_empty() {
        drop(conn);
        return get_sparepart_by_id(pool, id).await;
    }
    
    let sql = format!("UPDATE spareparts SET {} WHERE id = ?", updates.join(", "));
    params.push(id.into());
    
    conn.execute(&sql, libsql::params_from_iter(params)).await?;
    drop(conn);

    get_sparepart_by_id(pool, id).await
}

async fn get_sparepart_by_id(pool: &DbPool, id: i64) -> Result<Sparepart> {
    let conn = pool.lock().await;
    let mut rows = conn.query("SELECT id, name, buy_price, sell_price, stock, is_active FROM spareparts WHERE id = ?", params![id]).await?;
    if let Some(row) = rows.next().await? {
        Ok(Sparepart {
            id: row.get(0)?,
            name: row.get(1)?,
            buy_price: row.get(2)?,
            sell_price: row.get(3)?,
            stock: row.get(4)?,
            is_active: row.get(5)?,
        })
    } else {
        Err(anyhow::anyhow!("Sparepart not found"))
    }
}

pub async fn delete_sparepart(pool: &DbPool, id: i64) -> Result<()> {
    let conn = pool.lock().await;
    conn.execute("DELETE FROM spareparts WHERE id = ?", params![id]).await?;
    Ok(())
}

pub async fn adjust_stock(pool: &DbPool, sparepart_id: i64, delta: i32, reason: &str, reference_type: Option<&str>, reference_id: Option<i64>) -> Result<Sparepart> {
    let conn = pool.lock().await;
    
    // Start transaction
    conn.execute("BEGIN IMMEDIATE TRANSACTION", ()).await?;
    
    // Get current stock
    let mut rows = conn.query("SELECT stock FROM spareparts WHERE id = ?", params![sparepart_id]).await?;
    let current_stock: i32 = if let Some(row) = rows.next().await? {
        row.get(0)?
    } else {
        conn.execute("ROLLBACK", ()).await?;
        return Err(anyhow::anyhow!("Sparepart not found"));
    };
    
    let new_stock = current_stock + delta;
    if new_stock < 0 {
        conn.execute("ROLLBACK", ()).await?;
        return Err(anyhow::anyhow!("Insufficient stock"));
    }
    
    // Update stock
    conn.execute("UPDATE spareparts SET stock = ? WHERE id = ?", params![new_stock, sparepart_id]).await?;
    
    // Record movement
    let movement_type = if delta > 0 { "in" } else if delta < 0 { "out" } else { "adjustment" };
    conn.execute(
        "INSERT INTO stock_movements (sparepart_id, movement_type, quantity, reference_type, reference_id, reason) VALUES (?, ?, ?, ?, ?, ?)",
        params![sparepart_id, movement_type, delta.abs(), reference_type, reference_id, reason],
    ).await?;
    
    conn.execute("COMMIT", ()).await?;
    drop(conn);

    get_sparepart_by_id(pool, sparepart_id).await
}