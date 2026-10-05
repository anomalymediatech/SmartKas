use super::get_db_connection;

pub(crate) const SCHEMA_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS mechanics (
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    name TEXT NOT NULL, 
    is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS spareparts (
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    name TEXT NOT NULL, 
    buy_price REAL DEFAULT 0, 
    sell_price REAL NOT NULL, 
    stock INTEGER DEFAULT 0, 
    is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    name TEXT NOT NULL, 
    price REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_number TEXT UNIQUE NOT NULL,
    queue_number INTEGER,
    customer_name TEXT,
    vehicle_plate TEXT NOT NULL,
    mechanic_id INTEGER,
    cashier_name TEXT DEFAULT 'Admin',
    subtotal REAL NOT NULL,
    discount REAL DEFAULT 0,
    total_amount REAL NOT NULL,
    paid_amount REAL NOT NULL,
    change_amount REAL DEFAULT 0,
    payment_method TEXT DEFAULT 'Cash',
    status TEXT DEFAULT 'Lunas',
    transaction_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(mechanic_id) REFERENCES mechanics(id)
);

CREATE TABLE IF NOT EXISTS transaction_details (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id INTEGER NOT NULL,
    item_type TEXT NOT NULL CHECK(item_type IN ('layanan', 'sparepart')),
    item_name TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    unit_price REAL NOT NULL,
    total_price REAL NOT NULL,
    FOREIGN KEY(transaction_id) REFERENCES transactions(id)
);

CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY,
    shop_name TEXT,
    shop_address TEXT,
    receipt_footer TEXT,
    printer_name TEXT,
    paper_width INTEGER DEFAULT 80
);

CREATE TABLE IF NOT EXISTS stock_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sparepart_id INTEGER NOT NULL,
    movement_type TEXT NOT NULL CHECK(movement_type IN ('in', 'out', 'adjustment', 'void_restore')),
    quantity INTEGER NOT NULL,
    reference_type TEXT CHECK(reference_type IN ('transaction', 'adjustment', 'void')),
    reference_id INTEGER,
    reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(sparepart_id) REFERENCES spareparts(id)
);

CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_transactions_plate ON transactions(vehicle_plate);
CREATE INDEX IF NOT EXISTS idx_transaction_details_transaction ON transaction_details(transaction_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_sparepart ON stock_movements(sparepart_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_date ON stock_movements(created_at);
"#;

const SEED_SQL: &str = r#"
INSERT OR IGNORE INTO settings (id, shop_name, shop_address, receipt_footer) VALUES (1, 'KASMINI BENGKEL', 'Jl. Raya No. 123, Jakarta', 'Service > 7x Gratis 1x. Barang yang sudah dibeli tidak dapat dikembalikan.');

INSERT OR IGNORE INTO mechanics (name) VALUES 
    ('Budi'),
    ('Ahmad'),
    ('Siti'),
    ('Joko');

INSERT OR IGNORE INTO services (name, price) VALUES 
    ('Ganti Oli Mesin', 50000),
    ('Tune Up', 150000),
    ('Ganti Busi', 75000),
    ('Cek Kunci Kontak', 30000),
    ('Bersihkan Karburator', 100000);

INSERT OR IGNORE INTO spareparts (name, buy_price, sell_price, stock) VALUES 
    ('Oli Mesin 1L', 35000, 55000, 20),
    ('Oli Mesin 4L', 120000, 180000, 10),
    ('Busi NGK', 25000, 45000, 30),
    ('Filter Oli', 15000, 30000, 15),
    ('Kampas Rem Depan', 80000, 150000, 8),
    ('Kampas Rem Belakang', 70000, 130000, 8),
    ('Oli Gardan', 40000, 65000, 12),
    ('Cairan Rem DOT 4', 30000, 55000, 20);
"#;

pub async fn init_database(app_handle: &tauri::AppHandle) -> Result<(), String> {
    let pool = get_db_connection(app_handle).await?;
    let conn = pool.lock().await;
    
    // Apply migrations for databases created by older versions
    let _ = conn.execute("ALTER TABLE settings ADD COLUMN printer_name TEXT", ()).await;
    let _ = conn.execute("ALTER TABLE settings ADD COLUMN paper_width INTEGER DEFAULT 80", ()).await;

    // Execute schema
    conn.execute_batch(SCHEMA_SQL)
        .await
        .map_err(|e| format!("Failed to create schema: {}", e))?;
    
    // Seed only once: skip when master data already exists
    let mut rows = conn
        .query("SELECT COUNT(*) FROM mechanics", ())
        .await
        .map_err(|e| format!("Failed to check seed state: {}", e))?;
    let count: i64 = match rows.next().await {
        Ok(Some(row)) => row.get(0).map_err(|e| format!("Failed to read count: {}", e))?,
        _ => 0,
    };

    if count == 0 {
        conn.execute_batch(SEED_SQL)
            .await
            .map_err(|e| format!("Failed to seed data: {}", e))?;
    }
    
    Ok(())
}