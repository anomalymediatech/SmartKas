use super::super::DbPool;
use libsql::{params, Connection};
use serde::{Deserialize, Serialize};
use anyhow::Result;
use chrono::Utc;

#[derive(Debug, Serialize, Deserialize)]
pub struct Transaction {
    pub id: i64,
    pub invoice_number: String,
    pub queue_number: Option<i32>,
    pub customer_name: Option<String>,
    pub vehicle_plate: String,
    pub mechanic_id: Option<i64>,
    pub cashier_name: String,
    pub subtotal: f64,
    pub discount: f64,
    pub total_amount: f64,
    pub paid_amount: f64,
    pub change_amount: f64,
    pub payment_method: String,
    pub status: String,
    pub transaction_date: String,
    pub mechanic_name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TransactionDetail {
    pub id: i64,
    pub transaction_id: i64,
    pub item_type: String,
    pub item_name: String,
    pub quantity: i32,
    pub unit_price: f64,
    pub total_price: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateTransactionInput {
    pub vehicle_plate: String,
    pub customer_name: Option<String>,
    pub queue_number: i32,
    pub mechanic_id: Option<i64>,
    pub cashier_name: String,
    pub subtotal: f64,
    pub discount: f64,
    pub total_amount: f64,
    pub paid_amount: f64,
    pub change_amount: f64,
    pub payment_method: String,
    pub details: Vec<CreateTransactionDetailInput>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateTransactionDetailInput {
    pub item_type: String,
    pub item_name: String,
    pub quantity: i32,
    pub unit_price: f64,
    pub total_price: f64,
    #[serde(default)]
    pub sparepart_id: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TransactionOutput {
    pub id: i64,
    pub invoice_number: String,
    pub transaction_date: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct HistoryFilters {
    pub date_from: Option<String>,
    pub date_to: Option<String>,
    pub search: Option<String>,
    pub page: i32,
    pub page_size: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResult<T> {
    pub data: Vec<T>,
    pub total: i64,
    pub page: i32,
    pub page_size: i32,
}

pub async fn create_transaction(pool: &DbPool, input: CreateTransactionInput) -> Result<TransactionOutput> {
    let conn = pool.lock().await;
    
    conn.execute("BEGIN IMMEDIATE TRANSACTION", ()).await?;

    let result = create_transaction_inner(&conn, input).await;
    match result {
        Ok(out) => {
            conn.execute("COMMIT", ()).await?;
            Ok(out)
        }
        Err(e) => {
            let _ = conn.execute("ROLLBACK", ()).await;
            Err(e)
        }
    }
}

async fn create_transaction_inner(conn: &Connection, input: CreateTransactionInput) -> Result<TransactionOutput> {
    // Generate invoice number
    let invoice_number = generate_invoice_number(conn).await?;
    
    // Insert transaction
    conn.execute(
        r#"INSERT INTO transactions 
            (invoice_number, queue_number, customer_name, vehicle_plate, mechanic_id, cashier_name, subtotal, discount, total_amount, paid_amount, change_amount, payment_method, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"#,
        params![
            invoice_number.clone(),
            input.queue_number,
            input.customer_name,
            input.vehicle_plate,
            input.mechanic_id,
            input.cashier_name,
            input.subtotal,
            input.discount,
            input.total_amount,
            input.paid_amount,
            input.change_amount,
            input.payment_method,
            "Lunas",
        ],
    ).await?;
    
    let transaction_id = conn.last_insert_rowid();
    
    // Insert transaction details and update stock for spareparts
    let mut layanan_items: Vec<(String, f64)> = Vec::new();
    for detail in input.details {
        conn.execute(
            r#"INSERT INTO transaction_details 
                (transaction_id, item_type, item_name, quantity, unit_price, total_price)
                VALUES (?, ?, ?, ?, ?, ?)"#,
            params![
                transaction_id,
                detail.item_type.clone(),
                detail.item_name.clone(),
                detail.quantity,
                detail.unit_price,
                detail.total_price,
            ],
        ).await?;
        
        // If service, track for commission recording
        if detail.item_type == "layanan" {
            layanan_items.push((detail.item_name.clone(), detail.total_price));
        }

        // If sparepart, update stock and record movement
        if detail.item_type == "sparepart" {
            let sparepart_id: Option<i64> = if let Some(id) = detail.sparepart_id {
                Some(id)
            } else {
                // Fallback: look up by name when sparepart_id is not provided
                let mut id_rows = conn.query(
                    "SELECT id FROM spareparts WHERE name = ?",
                    params![detail.item_name.clone()]
                ).await?;
                match id_rows.next().await? {
                    Some(row) => Some(row.get(0)?),
                    None => None,
                }
            };

            if let Some(sparepart_id) = sparepart_id {
                let mut rows = conn.query(
                    "SELECT stock FROM spareparts WHERE id = ?",
                    params![sparepart_id]
                ).await?;

                if let Some(row) = rows.next().await? {
                    let current_stock: i32 = row.get(0)?;
                    let new_stock = current_stock - detail.quantity;

                    if new_stock < 0 {
                        return Err(anyhow::anyhow!("Insufficient stock for {}", detail.item_name));
                    }

                    conn.execute(
                        "UPDATE spareparts SET stock = ? WHERE id = ?",
                        params![new_stock, sparepart_id],
                    ).await?;

                    // Record stock movement
                    conn.execute(
                        "INSERT INTO stock_movements (sparepart_id, movement_type, quantity, reference_type, reference_id, reason) VALUES (?, 'out', ?, 'transaction', ?, 'Transaksi penjualan')",
                        params![sparepart_id, detail.quantity, transaction_id],
                    ).await?;
                }
            }
        }
    }
    
    // Record mechanic commissions for layanan items
    if let Some(mechanic_id) = input.mechanic_id {
        if !layanan_items.is_empty() {
            let mut emp_rows = conn.query(
                "SELECT e.id, e.commission_rate FROM employees e JOIN mechanics m ON m.employee_id = e.id WHERE m.id = ?",
                params![mechanic_id],
            ).await?;
            if let Some(row) = emp_rows.next().await? {
                let employee_id: i64 = row.get(0)?;
                let rate: f64 = row.get(1)?;
                super::employees::record_commissions(conn, transaction_id, employee_id, &layanan_items, rate).await?;
            }
        }
    }

    Ok(TransactionOutput {
        id: transaction_id,
        invoice_number,
        transaction_date: Utc::now().to_rfc3339(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::init::SCHEMA_SQL;
    use std::sync::Arc;
    use tokio::sync::Mutex;

    async fn setup_pool() -> DbPool {
        let dir = std::env::temp_dir().join(format!("smartkas-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let db_url = format!("file:{}", dir.join("test.db").to_string_lossy());
        let db = libsql::Builder::new_local(db_url).build().await.unwrap();
        let conn = db.connect().unwrap();
        conn.execute_batch(SCHEMA_SQL).await.unwrap();
        conn.execute(
            "INSERT INTO spareparts (name, buy_price, sell_price, stock) VALUES ('Roller', 50000, 95000, 5)",
            (),
        ).await.unwrap();
        Arc::new(Mutex::new(conn))
    }

    fn sale_input() -> CreateTransactionInput {
        CreateTransactionInput {
            vehicle_plate: "B 1234 ABC".into(),
            customer_name: None,
            queue_number: 1,
            mechanic_id: None,
            cashier_name: "Admin".into(),
            subtotal: 125000.0,
            discount: 0.0,
            total_amount: 125000.0,
            paid_amount: 125000.0,
            change_amount: 0.0,
            payment_method: "Cash".into(),
            details: vec![
                CreateTransactionDetailInput {
                    item_type: "layanan".into(),
                    item_name: "Ganti Kampas Rem".into(),
                    quantity: 1,
                    unit_price: 30000.0,
                    total_price: 30000.0,
                    sparepart_id: None,
                },
                CreateTransactionDetailInput {
                    item_type: "sparepart".into(),
                    item_name: "Roller".into(),
                    quantity: 1,
                    unit_price: 95000.0,
                    total_price: 95000.0,
                    sparepart_id: Some(1),
                },
            ],
        }
    }

    async fn stock_of(pool: &DbPool) -> i32 {
        let conn = pool.lock().await;
        let mut rows = conn.query("SELECT stock FROM spareparts WHERE id = 1", ()).await.unwrap();
        rows.next().await.unwrap().unwrap().get(0).unwrap()
    }

    #[tokio::test]
    async fn void_restores_stock_and_marks_batal() {
        let pool = setup_pool().await;
        assert_eq!(stock_of(&pool).await, 5);

        let out = create_transaction(&pool, sale_input()).await.unwrap();
        assert_eq!(stock_of(&pool).await, 4);

        void_transaction(&pool, out.id).await.unwrap();
        assert_eq!(stock_of(&pool).await, 5);

        let conn = pool.lock().await;
        let mut rows = conn.query("SELECT status FROM transactions WHERE id = ?", params![out.id]).await.unwrap();
        let status: String = rows.next().await.unwrap().unwrap().get(0).unwrap();
        assert_eq!(status, "Batal");

        let mut rows = conn.query("SELECT COUNT(*) FROM stock_movements WHERE movement_type = 'void_restore'", ()).await.unwrap();
        let n: i64 = rows.next().await.unwrap().unwrap().get(0).unwrap();
        assert_eq!(n, 1);
    }

    #[tokio::test]
    async fn double_void_fails_and_keeps_stock() {
        let pool = setup_pool().await;
        let out = create_transaction(&pool, sale_input()).await.unwrap();
        void_transaction(&pool, out.id).await.unwrap();
        assert!(void_transaction(&pool, out.id).await.is_err());
        assert_eq!(stock_of(&pool).await, 5);
    }

    #[tokio::test]
    async fn insufficient_stock_rolls_back_everything() {
        let pool = setup_pool().await;
        let mut input = sale_input();
        input.details[1].quantity = 99;
        assert!(create_transaction(&pool, input).await.is_err());
        assert_eq!(stock_of(&pool).await, 5);
        let conn = pool.lock().await;
        let mut rows = conn.query("SELECT COUNT(*) FROM transactions", ()).await.unwrap();
        let n: i64 = rows.next().await.unwrap().unwrap().get(0).unwrap();
        assert_eq!(n, 0);
    }
}

async fn generate_invoice_number(conn: &Connection) -> Result<String> {
    let today = Utc::now().format("%Y%m%d").to_string();
    let mut rows = conn.query(
        "SELECT COUNT(*) FROM transactions WHERE date(transaction_date) = date('now')",
        (),
    ).await?;
    
    let count: i64 = if let Some(row) = rows.next().await? {
        row.get(0)?
    } else {
        0
    };
    
    Ok(format!("INV-{}-{:04}", today, count + 1))
}

pub async fn void_transaction(pool: &DbPool, transaction_id: i64) -> Result<()> {
    let conn = pool.lock().await;
    
    conn.execute("BEGIN IMMEDIATE TRANSACTION", ()).await?;

    let result = void_transaction_inner(&conn, transaction_id).await;
    match result {
        Ok(()) => {
            conn.execute("COMMIT", ()).await?;
            Ok(())
        }
        Err(e) => {
            let _ = conn.execute("ROLLBACK", ()).await;
            Err(e)
        }
    }
}

async fn void_transaction_inner(conn: &Connection, transaction_id: i64) -> Result<()> {
    // Collect sparepart lines first so we don't mutate while a cursor is open
    let mut sparepart_lines: Vec<(i64, i32)> = Vec::new();
    {
        let mut rows = conn.query(
            "SELECT item_type, item_name, quantity FROM transaction_details WHERE transaction_id = ?",
            params![transaction_id],
        ).await?;
        while let Some(row) = rows.next().await? {
            let item_type: String = row.get(0)?;
            let item_name: String = row.get(1)?;
            let quantity: i32 = row.get(2)?;
            if item_type == "sparepart" {
                let mut part_rows = conn.query(
                    "SELECT id FROM spareparts WHERE name = ?",
                    params![item_name],
                ).await?;
                if let Some(part_row) = part_rows.next().await? {
                    let sparepart_id: i64 = part_row.get(0)?;
                    sparepart_lines.push((sparepart_id, quantity));
                }
            }
        }
    }

    for (sparepart_id, quantity) in sparepart_lines {
        conn.execute(
            "UPDATE spareparts SET stock = stock + ? WHERE id = ?",
            params![quantity, sparepart_id],
        ).await?;

        conn.execute(
            "INSERT INTO stock_movements (sparepart_id, movement_type, quantity, reference_type, reference_id, reason) VALUES (?, 'void_restore', ?, 'void', ?, 'Pembatalan transaksi')",
            params![sparepart_id, quantity, transaction_id],
        ).await?;
    }


    // Update transaction status (guard against double-void)
    let updated = conn.execute(
        "UPDATE transactions SET status = 'Batal' WHERE id = ? AND status != 'Batal'",
        params![transaction_id],
    ).await?;
    if updated == 0 {
        return Err(anyhow::anyhow!("Transaksi tidak ditemukan atau sudah dibatalkan"));
    }

    Ok(())
}

pub async fn get_transactions(pool: &DbPool, filters: HistoryFilters) -> Result<SearchResult<Transaction>> {
    let conn = pool.lock().await;
    
    let mut where_clauses = Vec::new();
    let mut params_vec: Vec<libsql::Value> = Vec::new();
    
    if let Some(date_from) = &filters.date_from {
        where_clauses.push("date(transaction_date) >= date(?)");
        params_vec.push(date_from.clone().into());
    }
    if let Some(date_to) = &filters.date_to {
        where_clauses.push("date(transaction_date) <= date(?)");
        params_vec.push(date_to.clone().into());
    }
    if let Some(search) = &filters.search {
        where_clauses.push("(invoice_number LIKE ? OR customer_name LIKE ? OR vehicle_plate LIKE ?)");
        let pattern = format!("%{}%", search);
        params_vec.push(pattern.clone().into());
        params_vec.push(pattern.clone().into());
        params_vec.push(pattern.into());
    }
    
    let where_sql = if where_clauses.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", where_clauses.join(" AND "))
    };
    
    // Get total count
    let count_sql = format!("SELECT COUNT(*) FROM transactions {}", where_sql);
    let mut count_rows = conn.query(&count_sql, libsql::params_from_iter(params_vec.clone())).await?;
    let total: i64 = if let Some(row) = count_rows.next().await? {
        row.get(0)?
    } else {
        0
    };
    
    // Get paginated data
    let offset = (filters.page - 1) * filters.page_size;
    let data_sql = format!(
        "SELECT t.id, t.invoice_number, t.queue_number, t.customer_name, t.vehicle_plate, t.mechanic_id, t.cashier_name, t.subtotal, t.discount, t.total_amount, t.paid_amount, t.change_amount, t.payment_method, t.status, t.transaction_date, m.name as mechanic_name
        FROM transactions t
        LEFT JOIN mechanics m ON t.mechanic_id = m.id
        {} ORDER BY t.transaction_date DESC LIMIT ? OFFSET ?",
        where_sql
    );
    
    let mut data_params = params_vec;
    data_params.push(filters.page_size.into());
    data_params.push(offset.into());
    
    let mut rows = conn.query(&data_sql, libsql::params_from_iter(data_params)).await?;
    let mut transactions = Vec::new();
    
    while let Some(row) = rows.next().await? {
        transactions.push(Transaction {
            id: row.get(0)?,
            invoice_number: row.get(1)?,
            queue_number: row.get(2)?,
            customer_name: row.get(3)?,
            vehicle_plate: row.get(4)?,
            mechanic_id: row.get(5)?,
            cashier_name: row.get(6)?,
            subtotal: row.get(7)?,
            discount: row.get(8)?,
            total_amount: row.get(9)?,
            paid_amount: row.get(10)?,
            change_amount: row.get(11)?,
            payment_method: row.get(12)?,
            status: row.get(13)?,
            transaction_date: row.get(14)?,
            mechanic_name: row.get(15)?,
        });
    }
    
    Ok(SearchResult {
        data: transactions,
        total,
        page: filters.page,
        page_size: filters.page_size,
    })
}

pub async fn get_transaction_details(pool: &DbPool, transaction_id: i64) -> Result<Vec<TransactionDetail>> {
    let conn = pool.lock().await;
    let mut rows = conn.query(
        "SELECT id, transaction_id, item_type, item_name, quantity, unit_price, total_price FROM transaction_details WHERE transaction_id = ? ORDER BY id",
        params![transaction_id],
    ).await?;
    
    let mut details = Vec::new();
    while let Some(row) = rows.next().await? {
        details.push(TransactionDetail {
            id: row.get(0)?,
            transaction_id: row.get(1)?,
            item_type: row.get(2)?,
            item_name: row.get(3)?,
            quantity: row.get(4)?,
            unit_price: row.get(5)?,
            total_price: row.get(6)?,
        });
    }
    Ok(details)
}

pub async fn get_stock_movements(pool: &DbPool, sparepart_id: Option<i64>) -> Result<Vec<StockMovement>> {
    let conn = pool.lock().await;
    
    let (sql, params): (String, Vec<libsql::Value>) = if let Some(id) = sparepart_id {
        (
            "SELECT id, sparepart_id, movement_type, quantity, reference_type, reference_id, reason, created_at FROM stock_movements WHERE sparepart_id = ? ORDER BY created_at DESC LIMIT 100".to_string(),
            vec![id.into()],
        )
    } else {
        (
            "SELECT id, sparepart_id, movement_type, quantity, reference_type, reference_id, reason, created_at FROM stock_movements ORDER BY created_at DESC LIMIT 100".to_string(),
            vec![],
        )
    };
    
    let mut rows = conn.query(&sql, libsql::params_from_iter(params)).await?;
    let mut movements = Vec::new();
    
    while let Some(row) = rows.next().await? {
        movements.push(StockMovement {
            id: row.get(0)?,
            sparepart_id: row.get(1)?,
            movement_type: row.get(2)?,
            quantity: row.get(3)?,
            reference_type: row.get(4)?,
            reference_id: row.get(5)?,
            reason: row.get(6)?,
            created_at: row.get(7)?,
        });
    }
    Ok(movements)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StockMovement {
    pub id: i64,
    pub sparepart_id: i64,
    pub movement_type: String,
    pub quantity: i32,
    pub reference_type: Option<String>,
    pub reference_id: Option<i64>,
    pub reason: Option<String>,
    pub created_at: String,
}