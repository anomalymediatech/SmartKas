use super::super::DbPool;
use libsql::{params};
use serde::{Deserialize, Serialize};
use anyhow::Result;

#[derive(Debug, Serialize, Deserialize)]
pub struct Service {
    pub id: i64,
    pub name: String,
    pub price: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateServiceInput {
    pub name: String,
    pub price: f64,
}

impl From<CreateServiceInput> for Service {
    fn from(input: CreateServiceInput) -> Self {
        Self {
            id: 0,
            name: input.name,
            price: input.price,
        }
    }
}

pub async fn get_services(pool: &DbPool, _active_only: bool) -> Result<Vec<Service>> {
    // Services don't have is_active column, return all
    let conn = pool.lock().await;
    let mut rows = conn.query("SELECT id, name, price FROM services ORDER BY name", ()).await?;
    let mut services = Vec::new();
    while let Some(row) = rows.next().await? {
        services.push(Service {
            id: row.get(0)?,
            name: row.get(1)?,
            price: row.get(2)?,
        });
    }
    Ok(services)
}

pub async fn search_services(pool: &DbPool, query: &str) -> Result<Vec<Service>> {
    let conn = pool.lock().await;
    let search_pattern = format!("%{}%", query);
    let mut rows = conn.query(
        "SELECT id, name, price FROM services WHERE name LIKE ? ORDER BY name",
        params![search_pattern],
    ).await?;
    let mut services = Vec::new();
    while let Some(row) = rows.next().await? {
        services.push(Service {
            id: row.get(0)?,
            name: row.get(1)?,
            price: row.get(2)?,
        });
    }
    Ok(services)
}

pub async fn create_service(pool: &DbPool, input: CreateServiceInput) -> Result<Service> {
    let conn = pool.lock().await;
    let service = Service { id: 0, name: input.name.clone(), price: input.price };
    conn.execute("INSERT INTO services (name, price) VALUES (?, ?)", params![input.name, input.price]).await?;
    let id = conn.last_insert_rowid();
    Ok(Service { id, ..service })
}

pub async fn update_service(pool: &DbPool, id: i64, name: Option<&str>, price: Option<f64>) -> Result<Service> {
    let conn = pool.lock().await;
    
    let mut updates = Vec::new();
    let mut params: Vec<libsql::Value> = Vec::new();
    
    if let Some(n) = name {
        updates.push("name = ?");
        params.push(n.to_string().into());
    }
    if let Some(p) = price {
        updates.push("price = ?");
        params.push(p.into());
    }
    
    if updates.is_empty() {
        drop(conn);
        return get_service_by_id(pool, id).await;
    }
    
    let sql = format!("UPDATE services SET {} WHERE id = ?", updates.join(", "));
    params.push(id.into());
    
    conn.execute(&sql, libsql::params_from_iter(params)).await?;
    drop(conn);

    get_service_by_id(pool, id).await
}

async fn get_service_by_id(pool: &DbPool, id: i64) -> Result<Service> {
    let conn = pool.lock().await;
    let mut rows = conn.query("SELECT id, name, price FROM services WHERE id = ?", params![id]).await?;
    if let Some(row) = rows.next().await? {
        Ok(Service {
            id: row.get(0)?,
            name: row.get(1)?,
            price: row.get(2)?,
        })
    } else {
        Err(anyhow::anyhow!("Service not found"))
    }
}

pub async fn delete_service(pool: &DbPool, id: i64) -> Result<()> {
    let conn = pool.lock().await;
    conn.execute("DELETE FROM services WHERE id = ?", params![id]).await?;
    Ok(())
}