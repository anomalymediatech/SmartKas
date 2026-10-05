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
    pub commission_rate: f64,
    pub base_salary: f64,
    pub is_active: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateEmployeeInput {
    pub name: String,
    pub role: String,
    pub phone: Option<String>,
    pub commission_rate: Option<f64>,
    pub base_salary: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MechanicCommissionSummary {
    pub mechanic_id: i64,
    pub mechanic_name: String,
    pub services_count: i64,
    pub total_services: f64,
    pub total_commission: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CommissionLine {
    pub service_name: String,
    pub invoice_number: String,
    pub transaction_date: String,
    pub price: f64,
    pub commission: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MechanicMonthlySummary {
    pub mechanic_id: i64,
    pub mechanic_name: String,
    pub services_count: i64,
    pub total_services: f64,
    pub total_commission: f64,
    pub lines: Vec<CommissionLine>,
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
            commission_rate: Some(10.0),
            base_salary: None,
        }).await.unwrap();

        let conn = pool.lock().await;
        let mut rows = conn.query("SELECT m.name, m.employee_id FROM mechanics m", ()).await.unwrap();
        let row = rows.next().await.unwrap().unwrap();
        assert_eq!(row.get::<String>(0).unwrap(), "Budi");
        assert!(row.get::<Option<i64>>(1).unwrap().is_some());
    }

    #[tokio::test]
    async fn commission_is_10_percent_of_layanan() {
        let pool = setup().await;
        add_employee(&pool, CreateEmployeeInput {
            name: "Budi".into(),
            role: "mechanic".into(),
            phone: None,
            commission_rate: Some(10.0),
            base_salary: None,
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
                CreateTransactionDetailInput { item_type: "layanan".into(), item_name: "Tune Up".into(), quantity: 1, unit_price: 50000.0, total_price: 50000.0, sparepart_id: None },
            ],
        }).await.unwrap();

        let summaries = calculate_mechanic_commission(&pool, None, None).await.unwrap();
        assert_eq!(summaries.len(), 1);
        assert!((summaries[0].total_commission - 5000.0).abs() < 0.01);

        let month = chrono::Utc::now().format("%m").to_string().parse::<i32>().unwrap();
        let year = chrono::Utc::now().format("%Y").to_string().parse::<i32>().unwrap();
        let employees = get_employees(&pool).await.unwrap();
        let monthly = get_mechanic_monthly_summary(&pool, employees[0].id, month, year).await.unwrap();
        assert_eq!(monthly.services_count, 1);
        assert!((monthly.total_commission - 5000.0).abs() < 0.01);

        // Audit table recorded
        let conn = pool.lock().await;
        let mut rows = conn.query("SELECT commission_amount FROM mechanic_commissions", ()).await.unwrap();
        let amt: f64 = rows.next().await.unwrap().unwrap().get(0).unwrap();
        assert!((amt - 5000.0).abs() < 0.01);
    }

    #[tokio::test]
    async fn delete_employee_soft_deletes_and_keeps_history() {
        let pool = setup().await;
        let emp = add_employee(&pool, CreateEmployeeInput {
            name: "Budi".into(),
            role: "mechanic".into(),
            phone: None,
            commission_rate: Some(10.0),
            base_salary: None,
        }).await.unwrap();
        delete_employee(&pool, emp.id).await.unwrap();

        let employees = get_employees(&pool).await.unwrap();
        assert_eq!(employees[0].is_active, 0);

        let conn = pool.lock().await;
        let mut rows = conn.query("SELECT is_active FROM mechanics", ()).await.unwrap();
        let active: i64 = rows.next().await.unwrap().unwrap().get(0).unwrap();
        assert_eq!(active, 0);
    }
}

pub async fn get_employees(pool: &DbPool) -> Result<Vec<Employee>> {
    let conn = pool.lock().await;
    let mut rows = conn
        .query("SELECT id, name, role, phone, commission_rate, base_salary, is_active FROM employees ORDER BY name", ())
        .await?;
    let mut out = Vec::new();
    while let Some(row) = rows.next().await? {
        out.push(Employee {
            id: row.get(0)?,
            name: row.get(1)?,
            role: row.get(2)?,
            phone: row.get(3)?,
            commission_rate: row.get(4)?,
            base_salary: row.get(5)?,
            is_active: row.get(6)?,
        });
    }
    Ok(out)
}

pub async fn add_employee(pool: &DbPool, input: CreateEmployeeInput) -> Result<Employee> {
    let conn = pool.lock().await;
    let rate = input.commission_rate.unwrap_or(0.0);
    let salary = input.base_salary.unwrap_or(0.0);
    conn.execute(
        "INSERT INTO employees (name, role, phone, commission_rate, base_salary) VALUES (?, ?, ?, ?, ?)",
        params![input.name.clone(), input.role.clone(), input.phone.clone(), rate, salary],
    )
    .await?;
    let id = conn.last_insert_rowid();

    // Keep mechanics table in sync so POS dropdown picks up new mechanic immediately
    if input.role == "mechanic" {
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
        commission_rate: rate,
        base_salary: salary,
        is_active: 1,
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
    let mut sql = String::from(
        r#"SELECT e.id, e.name, COUNT(td.id), COALESCE(SUM(td.total_price), 0),
                  COALESCE(SUM(td.total_price * e.commission_rate / 100.0), 0)
           FROM employees e
           JOIN mechanics m ON m.employee_id = e.id
           JOIN transactions t ON t.mechanic_id = m.id AND t.status = 'Lunas'
           JOIN transaction_details td ON td.transaction_id = t.id AND td.item_type = 'layanan'
           WHERE e.role = 'mechanic'"#,
    );
    let mut values: Vec<libsql::Value> = Vec::new();
    if let Some(f) = date_from {
        sql.push_str(" AND date(t.transaction_date, 'localtime') >= date(?)");
        values.push(f.into());
    }
    if let Some(t) = date_to {
        sql.push_str(" AND date(t.transaction_date, 'localtime') <= date(?)");
        values.push(t.into());
    }
    sql.push_str(" GROUP BY e.id, e.name ORDER BY e.name");

    let mut rows = conn.query(&sql, libsql::params_from_iter(values)).await?;
    let mut out = Vec::new();
    while let Some(row) = rows.next().await? {
        out.push(MechanicCommissionSummary {
            mechanic_id: row.get(0)?,
            mechanic_name: row.get(1)?,
            services_count: row.get(2)?,
            total_services: row.get(3)?,
            total_commission: row.get(4)?,
        });
    }
    Ok(out)
}

pub async fn get_mechanic_monthly_summary(
    pool: &DbPool,
    employee_id: i64,
    month: i32,
    year: i32,
) -> Result<MechanicMonthlySummary> {
    let conn = pool.lock().await;

    let mut emp_rows = conn
        .query("SELECT name, commission_rate FROM employees WHERE id = ?", params![employee_id])
        .await?;
    let (name, rate): (String, f64) = if let Some(row) = emp_rows.next().await? {
        (row.get(0)?, row.get(1)?)
    } else {
        return Err(anyhow::anyhow!("Employee tidak ditemukan"));
    };

    let mut rows = conn
        .query(
            r#"SELECT td.item_name, t.invoice_number, t.transaction_date, td.total_price
               FROM transaction_details td
               JOIN transactions t ON t.id = td.transaction_id
               JOIN mechanics m ON m.id = t.mechanic_id
               WHERE m.employee_id = ? AND td.item_type = 'layanan' AND t.status = 'Lunas'
                 AND strftime('%m', t.transaction_date, 'localtime') = printf('%02d', ?)
                 AND strftime('%Y', t.transaction_date, 'localtime') = ?
               ORDER BY t.transaction_date DESC"#,
            params![employee_id, month, year.to_string()],
        )
        .await?;

    let mut lines = Vec::new();
    let mut total_services = 0.0;
    while let Some(row) = rows.next().await? {
        let service_name: String = row.get(0)?;
        let price: f64 = row.get(3)?;
        total_services += price;
        lines.push(CommissionLine {
            service_name,
            invoice_number: row.get(1)?,
            transaction_date: row.get(2)?,
            price,
            commission: price * rate / 100.0,
        });
    }

    let services_count = lines.len() as i64;
    let total_commission = lines.iter().map(|l| l.commission).sum();

    Ok(MechanicMonthlySummary {
        mechanic_id: employee_id,
        mechanic_name: name,
        services_count,
        total_services,
        total_commission,
        lines,
    })
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
