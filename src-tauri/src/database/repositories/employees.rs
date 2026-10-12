use super::super::DbPool;
use libsql::params;
use serde::{Deserialize, Serialize};
use anyhow::Result;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Employee {
    pub id: i64,
    pub name: String,
    pub role: String,
    pub phone: Option<String>,
    pub base_salary: f64,
    pub daily_rate: f64,
    pub is_active: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateEmployeeInput {
    pub name: String,
    pub role: String,
    pub phone: Option<String>,
    pub base_salary: Option<f64>,
    pub daily_rate: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateEmployeeInput {
    pub id: i64,
    pub name: String,
    pub phone: Option<String>,
    pub base_salary: f64,
    pub daily_rate: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MechanicCommissionSummary {
    pub mechanic_id: i64,
    pub mechanic_name: String,
    pub services_count: i64,
    pub total_services: f64,
    pub total_commission: f64,
}


pub async fn get_employees(pool: &DbPool) -> Result<Vec<Employee>> {
    let conn = pool.lock().await;
    let mut rows = conn
        .query("SELECT id, name, role, phone, base_salary, daily_rate, is_active FROM employees ORDER BY name", ())
        .await?;
    let mut out = Vec::new();
    while let Some(row) = rows.next().await? {
        out.push(Employee {
            id: row.get(0)?,
            name: row.get(1)?,
            role: row.get(2)?,
            phone: row.get(3)?,
            base_salary: row.get(4)?,
            daily_rate: row.get(5)?,
            is_active: row.get(6)?,
        });
    }
    Ok(out)
}

pub async fn add_employee(pool: &DbPool, input: CreateEmployeeInput) -> Result<Employee> {
    let conn = pool.lock().await;
    let salary = input.base_salary.unwrap_or(0.0);
    let daily = input.daily_rate.unwrap_or(0.0);
    conn.execute(
        "INSERT INTO employees (name, role, phone, base_salary, daily_rate) VALUES (?, ?, ?, ?, ?)",
        params![input.name.clone(), input.role.clone(), input.phone.clone(), salary, daily],
    )
    .await?;
    let id = conn.last_insert_rowid();

    // Keep mechanics table in sync so POS dropdown picks up new mechanic/helper immediately
    if input.role == "mechanic" || input.role == "helper" {
        conn.execute(
            "INSERT INTO mechanics (name, is_active, employee_id) VALUES (?, 1, ?)",
            params![input.name.clone(), id],
        )
        .await?;
    }

    Ok(Employee {
        id,
        name: input.name,
        role: input.role,
        phone: input.phone,
        base_salary: salary,
        daily_rate: daily,
        is_active: 1,
    })
}

pub async fn update_employee(pool: &DbPool, input: UpdateEmployeeInput) -> Result<Employee> {
    let conn = pool.lock().await;
    let mut rows = conn
        .query("SELECT role, is_active FROM employees WHERE id = ?", params![input.id])
        .await?;
    let (role, is_active): (String, i64) = match rows.next().await? {
        Some(row) => (row.get(0)?, row.get(1)?),
        None => return Err(anyhow::anyhow!("Karyawan tidak ditemukan")),
    };
    drop(rows);

    conn.execute(
        "UPDATE employees SET name = ?, phone = ?, base_salary = ?, daily_rate = ? WHERE id = ?",
        params![input.name.clone(), input.phone.clone(), input.base_salary, input.daily_rate, input.id],
    )
    .await?;

    // Sync name to POS-facing mechanics table for mechanic/helper roles
    if role == "mechanic" || role == "helper" {
        let updated = conn.execute(
            "UPDATE mechanics SET name = ? WHERE employee_id = ?",
            params![input.name.clone(), input.id],
        )
        .await?;
        if updated == 0 {
            conn.execute(
                "INSERT INTO mechanics (name, is_active, employee_id) VALUES (?, ?, ?)",
                params![input.name.clone(), is_active, input.id],
            )
            .await?;
        }
    }

    Ok(Employee {
        id: input.id,
        name: input.name,
        role,
        phone: input.phone,
        base_salary: input.base_salary,
        daily_rate: input.daily_rate,
        is_active,
    })
}

pub async fn delete_employee(pool: &DbPool, id: i64) -> Result<()> {
    let conn = pool.lock().await;
    // Soft delete keeps historical transaction references intact
    conn.execute("UPDATE employees SET is_active = 0 WHERE id = ?", params![id]).await?;
    conn.execute("UPDATE mechanics SET is_active = 0 WHERE employee_id = ?", params![id]).await?;
    Ok(())
}

pub async fn calculate_mechanic_commission(
    pool: &DbPool,
    date_from: Option<&str>,
    date_to: Option<&str>,
) -> Result<Vec<MechanicCommissionSummary>> {
    let conn = pool.lock().await;
    let (date_filter, values) = super::date_range_filter("t", date_from, date_to);
    let sql = format!(
        r#"SELECT e.id, e.name, COUNT(td.id), COALESCE(SUM(td.total_price), 0.0)
            FROM employees e
            JOIN mechanics m ON m.employee_id = e.id
            JOIN transactions t ON t.mechanic_id = m.id AND t.status = 'Lunas'
            JOIN transaction_details td ON td.transaction_id = t.id AND td.item_type = 'layanan'
            WHERE e.role = 'mechanic'{}
            GROUP BY e.id, e.name ORDER BY e.name"#,
        date_filter
    );

    let mut rows = conn.query(&sql, libsql::params_from_iter(values)).await?;
    let mut out = Vec::new();
    while let Some(row) = rows.next().await? {
        out.push(MechanicCommissionSummary {
            mechanic_id: row.get(0)?,
            mechanic_name: row.get(1)?,
            services_count: row.get(2)?,
            total_services: row.get(3)?,
            total_commission: 0.0,
        });
    }
    Ok(out)
}

pub async fn record_commissions(
    conn: &libsql::Connection,
    transaction_id: i64,
    mechanic_employee_id: i64,
    layanan_items: &[(String, f64)],
    rate: f64,
) -> Result<()> {
    for (name, price) in layanan_items {
        conn.execute(
            "INSERT INTO mechanic_commissions (transaction_id, mechanic_id, service_name, commission_amount) VALUES (?, ?, ?, ?)",
            params![transaction_id, mechanic_employee_id, name.clone(), price * rate / 100.0],
        )
        .await?;
    }
    Ok(())
}


#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::init::SCHEMA_SQL;
    use crate::database::repositories::transactions::{create_transaction, CreateTransactionDetailInput, CreateTransactionInput};
    use std::sync::Arc;
    use tokio::sync::Mutex;

    async fn setup() -> DbPool {
        let dir = std::env::temp_dir().join(format!("smartkas-emp-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let db_url = format!("file:{}", dir.join("test.db").to_string_lossy());
        let db = libsql::Builder::new_local(db_url).build().await.unwrap();
        let conn = db.connect().unwrap();
        conn.execute_batch(SCHEMA_SQL).await.unwrap();
        Arc::new(Mutex::new(conn))
    }

    #[tokio::test]
    async fn add_mechanic_syncs_to_mechanics_table() {
        let pool = setup().await;
        add_employee(&pool, CreateEmployeeInput {
            name: "Budi".into(),
            role: "mechanic".into(),
            phone: None,
            base_salary: None,
            daily_rate: None,
        }).await.unwrap();

        let conn = pool.lock().await;
        let mut rows = conn.query("SELECT m.name, m.employee_id FROM mechanics m", ()).await.unwrap();
        let row = rows.next().await.unwrap().unwrap();
        assert_eq!(row.get::<String>(0).unwrap(), "Budi");
        assert!(row.get::<Option<i64>>(1).unwrap().is_some());
    }

    #[tokio::test]
    async fn mechanic_commission_is_zero_without_manual_override() {
        let pool = setup().await;
        add_employee(&pool, CreateEmployeeInput {
            name: "Budi".into(),
            role: "mechanic".into(),
            phone: None,
            base_salary: None,
            daily_rate: None,
        }).await.unwrap();

        let conn = pool.lock().await;
        let mut rows = conn.query("SELECT id FROM mechanics LIMIT 1", ()).await.unwrap();
        let mech_id: i64 = rows.next().await.unwrap().unwrap().get(0).unwrap();
        drop(rows);
        drop(conn);

        create_transaction(&pool, CreateTransactionInput {
            vehicle_plate: "B 1".into(),
            customer_name: None,
            queue_number: 1,
            mechanic_id: Some(mech_id),
            cashier_name: "Admin".into(),
            subtotal: 50000.0,
            discount: 0.0,
            total_amount: 50000.0,
            paid_amount: 50000.0,
            change_amount: 0.0,
            payment_method: "Cash".into(),
            details: vec![
                CreateTransactionDetailInput { item_type: "layanan".into(), item_name: "Tune Up".into(), quantity: 1, unit_price: 50000.0, total_price: 50000.0, sparepart_id: None, service_type: None },
            ],
        }).await.unwrap();

        let summaries = calculate_mechanic_commission(&pool, None, None).await.unwrap();
        // Commission calculation removed - total_commission should be 0
        assert_eq!(summaries.len(), 1);
        assert!((summaries[0].total_commission - 0.0).abs() < 0.01);

        // Audit table should be empty since commission not recorded
        let conn = pool.lock().await;
        let mut rows = conn.query("SELECT commission_amount FROM mechanic_commissions", ()).await.unwrap();
        let rows_count = rows.next().await.unwrap();
        let amt: Option<f64> = rows_count.as_ref().and_then(|r| r.get(0).ok());
        assert_eq!(amt, None);
    }

    #[tokio::test]
    async fn delete_employee_soft_deletes_and_keeps_history() {
        let pool = setup().await;
        let emp = add_employee(&pool, CreateEmployeeInput {
            name: "Budi".into(),
            role: "mechanic".into(),
            phone: None,
            base_salary: None,
            daily_rate: None,
        }).await.unwrap();
        delete_employee(&pool, emp.id).await.unwrap();

        let employees = get_employees(&pool).await.unwrap();
        assert_eq!(employees[0].is_active, 0);

        let conn = pool.lock().await;
        let mut rows = conn.query("SELECT is_active FROM mechanics", ()).await.unwrap();
        let active: i64 = rows.next().await.unwrap().unwrap().get(0).unwrap();
        assert_eq!(active, 0);
    }

    #[tokio::test]
    async fn update_employee_edits_rates_and_syncs_pos_name() {
        let pool = setup().await;
        let emp = add_employee(&pool, CreateEmployeeInput {
            name: "Budi".into(),
            role: "mechanic".into(),
            phone: None,
            base_salary: Some(1_500_000.0),
            daily_rate: None,
        }).await.unwrap();

        let updated = update_employee(&pool, UpdateEmployeeInput {
            id: emp.id,
            name: "Budi Santoso".into(),
            phone: Some("0812".into()),
            base_salary: 1_600_000.0,
            daily_rate: 0.0,
        }).await.unwrap();

        assert_eq!(updated.name, "Budi Santoso");
        assert!((updated.base_salary - 1_600_000.0).abs() < 0.01);

        let employees = get_employees(&pool).await.unwrap();
        assert_eq!(employees.len(), 1);
        assert_eq!(employees[0].name, "Budi Santoso");
        assert_eq!(employees[0].phone.as_deref(), Some("0812"));

        // POS-facing name stays in sync
        let conn = pool.lock().await;
        let mut rows = conn.query("SELECT name FROM mechanics", ()).await.unwrap();
        assert_eq!(rows.next().await.unwrap().unwrap().get::<String>(0).unwrap(), "Budi Santoso");
    }

    #[tokio::test]
    async fn helper_is_added_to_pos_without_commission() {
        let pool = setup().await;
        let emp = add_employee(&pool, CreateEmployeeInput {
            name: "Asisten".into(),
            role: "helper".into(),
            phone: None,
            base_salary: None,
            daily_rate: Some(100_000.0),
        }).await.unwrap();

        // Helper appears in the POS mechanics table
        let conn = pool.lock().await;
        let mut rows = conn.query("SELECT employee_id FROM mechanics WHERE name = 'Asisten'", ()).await.unwrap();
        assert_eq!(rows.next().await.unwrap().unwrap().get::<Option<i64>>(0).unwrap(), Some(emp.id));
        drop(conn);

        // ...but a transaction against them records no commission
        let pool2 = pool.clone();
        let conn2 = pool2.lock().await;
        let mut rows = conn2.query("SELECT id FROM mechanics WHERE name = 'Asisten'", ()).await.unwrap();
        let mech_id: i64 = rows.next().await.unwrap().unwrap().get(0).unwrap();
        drop(rows);
        drop(conn2);

        crate::database::repositories::transactions::create_transaction(&pool, crate::database::repositories::transactions::CreateTransactionInput {
            vehicle_plate: "B 9".into(),
            customer_name: None,
            queue_number: 1,
            mechanic_id: Some(mech_id),
            cashier_name: "Admin".into(),
            subtotal: 100_000.0,
            discount: 0.0,
            total_amount: 100_000.0,
            paid_amount: 100_000.0,
            change_amount: 0.0,
            payment_method: "Cash".into(),
            details: vec![crate::database::repositories::transactions::CreateTransactionDetailInput {
                item_type: "layanan".into(),
                item_name: "Cuci".into(),
                quantity: 1,
                unit_price: 100_000.0,
                total_price: 100_000.0,
                sparepart_id: None,
                service_type: None,
            }],
        }).await.unwrap();

        let conn = pool.lock().await;
        let mut rows = conn.query("SELECT COUNT(*) FROM mechanic_commissions", ()).await.unwrap();
        assert_eq!(rows.next().await.unwrap().unwrap().get::<i64>(0).unwrap(), 0);
    }
}
