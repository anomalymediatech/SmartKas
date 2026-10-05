use super::get_db_connection;

pub(crate) const SCHEMA_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'cashier')),
    is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    contact_person TEXT,
    is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS purchase_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER NOT NULL,
    purchase_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    total_cost REAL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending', 'Received', 'Cancelled')),
    created_by TEXT,
    FOREIGN KEY(supplier_id) REFERENCES suppliers(id)
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    po_id INTEGER NOT NULL,
    sparepart_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    unit_cost REAL NOT NULL,
    FOREIGN KEY(po_id) REFERENCES purchase_orders(id),
    FOREIGN KEY(sparepart_id) REFERENCES spareparts(id)
);

CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'cashier', 'mechanic')),
    phone TEXT,
    commission_rate REAL DEFAULT 0,
    base_salary REAL DEFAULT 0,
    is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS mechanic_commissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id INTEGER NOT NULL,
    mechanic_id INTEGER NOT NULL,
    service_name TEXT NOT NULL,
    commission_amount REAL NOT NULL,
    calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(transaction_id) REFERENCES transactions(id),
    FOREIGN KEY(mechanic_id) REFERENCES employees(id)
);

CREATE TABLE IF NOT EXISTS mechanics (
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    name TEXT NOT NULL, 
    is_active INTEGER DEFAULT 1,
    employee_id INTEGER
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
    let _ = conn.execute("ALTER TABLE mechanics ADD COLUMN employee_id INTEGER", ()).await;

    // Execute schema
    conn.execute_batch(SCHEMA_SQL)
        .await
        .map_err(|e| format!("Failed to create schema: {}", e))?;

    // Backfill employees from existing mechanics table (after schema ensures employees exists)
    let _ = conn.execute(
        "INSERT INTO employees (name, role, commission_rate, is_active)
         SELECT m.name, 'mechanic', 10, m.is_active FROM mechanics m
         WHERE NOT EXISTS (SELECT 1 FROM employees e WHERE e.name = m.name AND e.role = 'mechanic')",
        (),
    ).await;
    let _ = conn.execute(
        "UPDATE mechanics SET employee_id = (SELECT e.id FROM employees e WHERE e.name = mechanics.name AND e.role = 'mechanic' LIMIT 1)
         WHERE employee_id IS NULL",
        (),
    ).await;
    
    // Indexes for dashboard queries
    conn.execute("CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status)", ()).await.map_err(|e| e.to_string())?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_transaction_details_type ON transaction_details(item_type)", ()).await.map_err(|e| e.to_string())?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_transactions_vehicle_plate ON transactions(vehicle_plate)", ()).await.map_err(|e| e.to_string())?;

    // Seed default users when empty
    let user_count: i64 = match conn.query("SELECT COUNT(*) FROM users", ()).await {
        Ok(mut rows) => match rows.next().await {
            Ok(Some(row)) => row.get(0).unwrap_or(0),
            _ => 0,
        },
        _ => 0,
    };
    if user_count == 0 {
        if let Ok(admin_hash) = crate::auth::hash_password("admin123") {
            let _ = conn.execute(
                "INSERT INTO users (username, password_hash, role) VALUES ('admin', ?, 'admin')",
                libsql::params![admin_hash],
            ).await;
        }
        if let Ok(cashier_hash) = crate::auth::hash_password("kasir123") {
            let _ = conn.execute(
                "INSERT INTO users (username, password_hash, role) VALUES ('kasir', ?, 'cashier')",
                libsql::params![cashier_hash],
            ).await;
        }
    }

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