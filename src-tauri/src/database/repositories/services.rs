use super::super::DbPool;
use libsql::{params};
use serde::{Deserialize, Serialize};
use anyhow::Result;

#[derive(Debug, Serialize, Deserialize)]
pub struct Service {
    pub id: i64,
    pub name: String,
    pub price: f64,
    pub service_type: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateServiceInput {
    pub name: String,
    pub price: f64,
    #[serde(default = "default_service_type")]
    pub service_type: String,
}

fn default_service_type() -> String {
    "biasa".to_string()
}

/// Excel import row: `None` = cell kosong, jangan ditimpa saat update.
#[derive(Debug, Serialize, Deserialize)]
pub struct ImportServiceInput {
    pub name: String,
    pub price: Option<f64>,
    #[serde(default = "default_service_type")]
    pub service_type: String,
}

impl From<CreateServiceInput> for Service {
    fn from(input: CreateServiceInput) -> Self {
        Self {
            id: 0,
            name: input.name,
            price: input.price,
            service_type: input.service_type,
        }
    }
}

pub async fn get_services(pool: &DbPool, _active_only: bool) -> Result<Vec<Service>> {
    // Services don't have is_active column, return all
    let conn = pool.lock().await;
    let mut rows = conn.query("SELECT id, name, price, service_type FROM services ORDER BY name", ()).await?;
    let mut services = Vec::new();
    while let Some(row) = rows.next().await? {
        services.push(Service {
            id: row.get(0)?,
            name: row.get(1)?,
            price: row.get(2)?,
            service_type: row.get::<String>(3).unwrap_or_else(|_| "biasa".into()),
        });
    }
    Ok(services)
}

pub async fn search_services(pool: &DbPool, query: &str) -> Result<Vec<Service>> {
    let conn = pool.lock().await;
    let search_pattern = format!("%{}%", query);
    let mut rows = conn.query(
        "SELECT id, name, price, service_type FROM services WHERE name LIKE ? ORDER BY name",
        params![search_pattern],
    ).await?;
    let mut services = Vec::new();
    while let Some(row) = rows.next().await? {
        services.push(Service {
            id: row.get(0)?,
            name: row.get(1)?,
            price: row.get(2)?,
            service_type: row.get::<String>(3).unwrap_or_else(|_| "biasa".into()),
        });
    }
    Ok(services)
}

pub async fn create_service(pool: &DbPool, input: CreateServiceInput) -> Result<Service> {
    let conn = pool.lock().await;
    conn.execute("BEGIN IMMEDIATE TRANSACTION", ()).await?;
    let result = create_service_tx(&conn, &input).await;
    match result {
        Ok(service) => match conn.execute("COMMIT", ()).await {
            Ok(_) => Ok(service),
            Err(e) => {
                let _ = conn.execute("ROLLBACK", ()).await;
                Err(e.into())
            }
        },
        Err(e) => {
            let _ = conn.execute("ROLLBACK", ()).await;
            Err(e)
        }
    }
}

async fn create_service_tx(conn: &libsql::Connection, input: &CreateServiceInput) -> Result<Service> {
    if let Some(existing) = find_service_by_name(conn, &input.name).await? {
        return Ok(existing);
    }
    conn.execute(
        "INSERT INTO services (name, price, service_type) VALUES (?, ?, ?)",
        params![input.name.clone(), input.price, input.service_type.clone()],
    )
    .await?;
    let id = conn.last_insert_rowid();
    Ok(Service {
        id,
        name: input.name.clone(),
        price: input.price,
        service_type: input.service_type.clone(),
    })
}

async fn find_service_by_name(conn: &libsql::Connection, name: &str) -> Result<Option<Service>> {
    let mut rows = conn
        .query(
            "SELECT id, name, price, service_type FROM services WHERE lower(name) = lower(?) LIMIT 1",
            params![name],
        )
        .await?;
    if let Some(row) = rows.next().await? {
        Ok(Some(Service {
            id: row.get(0)?,
            name: row.get(1)?,
            price: row.get(2)?,
            service_type: row.get::<String>(3).unwrap_or_else(|_| "biasa".into()),
        }))
    } else {
        Ok(None)
    }
}

pub async fn update_service(pool: &DbPool, id: i64, name: Option<&str>, price: Option<f64>, service_type: Option<&str>) -> Result<Service> {
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
    if let Some(t) = service_type {
        updates.push("service_type = ?");
        params.push(t.to_string().into());
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
    let mut rows = conn.query("SELECT id, name, price, service_type FROM services WHERE id = ?", params![id]).await?;
    if let Some(row) = rows.next().await? {
        Ok(Service {
            id: row.get(0)?,
            name: row.get(1)?,
            price: row.get(2)?,
            service_type: row.get::<String>(3).unwrap_or_else(|_| "biasa".into()),
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

pub async fn import_services(pool: &DbPool, items: Vec<ImportServiceInput>) -> Result<(usize, usize)> {
    let conn = pool.lock().await;
    conn.execute("BEGIN IMMEDIATE TRANSACTION", ()).await?;
    let mut inserted = 0usize;
    let mut updated = 0usize;
    let mut result: Result<()> = Ok(());
    for item in items {
        match import_service_row(&conn, &item).await {
            Ok(true) => inserted += 1,
            Ok(false) => updated += 1,
            Err(e) => { result = Err(e); break; }
        }
    }
    match result {
        Ok(()) => {
            if let Err(e) = conn.execute("COMMIT", ()).await {
                let _ = conn.execute("ROLLBACK", ()).await;
                return Err(e.into());
            }
        }
        Err(e) => { let _ = conn.execute("ROLLBACK", ()).await; return Err(e); }
    }
    Ok((inserted, updated))
}

async fn import_service_row(conn: &libsql::Connection, item: &ImportServiceInput) -> Result<bool> {
    let mut rows = conn.query("SELECT id FROM services WHERE name = ?", params![item.name.clone()]).await?;
    match rows.next().await? {
        Some(row) => {
            let id: i64 = row.get(0)?;
            if let Some(price) = item.price {
                conn.execute("UPDATE services SET price = ? WHERE id = ?", params![price, id]).await?;
            }
            Ok(false)
        }
        None => {
            conn.execute("INSERT INTO services (name, price, service_type) VALUES (?, ?, ?)", params![item.name.clone(), item.price.unwrap_or(0.0), item.service_type.clone()]).await?;
            Ok(true)
        }
    }
}
