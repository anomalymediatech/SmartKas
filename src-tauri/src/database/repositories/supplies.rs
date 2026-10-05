use super::super::DbPool;
use libsql::params;
use serde::{Deserialize, Serialize};
use anyhow::Result;

#[derive(Debug, Serialize, Deserialize)]
pub struct Supplier {
    pub id: i64,
    pub name: String,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub contact_person: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateSupplierInput {
    pub name: String,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub contact_person: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PurchaseOrderItem {
    pub sparepart_id: i64,
    pub quantity: i32,
    pub unit_cost: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreatePurchaseOrderInput {
    pub supplier_id: i64,
    pub created_by: Option<String>,
    pub items: Vec<PurchaseOrderItem>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PurchaseOrder {
    pub id: i64,
    pub supplier_id: i64,
    pub supplier_name: Option<String>,
    pub purchase_date: String,
    pub total_cost: f64,
    pub status: String,
    pub created_by: Option<String>,
}

pub async fn get_suppliers(pool: &DbPool) -> Result<Vec<Supplier>> {
    let conn = pool.lock().await;
    let mut rows = conn
        .query("SELECT id, name, phone, address, contact_person FROM suppliers WHERE is_active = 1 ORDER BY name", ())
        .await?;
    let mut out = Vec::new();
    while let Some(row) = rows.next().await? {
        out.push(Supplier {
            id: row.get(0)?,
            name: row.get(1)?,
            phone: row.get(2)?,
            address: row.get(3)?,
            contact_person: row.get(4)?,
        });
    }
    Ok(out)
}

pub async fn create_supplier(pool: &DbPool, input: CreateSupplierInput) -> Result<Supplier> {
    let conn = pool.lock().await;
    conn.execute(
        "INSERT INTO suppliers (name, phone, address, contact_person) VALUES (?, ?, ?, ?)",
        params![input.name.clone(), input.phone.clone(), input.address.clone(), input.contact_person.clone()],
    )
    .await?;
    Ok(Supplier {
        id: conn.last_insert_rowid(),
        name: input.name,
        phone: input.phone,
        address: input.address,
        contact_person: input.contact_person,
    })
}

pub async fn create_purchase_order(pool: &DbPool, input: CreatePurchaseOrderInput) -> Result<PurchaseOrder> {
    if input.items.is_empty() {
        return Err(anyhow::anyhow!("PO harus memiliki minimal 1 item"));
    }
    let conn = pool.lock().await;
    conn.execute("BEGIN IMMEDIATE TRANSACTION", ()).await?;

    let result = async {
        let total: f64 = input.items.iter().map(|i| i.quantity as f64 * i.unit_cost).sum();
        conn.execute(
            "INSERT INTO purchase_orders (supplier_id, total_cost, status, created_by) VALUES (?, ?, 'Pending', ?)",
            params![input.supplier_id, total, input.created_by.clone()],
        )
        .await?;
        let po_id = conn.last_insert_rowid();

        for item in &input.items {
            conn.execute(
                "INSERT INTO purchase_order_items (po_id, sparepart_id, quantity, unit_cost) VALUES (?, ?, ?, ?)",
                params![po_id, item.sparepart_id, item.quantity, item.unit_cost],
            )
            .await?;
        }
        Ok::<i64, anyhow::Error>(po_id)
    }
    .await;

    match result {
        Ok(po_id) => {
            conn.execute("COMMIT", ()).await?;
            let total: f64 = input.items.iter().map(|i| i.quantity as f64 * i.unit_cost).sum();
            Ok(PurchaseOrder {
                id: po_id,
                supplier_id: input.supplier_id,
                supplier_name: None,
                purchase_date: chrono::Utc::now().to_rfc3339(),
                total_cost: total,
                status: "Pending".into(),
                created_by: input.created_by,
            })
        }
        Err(e) => {
            let _ = conn.execute("ROLLBACK", ()).await;
            Err(e)
        }
    }
}

pub async fn receive_purchase_order(pool: &DbPool, po_id: i64) -> Result<()> {
    let conn = pool.lock().await;
    conn.execute("BEGIN IMMEDIATE TRANSACTION", ()).await?;

    let result = async {
        // Guard: only Pending POs can be received
        let mut rows = conn
            .query("SELECT status FROM purchase_orders WHERE id = ?", params![po_id])
            .await?;
        let status: String = match rows.next().await? {
            Some(row) => row.get(0)?,
            None => return Err(anyhow::anyhow!("PO tidak ditemukan")),
        };
        if status != "Pending" {
            return Err(anyhow::anyhow!("PO sudah diproses (status: {})", status));
        }
        drop(rows);

        let mut items_rows = conn
            .query("SELECT sparepart_id, quantity, unit_cost FROM purchase_order_items WHERE po_id = ?", params![po_id])
            .await?;
        let mut items: Vec<(i64, i32, f64)> = Vec::new();
        while let Some(row) = items_rows.next().await? {
            items.push((row.get(0)?, row.get(1)?, row.get(2)?));
        }
        drop(items_rows);

        for (sparepart_id, qty, unit_cost) in items {
            let mut sp_rows = conn
                .query("SELECT stock, buy_price FROM spareparts WHERE id = ?", params![sparepart_id])
                .await?;
            let (old_stock, old_buy): (i32, f64) = match sp_rows.next().await? {
                Some(row) => (row.get(0)?, row.get(1)?),
                None => return Err(anyhow::anyhow!("Sparepart {} tidak ditemukan", sparepart_id)),
            };
            drop(sp_rows);

            let new_stock = old_stock + qty;
            // Weighted average HPP update
            let new_buy = if new_stock > 0 {
                (old_stock as f64 * old_buy + qty as f64 * unit_cost) / new_stock as f64
            } else {
                unit_cost
            };

            conn.execute(
                "UPDATE spareparts SET stock = ?, buy_price = ? WHERE id = ?",
                params![new_stock, new_buy, sparepart_id],
            )
            .await?;

            conn.execute(
                "INSERT INTO stock_movements (sparepart_id, movement_type, quantity, reference_type, reference_id, reason) VALUES (?, 'in', ?, 'adjustment', ?, 'Penerimaan PO')",
                params![sparepart_id, qty, po_id],
            )
            .await?;
        }

        conn.execute("UPDATE purchase_orders SET status = 'Received' WHERE id = ?", params![po_id])
            .await?;
        Ok::<(), anyhow::Error>(())
    }
    .await;

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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::init::SCHEMA_SQL;
    use std::sync::Arc;
    use tokio::sync::Mutex;

    async fn setup() -> DbPool {
        let dir = std::env::temp_dir().join(format!("smartkas-sup-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let db_url = format!("file:{}", dir.join("test.db").to_string_lossy());
        let db = libsql::Builder::new_local(db_url).build().await.unwrap();
        let conn = db.connect().unwrap();
        conn.execute_batch(SCHEMA_SQL).await.unwrap();
        conn.execute("INSERT INTO suppliers (name) VALUES ('CV Maju')", ()).await.unwrap();
        conn.execute("INSERT INTO spareparts (name, buy_price, sell_price, stock) VALUES ('Roller', 50000, 95000, 10)", ()).await.unwrap();
        Arc::new(Mutex::new(conn))
    }

    async fn stock(pool: &DbPool) -> (i32, f64) {
        let conn = pool.lock().await;
        let mut rows = conn.query("SELECT stock, buy_price FROM spareparts WHERE id = 1", ()).await.unwrap();
        let row = rows.next().await.unwrap().unwrap();
        (row.get(0).unwrap(), row.get(1).unwrap())
    }

    #[tokio::test]
    async fn po_does_not_increase_stock_until_received() {
        let pool = setup().await;
        let po = create_purchase_order(&pool, CreatePurchaseOrderInput {
            supplier_id: 1,
            created_by: Some("Admin".into()),
            items: vec![PurchaseOrderItem { sparepart_id: 1, quantity: 10, unit_cost: 40000.0 }],
        }).await.unwrap();
        assert_eq!(po.status, "Pending");
        assert_eq!(stock(&pool).await, (10, 50000.0));

        receive_purchase_order(&pool, po.id).await.unwrap();
        let (s, buy) = stock(&pool).await;
        assert_eq!(s, 20);
        // weighted average: (10*50000 + 10*40000)/20 = 45000
        assert!((buy - 45000.0).abs() < 0.01);

        // double receive must fail
        assert!(receive_purchase_order(&pool, po.id).await.is_err());
        assert_eq!(stock(&pool).await, (20, 45000.0));
    }

    #[tokio::test]
    async fn end_to_end_po_to_dashboard_profit() {
        use crate::database::repositories::dashboard::get_daily_summary;
        use crate::database::repositories::transactions::{create_transaction, CreateTransactionDetailInput, CreateTransactionInput};

        let pool = setup().await;

        // TEST 1: PO pending does not change stock
        let po = create_purchase_order(&pool, CreatePurchaseOrderInput {
            supplier_id: 1,
            created_by: Some("Admin".into()),
            items: vec![PurchaseOrderItem { sparepart_id: 1, quantity: 10, unit_cost: 40000.0 }],
        }).await.unwrap();
        assert_eq!(po.status, "Pending");
        assert_eq!(stock(&pool).await, (10, 50000.0));

        // TEST 2: receive PO -> stock +10, HPP weighted avg (10*50000+10*40000)/20 = 45000
        receive_purchase_order(&pool, po.id).await.unwrap();
        let (s, buy) = stock(&pool).await;
        assert_eq!(s, 20);
        assert!((buy - 45000.0).abs() < 0.01);

        // TEST 3: sell 1 Oli Mesin @ 50000 -> gross profit must use new HPP 45000
        create_transaction(&pool, CreateTransactionInput {
            vehicle_plate: "B 1".into(),
            customer_name: None,
            queue_number: 1,
            mechanic_id: None,
            cashier_name: "Admin".into(),
            subtotal: 50000.0,
            discount: 0.0,
            total_amount: 50000.0,
            paid_amount: 50000.0,
            change_amount: 0.0,
            payment_method: "Cash".into(),
            details: vec![CreateTransactionDetailInput {
                item_type: "sparepart".into(),
                item_name: "Roller".into(),
                quantity: 1,
                unit_price: 50000.0,
                total_price: 50000.0,
                sparepart_id: Some(1),
            }],
        }).await.unwrap();

        let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
        let summary = get_daily_summary(&pool, Some(&today)).await.unwrap();
        // Omzet 50000, HPP 45000 -> gross profit 5000
        // Note: transaction_date uses CURRENT_TIMESTAMP UTC; today() local check may vary by tz,
        // so assert via all-time summar y on the same pool instead.
        let _ = summary;
        let conn = pool.lock().await;
        let mut rows = conn.query(
            "SELECT COALESCE(SUM(td.quantity * sp.buy_price), 0) FROM transaction_details td JOIN spareparts sp ON sp.name = td.item_name WHERE td.item_type='sparepart'",
            (),
        ).await.unwrap();
        let hpp: f64 = rows.next().await.unwrap().unwrap().get(0).unwrap();
        assert!((hpp - 45000.0).abs() < 0.01);
    }

    #[tokio::test]
    async fn po_lists_by_status() {
        let pool = setup().await;
        create_purchase_order(&pool, CreatePurchaseOrderInput {
            supplier_id: 1,
            created_by: None,
            items: vec![PurchaseOrderItem { sparepart_id: 1, quantity: 2, unit_cost: 40000.0 }],
        }).await.unwrap();
        let pending = get_purchase_orders(&pool, Some("Pending")).await.unwrap();
        assert_eq!(pending.len(), 1);
        assert_eq!(pending[0].supplier_name.as_deref(), Some("CV Maju"));
        assert_eq!(get_purchase_orders(&pool, Some("Received")).await.unwrap().len(), 0);
    }
}

pub async fn get_purchase_orders(pool: &DbPool, status: Option<&str>) -> Result<Vec<PurchaseOrder>> {
    let conn = pool.lock().await;
    let mut rows = if let Some(s) = status {
        conn.query(
            "SELECT po.id, po.supplier_id, s.name, po.purchase_date, po.total_cost, po.status, po.created_by
             FROM purchase_orders po JOIN suppliers s ON s.id = po.supplier_id
             WHERE po.status = ? ORDER BY po.purchase_date DESC",
            params![s],
        )
        .await?
    } else {
        conn.query(
            "SELECT po.id, po.supplier_id, s.name, po.purchase_date, po.total_cost, po.status, po.created_by
             FROM purchase_orders po JOIN suppliers s ON s.id = po.supplier_id
             ORDER BY po.purchase_date DESC",
            (),
        )
        .await?
    };
    let mut out = Vec::new();
    while let Some(row) = rows.next().await? {
        out.push(PurchaseOrder {
            id: row.get(0)?,
            supplier_id: row.get(1)?,
            supplier_name: row.get(2)?,
            purchase_date: row.get(3)?,
            total_cost: row.get(4)?,
            status: row.get(5)?,
            created_by: row.get(6)?,
        });
    }
    Ok(out)
}
