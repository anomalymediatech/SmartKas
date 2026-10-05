use super::super::DbPool;
use libsql::params;
use serde::{Deserialize, Serialize};
use anyhow::Result;

#[derive(Debug, Serialize, Deserialize)]
pub struct HistoryItem {
    pub item_type: String,
    pub item_name: String,
    pub quantity: i32,
    pub unit_price: f64,
    pub total_price: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VehicleVisit {
    pub id: i64,
    pub invoice_number: String,
    pub transaction_date: String,
    pub mechanic_name: Option<String>,
    pub customer_name: Option<String>,
    pub total_amount: f64,
    pub status: String,
    pub items: Vec<HistoryItem>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VehicleReminder {
    pub months_since_service: i64,
    pub last_service_name: String,
    pub last_service_date: String,
    pub recommended_service: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpcomingReminder {
    pub vehicle_plate: String,
    pub customer_name: Option<String>,
    pub months_since_service: i64,
    pub last_service_name: String,
    pub recommended_service: String,
}

pub async fn get_vehicle_history(pool: &DbPool, plate_number: &str) -> Result<Vec<VehicleVisit>> {
    let conn = pool.lock().await;
    let mut rows = conn
        .query(
            r#"SELECT t.id, t.invoice_number, t.transaction_date, m.name, t.customer_name, t.total_amount, t.status
               FROM transactions t
               LEFT JOIN mechanics m ON m.id = t.mechanic_id
               WHERE UPPER(t.vehicle_plate) = UPPER(?)
               ORDER BY t.transaction_date DESC"#,
            params![plate_number.trim()],
        )
        .await?;

    let mut visits: Vec<VehicleVisit> = Vec::new();
    while let Some(row) = rows.next().await? {
        visits.push(VehicleVisit {
            id: row.get(0)?,
            invoice_number: row.get(1)?,
            transaction_date: row.get(2)?,
            mechanic_name: row.get(3)?,
            customer_name: row.get(4)?,
            total_amount: row.get(5)?,
            status: row.get(6)?,
            items: Vec::new(),
        });
    }

    for visit in visits.iter_mut() {
        let mut items_rows = conn
            .query(
                "SELECT item_type, item_name, quantity, unit_price, total_price FROM transaction_details WHERE transaction_id = ? ORDER BY id",
                params![visit.id],
            )
            .await?;
        while let Some(row) = items_rows.next().await? {
            visit.items.push(HistoryItem {
                item_type: row.get(0)?,
                item_name: row.get(1)?,
                quantity: row.get(2)?,
                unit_price: row.get(3)?,
                total_price: row.get(4)?,
            });
        }
    }

    Ok(visits)
}

fn recommended_for(last_service_name: &str, has_oil_change: bool) -> String {
    let lower = last_service_name.to_lowercase();
    if lower.contains("oli") {
        "Tune-Up / Pembersihan Karburator".to_string()
    } else if has_oil_change {
        "Ganti Oli Mesin".to_string()
    } else {
        "Ganti Oli Mesin & Cek Rem".to_string()
    }
}

pub async fn get_vehicle_reminder(pool: &DbPool, plate_number: &str) -> Result<Option<VehicleReminder>> {
    let conn = pool.lock().await;
    let mut rows = conn
        .query(
            r#"SELECT td.item_name, t.transaction_date
               FROM transaction_details td
               JOIN transactions t ON t.id = td.transaction_id
               WHERE t.status = 'Lunas' AND td.item_type = 'layanan' AND UPPER(t.vehicle_plate) = UPPER(?)
               ORDER BY t.transaction_date DESC LIMIT 1"#,
            params![plate_number.trim()],
        )
        .await?;

    if let Some(row) = rows.next().await? {
        let last_name: String = row.get(0)?;
        let last_date: String = row.get(1)?;

        let mut orows = conn
            .query(
                r#"SELECT COUNT(*) FROM transaction_details td
                   JOIN transactions t ON t.id = td.transaction_id
                   WHERE t.status = 'Lunas' AND td.item_type = 'layanan' AND UPPER(t.vehicle_plate) = UPPER(?) AND lower(td.item_name) LIKE '%oli%'"#,
                params![plate_number.trim()],
            )
            .await?;
        let oil_count: i64 = if let Some(r) = orows.next().await? { r.get(0)? } else { 0 };

        let age_days = service_age_days(&last_date);
        let months = age_days / 30;
        if age_days > 90 || months >= 3 {
            return Ok(Some(VehicleReminder {
                months_since_service: months.max(1),
                last_service_name: last_name.clone(),
                last_service_date: last_date,
                recommended_service: recommended_for(&last_name, oil_count > 0),
            }));
        }
    }
    Ok(None)
}

fn service_age_days(date_str: &str) -> i64 {
    let parsed = chrono::NaiveDateTime::parse_from_str(date_str, "%Y-%m-%d %H:%M:%S")
        .or_else(|_| chrono::NaiveDateTime::parse_from_str(date_str, "%Y-%m-%dT%H:%M:%S"))
        .or_else(|_| chrono::NaiveDateTime::parse_from_str(&format!("{} 00:00:00", &date_str[..10.min(date_str.len())]), "%Y-%m-%d %H:%M:%S"));
    match parsed {
        Ok(dt) => (chrono::Utc::now().naive_utc() - dt).num_days(),
        Err(_) => 0,
    }
}

pub async fn get_upcoming_reminders(pool: &DbPool) -> Result<Vec<UpcomingReminder>> {
    let conn = pool.lock().await;
    let mut rows = conn
        .query(
            r#"SELECT vehicle_plate, MAX(customer_name) FROM transactions WHERE status = 'Lunas' GROUP BY vehicle_plate ORDER BY MAX(transaction_date) DESC LIMIT 200"#,
            (),
        )
        .await?;

    let mut plates: Vec<(String, Option<String>)> = Vec::new();
    while let Some(row) = rows.next().await? {
        plates.push((row.get(0)?, row.get(1)?));
    }
    drop(rows);
    drop(conn);

    let mut out = Vec::new();
    for (plate, customer) in plates {
        if let Ok(Some(rem)) = get_vehicle_reminder(pool, &plate).await {
            out.push(UpcomingReminder {
                vehicle_plate: plate,
                customer_name: customer,
                months_since_service: rem.months_since_service,
                last_service_name: rem.last_service_name,
                recommended_service: rem.recommended_service,
            });
        }
    }
    Ok(out)
}


pub async fn search_vehicle_plates(pool: &DbPool, query: &str) -> Result<Vec<String>> {
    let conn = pool.lock().await;
    let mut rows = conn
        .query(
            "SELECT DISTINCT vehicle_plate FROM transactions WHERE UPPER(vehicle_plate) LIKE UPPER(?) ORDER BY vehicle_plate LIMIT 10",
            params![format!("%{}%", query.trim())],
        )
        .await?;
    let mut out = Vec::new();
    while let Some(row) = rows.next().await? {
        out.push(row.get(0)?);
    }
    Ok(out)
}


#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::init::SCHEMA_SQL;
    use std::sync::Arc;
    use tokio::sync::Mutex;

    async fn setup() -> DbPool {
        let dir = std::env::temp_dir().join(format!("smartkas-veh-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let db_url = format!("file:{}", dir.join("test.db").to_string_lossy());
        let db = libsql::Builder::new_local(db_url).build().await.unwrap();
        let conn = db.connect().unwrap();
        conn.execute_batch(SCHEMA_SQL).await.unwrap();
        conn.execute("INSERT INTO mechanics (name) VALUES ('Budi')", ()).await.unwrap();

        // Old visit: 120 days ago, oil change
        conn.execute(
            "INSERT INTO transactions (invoice_number, vehicle_plate, customer_name, mechanic_id, cashier_name, subtotal, discount, total_amount, paid_amount, change_amount, payment_method, status, transaction_date) VALUES ('INV-OLD','B 1234 ABC','Pak Andi',1,'Admin',55000,0,55000,55000,0,'Cash','Lunas', datetime('now','-120 days'))",
            (),
        ).await.unwrap();
        conn.execute("INSERT INTO transaction_details (transaction_id, item_type, item_name, quantity, unit_price, total_price) VALUES (1,'layanan','Ganti Oli Mesin',1,50000,50000)", ()).await.unwrap();

        // Recent visit: 10 days ago, tune up only... actually today a service
        conn.execute(
            "INSERT INTO transactions (invoice_number, vehicle_plate, customer_name, mechanic_id, cashier_name, subtotal, discount, total_amount, paid_amount, change_amount, payment_method, status, transaction_date) VALUES ('INV-NEW','B 1234 ABC','Pak Andi',1,'Admin',150000,0,150000,150000,0,'Cash','Lunas', datetime('now','-10 days'))",
            (),
        ).await.unwrap();
        conn.execute("INSERT INTO transaction_details (transaction_id, item_type, item_name, quantity, unit_price, total_price) VALUES (2,'layanan','Tune Up',1,150000,150000)", ()).await.unwrap();

        // Another vehicle
        conn.execute(
            "INSERT INTO transactions (invoice_number, vehicle_plate, customer_name, mechanic_id, cashier_name, subtotal, discount, total_amount, paid_amount, change_amount, payment_method, status) VALUES ('INV-X','D 9999 XY','Bu Sari',1,'Admin',30000,0,30000,30000,0,'Cash','Lunas')",
            (),
        ).await.unwrap();

        Arc::new(Mutex::new(conn))
    }

    #[tokio::test]
    async fn history_returns_visits_desc_with_items() {
        let pool = setup().await;
        let visits = get_vehicle_history(&pool, "b 1234 abc").await.unwrap();
        assert_eq!(visits.len(), 2);
        assert!(visits[0].transaction_date > visits[1].transaction_date);
        assert_eq!(visits[0].items.len(), 1);
        assert_eq!(visits[0].items[0].item_name, "Tune Up");
        assert_eq!(visits[0].mechanic_name.as_deref(), Some("Budi"));
    }

    #[tokio::test]
    async fn history_empty_for_unknown_plate() {
        let pool = setup().await;
        let visits = get_vehicle_history(&pool, "Z 0000 ZZ").await.unwrap();
        assert!(visits.is_empty());
    }

    #[tokio::test]
    async fn reminder_triggered_for_old_service() {
        let pool = setup().await;
        // last service for B 1234 ABC was 10 days ago -> no reminder
        assert!(get_vehicle_reminder(&pool, "B 1234 ABC").await.unwrap().is_none());

        // vehicle whose last service is old -> reminder
        let conn = pool.lock().await;
        conn.execute(
            "INSERT INTO transactions (invoice_number, vehicle_plate, mechanic_id, cashier_name, subtotal, discount, total_amount, paid_amount, change_amount, payment_method, status, transaction_date) VALUES ('INV-OLD2','F 7777 FF',1,'Admin',50000,0,50000,50000,0,'Cash','Lunas', datetime('now','-150 days'))",
            (),
        ).await.unwrap();
        conn.execute("INSERT INTO transaction_details (transaction_id, item_type, item_name, quantity, unit_price, total_price) VALUES (4,'layanan','Ganti Oli Mesin',1,50000,50000)", ()).await.unwrap();
        drop(conn);

        let rem = get_vehicle_reminder(&pool, "F 7777 FF").await.unwrap();
        assert!(rem.is_some());
        let rem = rem.unwrap();
        assert!(rem.months_since_service >= 4);
        assert!(rem.recommended_service.contains("Tune-Up"));
    }

    #[tokio::test]
    async fn upcoming_reminders_finds_overdue_vehicle() {
        let pool = setup().await;
        let conn = pool.lock().await;
        conn.execute(
            "INSERT INTO transactions (invoice_number, vehicle_plate, mechanic_id, cashier_name, subtotal, discount, total_amount, paid_amount, change_amount, payment_method, status, transaction_date) VALUES ('INV-OLD3','F 7777 FF',1,'Admin',50000,0,50000,50000,0,'Cash','Lunas', datetime('now','-200 days'))",
            (),
        ).await.unwrap();
        conn.execute("INSERT INTO transaction_details (transaction_id, item_type, item_name, quantity, unit_price, total_price) VALUES (4,'layanan','Tune Up',1,50000,50000)", ()).await.unwrap();
        drop(conn);

        let reminders = get_upcoming_reminders(&pool).await.unwrap();
        assert!(reminders.iter().any(|r| r.vehicle_plate == "F 7777 FF"));
    }

    #[tokio::test]
    async fn search_plates_matches_partial() {
        let pool = setup().await;
        let plates = search_vehicle_plates(&pool, "B 12").await.unwrap();
        assert_eq!(plates, vec!["B 1234 ABC".to_string()]);
    }
}
