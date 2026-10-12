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
    role TEXT NOT NULL CHECK(role IN ('admin', 'cashier', 'mechanic', 'helper')),
    phone TEXT,
    base_salary REAL DEFAULT 0,
    daily_rate REAL DEFAULT 0,
    is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS helper_daily_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    work_date TEXT NOT NULL,
    days REAL NOT NULL DEFAULT 1,
    rate REAL NOT NULL,
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(employee_id, work_date),
    FOREIGN KEY(employee_id) REFERENCES employees(id)
);

CREATE TABLE IF NOT EXISTS payrolls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    date_from TEXT NOT NULL,
    date_to TEXT NOT NULL,
    computed_amount REAL NOT NULL DEFAULT 0,
    final_amount REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'paid')),
    paid_at DATETIME,
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(employee_id, date_from),
    FOREIGN KEY(employee_id) REFERENCES employees(id)
);

CREATE TABLE IF NOT EXISTS commission_overrides (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    date_from TEXT NOT NULL,
    date_to TEXT NOT NULL,
    amount REAL NOT NULL,
    note TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(employee_id, date_from),
    FOREIGN KEY(employee_id) REFERENCES employees(id)
);

CREATE TABLE IF NOT EXISTS commission_line_overrides (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    line_kind TEXT NOT NULL CHECK(line_kind IN ('transaction_detail', 'helper_log')),
    line_ref_id INTEGER NOT NULL,
    employee_id INTEGER NOT NULL,
    override_amount REAL NOT NULL,
    note TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(line_kind, line_ref_id),
    FOREIGN KEY(employee_id) REFERENCES employees(id)
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
    price REAL NOT NULL,
    service_type TEXT DEFAULT 'biasa'
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
    service_type TEXT,
    FOREIGN KEY(transaction_id) REFERENCES transactions(id)
);

CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY,
    shop_name TEXT,
    shop_address TEXT,
    receipt_footer TEXT,
    printer_name TEXT,
    paper_width INTEGER DEFAULT 80,
    shop_logo TEXT
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
CREATE INDEX IF NOT EXISTS idx_helper_daily_logs_employee ON helper_daily_logs(employee_id, work_date);
"#;

const SEED_SQL: &str = r#"
INSERT OR IGNORE INTO settings (id, shop_name, shop_address, receipt_footer) VALUES (1, 'POS Bengkel', 'Jl. Raya No. 123, Jakarta', 'Service > 7x Gratis 1x. Barang yang sudah dibeli tidak dapat dikembalikan.');

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

/// Rebuild the employees table when it was created by an older version
/// (missing `daily_rate` column and the `helper` role in its CHECK constraint).
/// SQLite cannot alter CHECK constraints, so a table rebuild is required.
async fn migrate_employees_table(conn: &libsql::Connection) -> Result<(), String> {
    let needs_rebuild: bool = match conn
        .query("SELECT COUNT(*) FROM pragma_table_info('employees') WHERE name = 'daily_rate'", ())
        .await
    {
        Ok(mut rows) => match rows.next().await {
            Ok(Some(row)) => row.get::<i64>(0).map(|c| c == 0).unwrap_or(false),
            _ => false,
        },
        Err(_) => false,
    };
    if !needs_rebuild {
        return Ok(());
    }

    let _ = conn.execute("PRAGMA foreign_keys = OFF", ()).await;
    let result = conn
        .execute_batch(
            r#"
            CREATE TABLE employees_migrated (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                role TEXT NOT NULL CHECK(role IN ('admin', 'cashier', 'mechanic', 'helper')),
                phone TEXT,
                base_salary REAL DEFAULT 0,
                daily_rate REAL DEFAULT 0,
                is_active INTEGER DEFAULT 1
            );
            INSERT INTO employees_migrated (id, name, role, phone, base_salary, daily_rate, is_active)
            SELECT id, name, role, phone, base_salary, 0, is_active FROM employees;
            DROP TABLE employees;
            ALTER TABLE employees_migrated RENAME TO employees;
            "#,
        )
        .await;
    let _ = conn.execute("PRAGMA foreign_keys = ON", ()).await;
    result
        .map(|_| ())
        .map_err(|e| format!("Failed to migrate employees table: {}", e))
}

/// Rebuild payrolls from the old monthly layout (month/year) to the weekly
/// layout (date_from/date_to). Old monthly rows are kept with date_from set
/// to the first day of that month so history is not lost.
async fn migrate_payrolls_to_weekly(conn: &libsql::Connection) -> Result<(), String> {
    let needs_rebuild: bool = match conn
        .query("SELECT COUNT(*) FROM pragma_table_info('payrolls') WHERE name = 'date_from'", ())
        .await
    {
        Ok(mut rows) => match rows.next().await {
            Ok(Some(row)) => row.get::<i64>(0).map(|c| c == 0).unwrap_or(false),
            _ => false,
        },
        Err(_) => false,
    };
    if !needs_rebuild {
        return Ok(());
    }

    let _ = conn.execute("PRAGMA foreign_keys = OFF", ()).await;
    let result = conn
        .execute_batch(
            r#"
            CREATE TABLE payrolls_migrated (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                employee_id INTEGER NOT NULL,
                date_from TEXT NOT NULL,
                date_to TEXT NOT NULL,
                computed_amount REAL NOT NULL DEFAULT 0,
                final_amount REAL NOT NULL DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'paid')),
                paid_at DATETIME,
                note TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(employee_id, date_from),
                FOREIGN KEY(employee_id) REFERENCES employees(id)
            );
            INSERT INTO payrolls_migrated (id, employee_id, date_from, date_to, computed_amount, final_amount, status, paid_at, note, created_at, updated_at)
            SELECT id, employee_id,
                   printf('%04d-%02d-01', year, month),
                   date(printf('%04d-%02d-01', year, month), '+1 month', '-1 day'),
                   computed_amount, final_amount, status, paid_at, note, created_at, updated_at
            FROM payrolls;
            DROP TABLE payrolls;
            ALTER TABLE payrolls_migrated RENAME TO payrolls;
            "#,
        )
        .await;
    let _ = conn.execute("PRAGMA foreign_keys = ON", ()).await;
    result
        .map(|_| ())
        .map_err(|e| format!("Failed to migrate payrolls table: {}", e))
}

pub async fn init_database(app_handle: &tauri::AppHandle) -> Result<(), String> {
    let pool = get_db_connection(app_handle).await?;
    let conn = pool.lock().await;
    
    // Apply migrations for databases created by older versions
    let _ = conn.execute("ALTER TABLE settings ADD COLUMN printer_name TEXT", ()).await;
    let _ = conn.execute("ALTER TABLE settings ADD COLUMN paper_width INTEGER DEFAULT 80", ()).await;
    let _ = conn.execute("ALTER TABLE settings ADD COLUMN shop_logo TEXT", ()).await;
    let _ = conn.execute("ALTER TABLE mechanics ADD COLUMN employee_id INTEGER", ()).await;
    let _ = conn.execute("ALTER TABLE transaction_details ADD COLUMN service_type TEXT", ()).await;
    let _ = conn.execute("ALTER TABLE services ADD COLUMN service_type TEXT DEFAULT 'biasa'", ()).await;
    let _ = conn.execute("ALTER TABLE payrolls ADD COLUMN weekly_salary_override REAL", ()).await;

    // Execute schema
    conn.execute_batch(SCHEMA_SQL)
        .await
        .map_err(|e| format!("Failed to create schema: {}", e))?;

    // Migration: rebuild employees when daily_rate column is missing
    // (SQLite cannot alter a CHECK constraint; old DBs only allow admin/cashier/mechanic)
    migrate_employees_table(&conn).await?;

    // Migration: rebuild payrolls from monthly (month/year) to weekly (date_from/date_to)
    migrate_payrolls_to_weekly(&conn).await?;
    let _ = conn
        .execute("CREATE INDEX IF NOT EXISTS idx_payrolls_date ON payrolls(date_from)", ())
        .await;

    // Backfill employees from existing mechanics table (after schema ensures employees exists)
    let _ = conn.execute(
        "INSERT INTO employees (name, role, base_salary, daily_rate, is_active)
         SELECT m.name, 'mechanic', 0, 0, m.is_active FROM mechanics m
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

#[cfg(test)]
mod tests {
    use super::*;

    async fn open_db() -> libsql::Connection {
        let dir = std::env::temp_dir().join(format!("smartkas-init-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let db_url = format!("file:{}", dir.join("test.db").to_string_lossy());
        let db = libsql::Builder::new_local(db_url).build().await.unwrap();
        db.connect().unwrap()
    }

    #[tokio::test]
    async fn rebuilds_old_employees_table_and_accepts_helper() {
        let conn = open_db().await;
        // Simulate a database created by an older version
        conn.execute_batch(
            r#"
            CREATE TABLE employees (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                role TEXT NOT NULL CHECK(role IN ('admin', 'cashier', 'mechanic')),
                phone TEXT,
                commission_rate REAL DEFAULT 0,
                base_salary REAL DEFAULT 0,
                is_active INTEGER DEFAULT 1
            );
            INSERT INTO employees (name, role, commission_rate, base_salary) VALUES ('Budi', 'mechanic', 10, 1500000);
            "#,
        )
        .await
        .unwrap();

        migrate_employees_table(&conn).await.unwrap();

        // Old data preserved, daily_rate added, commission columns removed
        let mut rows = conn
            .query("SELECT name, role, base_salary, daily_rate FROM employees", ())
            .await
            .unwrap();
        let row = rows.next().await.unwrap().unwrap();
        assert_eq!(row.get::<String>(0).unwrap(), "Budi");
        assert_eq!(row.get::<String>(1).unwrap(), "mechanic");
        assert!((row.get::<f64>(2).unwrap() - 1_500_000.0).abs() < 0.01);
        assert!((row.get::<f64>(3).unwrap()).abs() < 0.01);

        // New CHECK constraint allows the helper role
        conn.execute(
            "INSERT INTO employees (name, role, daily_rate) VALUES ('Asisten', 'helper', 100000)",
            (),
        )
        .await
        .expect("helper role should be accepted after migration");

        // Running it again is a no-op
        migrate_employees_table(&conn).await.unwrap();
        let mut rows = conn.query("SELECT COUNT(*) FROM employees", ()).await.unwrap();
        assert_eq!(rows.next().await.unwrap().unwrap().get::<i64>(0).unwrap(), 2);
    }

    #[tokio::test]
    async fn fresh_schema_already_has_helper_and_daily_rate() {
        let conn = open_db().await;
        conn.execute_batch(SCHEMA_SQL).await.unwrap();
        // Should be a no-op on a fresh schema
        migrate_employees_table(&conn).await.unwrap();
        conn.execute(
            "INSERT INTO employees (name, role, daily_rate) VALUES ('Asisten', 'helper', 100000)",
            (),
        )
        .await
        .unwrap();
    }

    #[tokio::test]
    async fn rebuilds_monthly_payrolls_to_weekly() {
        let conn = open_db().await;
        // Simulate a database created by an older version (monthly payrolls)
        conn.execute_batch(
            r#"
            CREATE TABLE payrolls (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                employee_id INTEGER NOT NULL,
                month INTEGER NOT NULL,
                year INTEGER NOT NULL,
                computed_amount REAL NOT NULL DEFAULT 0,
                final_amount REAL NOT NULL DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'paid')),
                paid_at DATETIME,
                note TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(employee_id, month, year)
            );
            INSERT INTO payrolls (employee_id, month, year, computed_amount, final_amount, status)
            VALUES (1, 9, 2026, 800000, 750000, 'paid');
            "#,
        )
        .await
        .unwrap();

        migrate_payrolls_to_weekly(&conn).await.unwrap();

        let mut rows = conn
            .query("SELECT employee_id, date_from, date_to, computed_amount, final_amount, status FROM payrolls", ())
            .await
            .unwrap();
        let row = rows.next().await.unwrap().unwrap();
        assert_eq!(row.get::<i64>(0).unwrap(), 1);
        assert_eq!(row.get::<String>(1).unwrap(), "2026-09-01");
        assert_eq!(row.get::<String>(2).unwrap(), "2026-09-30");
        assert!((row.get::<f64>(3).unwrap() - 800000.0).abs() < 0.01);
        assert!((row.get::<f64>(4).unwrap() - 750000.0).abs() < 0.01);
        assert_eq!(row.get::<String>(5).unwrap(), "paid");

        // Running it again is a no-op
        migrate_payrolls_to_weekly(&conn).await.unwrap();
        let mut rows = conn.query("SELECT COUNT(*) FROM payrolls", ()).await.unwrap();
        assert_eq!(rows.next().await.unwrap().unwrap().get::<i64>(0).unwrap(), 1);
    }
}
