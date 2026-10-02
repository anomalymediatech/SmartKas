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
    
    // Start transaction
    conn.execute("BEGIN IMMEDIATE TRANSACTION", ()).await?;
    
    // Generate invoice number
    let invoice_number = generate_invoice_number(&conn).await?;
    
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
                        conn.execute("ROLLBACK", ()).await?;
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
    
    conn.execute("COMMIT", ()).await?;
    
    Ok(TransactionOutput {
        id: transaction_id,
        invoice_number,
        transaction_date: Utc::now().to_rfc3339(),
    })
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
    
    // Get transaction details for spareparts
    let mut rows = conn.query(
        "SELECT item_type, item_name, quantity FROM transaction_details WHERE transaction_id = ?",
        params![transaction_id],
    ).await?;
    
    while let Some(row) = rows.next().await? {
        let item_type: String = row.get(0)?;
        let item_name: String = row.get(1)?;
        let quantity: i32 = row.get(2)?;
        
        if item_type == "sparepart" {
            // Get sparepart
            let mut part_rows = conn.query(
                "SELECT id, stock FROM spareparts WHERE name = ?",
                params![item_name],
            ).await?;
            
            if let Some(part_row) = part_rows.next().await? {
                let sparepart_id: i64 = part_row.get(0)?;
                let current_stock: i32 = part_row.get(1)?;
                let new_stock = current_stock + quantity;
                
                conn.execute(
                    "UPDATE spareparts SET stock = ? WHERE id = ?",
                    params![new_stock, sparepart_id],
                ).await?;
                
                // Record void restoration movement
                conn.execute(
                    "INSERT INTO stock_movements (sparepart_id, movement_type, quantity, reference_type, reference_id, reason) VALUES (?, 'void_restore', ?, 'void', ?, 'Pembatalan transaksi')",
                    params![sparepart_id, quantity, transaction_id],
                ).await?;
            }
        }
    }
    
    // Update transaction status
    conn.execute(
        "UPDATE transactions SET status = 'Batal' WHERE id = ?",
        params![transaction_id],
    ).await?;
    
    conn.execute("COMMIT", ()).await?;
    
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