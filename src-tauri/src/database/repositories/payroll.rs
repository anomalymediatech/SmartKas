use super::super::DbPool;
use libsql::params;
use serde::{Deserialize, Serialize};
use anyhow::Result;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HelperDailyLog {
    pub id: i64,
    pub employee_id: i64,
    pub work_date: String,
    pub days: f64,
    pub rate: f64,
    pub note: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct HelperDailyLogSummary {
    pub employee_id: i64,
    pub employee_name: String,
    pub daily_rate: f64,
    pub total_days: f64,
    pub total_amount: f64,
    pub logs: Vec<HelperDailyLog>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PayrollRow {
    pub id: i64,
    pub employee_id: i64,
    pub employee_name: String,
    pub role: String,
    pub date_from: String,
    pub date_to: String,
    pub computed_amount: f64,
    pub weekly_salary_override: Option<f64>,
    pub final_amount: f64,
    pub status: String,
    pub paid_at: Option<String>,
    pub note: Option<String>,
}

/// Weekly payroll preview for mechanics and helpers.
/// Mechanics: system reference = total layanan services value, adjusted by per-line commission override.
/// Helpers: system reference = days worked x daily rate, adjusted by per-line overrides.
/// `base_amount` (the effective total after overrides) is what the payroll tab pre-fills into the editable "Gaji Final" column.
/// `weekly_base_salary` is the weekly portion of monthly base_salary (base_salary / 4).
/// `weekly_salary_override` is the manual override for weekly salary (if any).
#[derive(Debug, Serialize, Deserialize)]
pub struct WeeklyPayrollPreviewRow {
    pub employee_id: i64,
    pub employee_name: String,
    pub role: String,
    pub daily_rate: f64,
    pub base_salary: f64,
    pub weekly_base_salary: f64,
    pub total_services: f64,
    pub commission_ref: f64,
    pub total_days: f64,
    pub daily_amount: f64,
    pub base_amount: f64,
    pub weekly_salary_override: Option<f64>,
    pub existing: Option<PayrollRow>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WeeklyCommissionLine {
    pub line_id: i64,
    pub line_kind: String,
    pub line_date: String,
    pub invoice_number: Option<String>,
    pub item_type: Option<String>,
    pub item_name: String,
    pub amount: f64,
    pub system_commission: f64,
    pub commission: f64,
    pub is_edited: bool,
}

/// Commission report for one employee over a week (Mon-Sun date range).
/// Mechanics: per-line layanan + sparepart (separate rates), each line
/// individually overridable. Helpers: per-day wage lines from daily logs.
/// `system_amount` is the pre-override reference; `effective_total` is the
/// post-override total that feeds into the payroll tab.
#[derive(Debug, Serialize, Deserialize)]
pub struct WeeklyCommissionSummary {
    pub employee_id: i64,
    pub employee_name: String,
    pub role: String,
    pub total_services: f64,
    pub system_amount: f64,
    pub effective_total: f64,
    pub lines: Vec<WeeklyCommissionLine>,
}

pub async fn get_helper_daily_logs(
    pool: &DbPool,
    employee_id: i64,
    date_from: &str,
    date_to: &str,
) -> Result<HelperDailyLogSummary> {
    let conn = pool.lock().await;

    let mut emp_rows = conn
        .query("SELECT name, daily_rate FROM employees WHERE id = ?", params![employee_id])
        .await?;
    let (name, daily_rate): (String, f64) = match emp_rows.next().await? {
        Some(row) => (row.get(0)?, row.get(1)?),
        None => return Err(anyhow::anyhow!("Karyawan tidak ditemukan")),
    };
    drop(emp_rows);

    let mut rows = conn
        .query(
            r#"SELECT id, work_date, days, rate, note
               FROM helper_daily_logs
               WHERE employee_id = ? AND work_date >= ? AND work_date <= ?
               ORDER BY work_date"#,
            params![employee_id, date_from, date_to],
        )
        .await?;

    let mut logs = Vec::new();
    let mut total_days = 0.0;
    let mut total_amount = 0.0;
    while let Some(row) = rows.next().await? {
        let days: f64 = row.get(2)?;
        let rate: f64 = row.get(3)?;
        total_days += days;
        total_amount += days * rate;
        logs.push(HelperDailyLog {
            id: row.get(0)?,
            employee_id,
            work_date: row.get(1)?,
            days,
            rate,
            note: row.get(4)?,
        });
    }

    Ok(HelperDailyLogSummary {
        employee_id,
        employee_name: name,
        daily_rate,
        total_days,
        total_amount,
        logs,
    })
}

/// Upsert a single day entry for a helper. The rate is snapshotted from
/// the employee's current daily_rate so history stays accurate.
pub async fn log_helper_day(
    pool: &DbPool,
    employee_id: i64,
    work_date: &str,
    days: f64,
    note: Option<&str>,
) -> Result<HelperDailyLog> {
    let conn = pool.lock().await;

    let mut emp_rows = conn
        .query("SELECT role, daily_rate FROM employees WHERE id = ?", params![employee_id])
        .await?;
    let (role, rate): (String, f64) = match emp_rows.next().await? {
        Some(row) => (row.get(0)?, row.get(1)?),
        None => return Err(anyhow::anyhow!("Karyawan tidak ditemukan")),
    };
    drop(emp_rows);
    if role != "helper" {
        return Err(anyhow::anyhow!("Catatan harian hanya untuk helper"));
    }

    conn.execute(
        r#"INSERT INTO helper_daily_logs (employee_id, work_date, days, rate, note)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(employee_id, work_date)
           DO UPDATE SET days = excluded.days, rate = excluded.rate, note = excluded.note"#,
        params![employee_id, work_date, days, rate, note],
    )
    .await?;

    let mut rows = conn
        .query(
            "SELECT id, employee_id, work_date, days, rate, note FROM helper_daily_logs WHERE employee_id = ? AND work_date = ?",
            params![employee_id, work_date],
        )
        .await?;
    let row = rows.next().await?.ok_or_else(|| anyhow::anyhow!("Gagal menyimpan catatan harian"))?;
    Ok(HelperDailyLog {
        id: row.get(0)?,
        employee_id: row.get(1)?,
        work_date: row.get(2)?,
        days: row.get(3)?,
        rate: row.get(4)?,
        note: row.get(5)?,
    })
}

pub async fn delete_helper_day(pool: &DbPool, id: i64) -> Result<()> {
    let conn = pool.lock().await;
    conn.execute("DELETE FROM helper_daily_logs WHERE id = ?", params![id]).await?;
    Ok(())
}

async fn fetch_existing_payrolls(
    conn: &libsql::Connection,
    date_from: &str,
) -> Result<Vec<PayrollRow>> {
    let mut rows = conn
        .query(
            r#"SELECT p.id, p.employee_id, e.name, e.role, p.date_from, p.date_to,
                      p.computed_amount, p.weekly_salary_override, p.final_amount, p.status, p.paid_at, p.note
                 FROM payrolls p
                 JOIN employees e ON e.id = p.employee_id
                 WHERE p.date_from = ?"#,
            params![date_from],
        )
        .await?;
    let mut out = Vec::new();
    while let Some(row) = rows.next().await? {
        out.push(PayrollRow {
            id: row.get(0)?,
            employee_id: row.get(1)?,
            employee_name: row.get(2)?,
            role: row.get(3)?,
            date_from: row.get(4)?,
            date_to: row.get(5)?,
            computed_amount: row.get(6)?,
            weekly_salary_override: row.get(7)?,
            final_amount: row.get(8)?,
            status: row.get(9)?,
            paid_at: row.get(10)?,
            note: row.get(11)?,
        });
    }
    Ok(out)
}

/// Returns (total_layanan_price, system_commission, effective_commission).
/// Manual-only model: system_commission is always 0.0; effective_commission
/// is the sum of manual per-line overrides (or 0 if none).
async fn fetch_mechanic_week(
    conn: &libsql::Connection,
    employee_id: i64,
    date_from: &str,
    date_to: &str,
) -> Result<(f64, f64, f64)> {
    let mut rows = conn
        .query(
            r#"SELECT COALESCE(SUM(td.total_price), 0.0),
                      0.0,
                      COALESCE(SUM(COALESCE(clo.override_amount, 0.0)), 0.0)
               FROM transaction_details td
               JOIN transactions t ON t.id = td.transaction_id
               JOIN mechanics m ON m.id = t.mechanic_id
               LEFT JOIN commission_line_overrides clo
                   ON clo.line_kind = 'transaction_detail' AND clo.line_ref_id = td.id
               WHERE m.employee_id = ? AND t.status = 'Lunas'
                 AND date(t.transaction_date, 'localtime') >= date(?)
                 AND date(t.transaction_date, 'localtime') <= date(?)"#,
            params![employee_id, date_from, date_to],
        )
        .await?;
    if let Some(row) = rows.next().await? {
        Ok((row.get(0)?, row.get(1)?, row.get(2)?))
    } else {
        Ok((0.0, 0.0, 0.0))
    }
}

/// Returns (total_days, system_amount, effective_amount) where effective
/// accounts for any per-line commission override on helper daily logs.
async fn fetch_helper_week(
    conn: &libsql::Connection,
    employee_id: i64,
    date_from: &str,
    date_to: &str,
) -> Result<(f64, f64, f64)> {
    let mut rows = conn
        .query(
            r#"SELECT COALESCE(SUM(hl.days), 0.0),
                      COALESCE(SUM(hl.days * hl.rate), 0.0),
                      COALESCE(SUM(COALESCE(clo.override_amount, hl.days * hl.rate)), 0.0)
               FROM helper_daily_logs hl
               LEFT JOIN commission_line_overrides clo
                   ON clo.line_kind = 'helper_log' AND clo.line_ref_id = hl.id
               WHERE hl.employee_id = ? AND hl.work_date >= ? AND hl.work_date <= ?"#,
            params![employee_id, date_from, date_to],
        )
        .await?;
    if let Some(row) = rows.next().await? {
        Ok((row.get(0)?, row.get(1)?, row.get(2)?))
    } else {
        Ok((0.0, 0.0, 0.0))
    }
}

pub async fn get_weekly_payroll_preview(
    pool: &DbPool,
    date_from: &str,
    date_to: &str,
) -> Result<Vec<WeeklyPayrollPreviewRow>> {
    let conn = pool.lock().await;

    let mut emp_rows = conn
        .query(
            "SELECT id, name, role, daily_rate, base_salary FROM employees WHERE is_active = 1 AND role IN ('mechanic', 'helper') ORDER BY name",
            (),
        )
        .await?;
    let mut employees = Vec::new();
    while let Some(row) = emp_rows.next().await? {
        let (id, name, role, daily, base_salary): (i64, String, String, f64, f64) =
            (row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?);
        employees.push((id, name, role, daily, base_salary));
    }
    drop(emp_rows);

let existing = fetch_existing_payrolls(&conn, date_from).await?;

    let mut out = Vec::new();
    for (id, name, role, daily_rate, base_salary) in employees {
        let weekly_base_salary = if role == "mechanic" { base_salary / 4.0 } else { 0.0 };
        
        let (total_services, commission_ref, total_days, daily_amount, base_amount) =
            if role == "mechanic" {
                let (services, _sys, eff) =
                    fetch_mechanic_week(&conn, id, date_from, date_to).await?;
                (services, eff, 0.0, 0.0, weekly_base_salary + eff)
            } else {
                let (days, _sys, eff) = fetch_helper_week(&conn, id, date_from, date_to).await?;
                (0.0, 0.0, days, eff, eff)
            };

        let existing_payroll = existing.iter().find(|p| p.employee_id == id).cloned();
        let weekly_salary_override = existing_payroll.as_ref().and_then(|p| p.weekly_salary_override);

        out.push(WeeklyPayrollPreviewRow {
            employee_id: id,
            employee_name: name,
            role,
            daily_rate,
            base_salary,
            weekly_base_salary,
            total_services,
            commission_ref,
            total_days,
            daily_amount,
            base_amount,
            weekly_salary_override,
            existing: existing_payroll,
        });
    }

    Ok(out)
}

pub async fn save_weekly_payroll(
    pool: &DbPool,
    employee_id: i64,
    date_from: &str,
    date_to: &str,
    final_amount: f64,
    status: &str,
    note: Option<&str>,
    weekly_salary_override: Option<f64>,
) -> Result<PayrollRow> {
    if status != "draft" && status != "paid" {
        return Err(anyhow::anyhow!("Status tidak valid"));
    }
    let conn = pool.lock().await;

    let mut emp_rows = conn
        .query(
            "SELECT role FROM employees WHERE id = ?",
            params![employee_id],
        )
        .await?;
    let role: String = match emp_rows.next().await? {
        Some(row) => row.get(0)?,
        None => return Err(anyhow::anyhow!("Karyawan tidak ditemukan")),
    };
    drop(emp_rows);

    // Recompute the effective reference (after per-line overrides) at save time
    let computed_amount = if role == "helper" {
        let (_, _, eff) = fetch_helper_week(&conn, employee_id, date_from, date_to).await?;
        eff
    } else {
        let (_, _, eff) =
            fetch_mechanic_week(&conn, employee_id, date_from, date_to).await?;
        eff
    };

    conn.execute(
        r#"INSERT INTO payrolls (employee_id, date_from, date_to, computed_amount, weekly_salary_override, final_amount, status, paid_at, note)
           VALUES (?, ?, ?, ?, ?, ?, ?,
                   CASE WHEN ? = 'paid' THEN datetime('now', 'localtime') ELSE NULL END, ?)
           ON CONFLICT(employee_id, date_from)
           DO UPDATE SET date_to = excluded.date_to,
                         computed_amount = excluded.computed_amount,
                         weekly_salary_override = excluded.weekly_salary_override,
                         final_amount = excluded.final_amount,
                         status = excluded.status,
                         paid_at = CASE WHEN excluded.status = 'paid' THEN datetime('now', 'localtime') ELSE NULL END,
                         note = excluded.note,
                         updated_at = datetime('now', 'localtime')"#,
        params![employee_id, date_from, date_to, computed_amount, weekly_salary_override, final_amount, status, status, note],
    )
    .await?;

    let mut rows = conn
        .query(
            r#"SELECT p.id, p.employee_id, e.name, e.role, p.date_from, p.date_to,
                      p.computed_amount, p.weekly_salary_override, p.final_amount, p.status, p.paid_at, p.note
                 FROM payrolls p JOIN employees e ON e.id = p.employee_id
                 WHERE p.employee_id = ? AND p.date_from = ?"#,
            params![employee_id, date_from],
        )
        .await?;
    let row = rows.next().await?.ok_or_else(|| anyhow::anyhow!("Gagal menyimpan gaji"))?;
    Ok(PayrollRow {
        id: row.get(0)?,
        employee_id: row.get(1)?,
        employee_name: row.get(2)?,
        role: row.get(3)?,
        date_from: row.get(4)?,
        date_to: row.get(5)?,
        computed_amount: row.get(6)?,
        weekly_salary_override: row.get(7)?,
        final_amount: row.get(8)?,
        status: row.get(9)?,
        paid_at: row.get(10)?,
        note: row.get(11)?,
    })
}

pub async fn get_weekly_payrolls(pool: &DbPool, date_from: &str) -> Result<Vec<PayrollRow>> {
    let conn = pool.lock().await;
    fetch_existing_payrolls(&conn, date_from).await
}

/// Commission report for one employee over a week. Mechanics get one line per
/// layanan/sparepart item (manual-only, no percentage rates, individually overridable);
/// helpers get one line per daily log (also individually overridable).
pub async fn get_weekly_commission_summary(
    pool: &DbPool,
    employee_id: i64,
    date_from: &str,
    date_to: &str,
) -> Result<WeeklyCommissionSummary> {
    let conn = pool.lock().await;

    let mut emp_rows = conn
        .query(
            "SELECT name, role FROM employees WHERE id = ?",
            params![employee_id],
        )
        .await?;
    let (name, role): (String, String) = match emp_rows.next().await? {
        Some(row) => (row.get(0)?, row.get(1)?),
        None => return Err(anyhow::anyhow!("Karyawan tidak ditemukan")),
    };
    drop(emp_rows);

    let mut lines = Vec::new();
    let mut total_services = 0.0;
    let mut system_amount = 0.0;
    let mut effective_total = 0.0;

    if role == "mechanic" {
        let mut rows = conn
            .query(
                r#"SELECT td.id, t.transaction_date, t.invoice_number, td.item_type, td.item_name, td.total_price,
                          COALESCE(clo.override_amount, 0.0),
                          clo.id IS NOT NULL
                   FROM transaction_details td
                   JOIN transactions t ON t.id = td.transaction_id
                   JOIN mechanics m ON m.id = t.mechanic_id
                   LEFT JOIN commission_line_overrides clo
                       ON clo.line_kind = 'transaction_detail' AND clo.line_ref_id = td.id
                   WHERE m.employee_id = ? AND t.status = 'Lunas'
                     AND date(t.transaction_date, 'localtime') >= date(?)
                     AND date(t.transaction_date, 'localtime') <= date(?)
                   ORDER BY t.transaction_date, td.id"#,
                params![employee_id, date_from, date_to],
            )
            .await?;
        while let Some(row) = rows.next().await? {
            let price: f64 = row.get(5)?;
            let system_commission: f64 = 0.0;
            let commission: f64 = row.get(6)?;
            let is_edited: bool = row.get(7)?;
            total_services += price;
            system_amount += system_commission;
            effective_total += commission;
            lines.push(WeeklyCommissionLine {
                line_id: row.get(0)?,
                line_kind: "transaction_detail".into(),
                line_date: row.get(1)?,
                invoice_number: row.get(2)?,
                item_type: row.get(3)?,
                item_name: row.get(4)?,
                amount: price,
                system_commission,
                commission,
                is_edited,
            });
        }
    } else if role == "helper" {
        let mut rows = conn
            .query(
                r#"SELECT hl.id, hl.work_date, hl.note, hl.days, hl.rate, hl.days * hl.rate,
                          COALESCE(clo.override_amount, hl.days * hl.rate),
                          clo.id IS NOT NULL
                   FROM helper_daily_logs hl
                   LEFT JOIN commission_line_overrides clo
                       ON clo.line_kind = 'helper_log' AND clo.line_ref_id = hl.id
                   WHERE hl.employee_id = ? AND hl.work_date >= ? AND hl.work_date <= ?
                   ORDER BY hl.work_date"#,
                params![employee_id, date_from, date_to],
            )
            .await?;
        while let Some(row) = rows.next().await? {
            let amount: f64 = row.get(5)?;
            let commission: f64 = row.get(6)?;
            let is_edited: bool = row.get(7)?;
            system_amount += amount;
            effective_total += commission;
            let note: Option<String> = row.get(2)?;
            let days: f64 = row.get(3)?;
            lines.push(WeeklyCommissionLine {
                line_id: row.get(0)?,
                line_kind: "helper_log".into(),
                line_date: row.get(1)?,
                invoice_number: None,
                item_type: None,
                item_name: note.unwrap_or_else(|| format!("{} hari", days)),
                amount,
                system_commission: amount,
                commission,
                is_edited,
            });
        }
    }

    Ok(WeeklyCommissionSummary {
        employee_id,
        employee_name: name,
        role,
        total_services,
        system_amount,
        effective_total,
        lines,
    })
}

/// Save (or update) the manually edited commission for one commission line
/// (a layanan/sparepart transaction detail, or a helper daily log). This
/// per-line override is what the payroll tab uses in its base total.
pub async fn save_commission_line_override(
    pool: &DbPool,
    line_kind: &str,
    line_ref_id: i64,
    employee_id: i64,
    amount: f64,
    note: Option<&str>,
) -> Result<()> {
    if line_kind != "transaction_detail" && line_kind != "helper_log" {
        return Err(anyhow::anyhow!("Jenis baris tidak valid"));
    }
    let conn = pool.lock().await;
    conn.execute(
        r#"INSERT INTO commission_line_overrides (line_kind, line_ref_id, employee_id, override_amount, note, updated_at)
           VALUES (?, ?, ?, ?, ?, datetime('now', 'localtime'))
           ON CONFLICT(line_kind, line_ref_id)
           DO UPDATE SET employee_id = excluded.employee_id,
                         override_amount = excluded.override_amount,
                         note = excluded.note,
                         updated_at = excluded.updated_at"#,
        params![line_kind, line_ref_id, employee_id, amount, note],
    )
    .await?;
    Ok(())
}

/// Remove the manual override for one commission line, restoring the system
/// calculated commission.
pub async fn delete_commission_line_override(
    pool: &DbPool,
    line_kind: &str,
    line_ref_id: i64,
) -> Result<()> {
    let conn = pool.lock().await;
    conn.execute(
        "DELETE FROM commission_line_overrides WHERE line_kind = ? AND line_ref_id = ?",
        params![line_kind, line_ref_id],
    )
    .await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::init::SCHEMA_SQL;
    use crate::database::repositories::employees::{add_employee, CreateEmployeeInput};
    use crate::database::repositories::transactions::{create_transaction, CreateTransactionDetailInput, CreateTransactionInput};
    use chrono::{Datelike, Duration, Local};
    use std::sync::Arc;
    use tokio::sync::Mutex;

    async fn setup() -> DbPool {
        let dir = std::env::temp_dir().join(format!("smartkas-payroll-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let db_url = format!("file:{}", dir.join("test.db").to_string_lossy());
        let db = libsql::Builder::new_local(db_url).build().await.unwrap();
        let conn = db.connect().unwrap();
        conn.execute_batch(SCHEMA_SQL).await.unwrap();
        // Add weekly_salary_override column for tests (migration runs in init_database but not in test setup)
        conn.execute("ALTER TABLE payrolls ADD COLUMN weekly_salary_override REAL", ()).await.unwrap();
        Arc::new(Mutex::new(conn))
    }

    fn today() -> String {
        Local::now().format("%Y-%m-%d").to_string()
    }

    /// Monday..Sunday of the week containing today (local time).
    fn this_week() -> (String, String) {
        let now = Local::now().date_naive();
        let monday = now - Duration::days(now.weekday().num_days_from_monday() as i64);
        let sunday = monday + Duration::days(6);
        (
            monday.format("%Y-%m-%d").to_string(),
            sunday.format("%Y-%m-%d").to_string(),
        )
    }

    #[tokio::test]
    async fn helper_log_upserts_and_totals() {
        let pool = setup().await;
        add_employee(&pool, CreateEmployeeInput {
            name: "Asisten".into(),
            role: "helper".into(),
            phone: None,
            base_salary: None,
            daily_rate: Some(100_000.0),
        }).await.unwrap();
        let conn = pool.lock().await;
        let mut rows = conn.query("SELECT id FROM employees LIMIT 1", ()).await.unwrap();
        let emp_id: i64 = rows.next().await.unwrap().unwrap().get(0).unwrap();
        drop(conn);

        let d = today();
        log_helper_day(&pool, emp_id, &d, 1.0, Some("pagi")).await.unwrap();
        // Upsert same date: replaces instead of duplicating
        log_helper_day(&pool, emp_id, &d, 0.5, None).await.unwrap();

        let summary = get_helper_daily_logs(&pool, emp_id, &d, &d).await.unwrap();
        assert_eq!(summary.logs.len(), 1);
        assert!((summary.total_days - 0.5).abs() < 0.01);
        assert!((summary.total_amount - 50_000.0).abs() < 0.01);
    }

    #[tokio::test]
    async fn helper_gets_no_commission() {
        let pool = setup().await;
        add_employee(&pool, CreateEmployeeInput {
            name: "Asisten".into(),
            role: "helper".into(),
            phone: None,
            base_salary: None,
            daily_rate: Some(100_000.0),
        }).await.unwrap();
        let conn = pool.lock().await;
        let mut rows = conn.query("SELECT id FROM mechanics LIMIT 1", ()).await.unwrap();
        let mech_id: i64 = rows.next().await.unwrap().unwrap().get(0).unwrap();
        drop(rows);
        drop(conn);

        create_transaction(&pool, CreateTransactionInput {
            vehicle_plate: "B 2".into(),
            customer_name: None,
            queue_number: 1,
            mechanic_id: Some(mech_id),
            cashier_name: "Admin".into(),
            subtotal: 80_000.0,
            discount: 0.0,
            total_amount: 80_000.0,
            paid_amount: 80_000.0,
            change_amount: 0.0,
            payment_method: "Cash".into(),
            details: vec![CreateTransactionDetailInput {
                item_type: "layanan".into(),
                item_name: "Ganti Oli".into(),
                quantity: 1,
                unit_price: 80_000.0,
                total_price: 80_000.0,
                sparepart_id: None,
                service_type: None,
            }],
        }).await.unwrap();

        let conn = pool.lock().await;
        let mut rows = conn.query("SELECT COUNT(*) FROM mechanic_commissions", ()).await.unwrap();
        let count: i64 = rows.next().await.unwrap().unwrap().get(0).unwrap();
        assert_eq!(count, 0);
    }

    #[tokio::test]
    async fn weekly_payroll_preview_override_and_save() {
        let pool = setup().await;
        add_employee(&pool, CreateEmployeeInput {
            name: "Budi".into(),
            role: "mechanic".into(),
            phone: None,
            base_salary: Some(1_500_000.0),
            daily_rate: None,
        }).await.unwrap();
        add_employee(&pool, CreateEmployeeInput {
            name: "Asisten".into(),
            role: "helper".into(),
            phone: None,
            base_salary: None,
            daily_rate: Some(100_000.0),
        }).await.unwrap();

        let conn = pool.lock().await;
        let mut rows = conn.query("SELECT id, employee_id FROM mechanics WHERE name = 'Budi'", ()).await.unwrap();
        let row = rows.next().await.unwrap().unwrap();
        let mech_id: i64 = row.get(0).unwrap();
        let budi_emp_id: i64 = row.get(1).unwrap();
        drop(rows);
        let mut rows = conn.query("SELECT id FROM employees WHERE name = 'Asisten'", ()).await.unwrap();
        let helper_id: i64 = rows.next().await.unwrap().unwrap().get(0).unwrap();
        drop(conn);

        create_transaction(&pool, CreateTransactionInput {
            vehicle_plate: "B 3".into(),
            customer_name: None,
            queue_number: 1,
            mechanic_id: Some(mech_id),
            cashier_name: "Admin".into(),
            subtotal: 200_000.0,
            discount: 0.0,
            total_amount: 200_000.0,
            paid_amount: 200_000.0,
            change_amount: 0.0,
            payment_method: "Cash".into(),
            details: vec![CreateTransactionDetailInput {
                item_type: "layanan".into(),
                item_name: "Tune Up".into(),
                quantity: 1,
                unit_price: 200_000.0,
                total_price: 200_000.0,
                sparepart_id: None,
                service_type: None,
            }],
        }).await.unwrap();

        let d = today();
        log_helper_day(&pool, helper_id, &d, 1.0, None).await.unwrap();

        let (week_from, week_to) = this_week();

        let preview = get_weekly_payroll_preview(&pool, &week_from, &week_to).await.unwrap();
        assert_eq!(preview.len(), 2);

        let budi = preview.iter().find(|p| p.employee_id == budi_emp_id).unwrap();
        assert!((budi.commission_ref - 0.0).abs() < 0.01);
        // base_amount = weekly_base_salary (1_500_000 / 4 = 375_000) + commission_ref (0)
        assert!((budi.base_amount - 375_000.0).abs() < 0.01);

        let helper = preview.iter().find(|p| p.employee_id == helper_id).unwrap();
        assert!((helper.total_days - 1.0).abs() < 0.01);
        assert!((helper.base_amount - 100_000.0).abs() < 0.01);

        // Manual commission edit from the commission report feeds the preview
        let conn = pool.lock().await;
        let mut rows = conn
            .query("SELECT id FROM transaction_details WHERE item_name = 'Tune Up'", ())
            .await
            .unwrap();
        let td_id: i64 = rows.next().await.unwrap().unwrap().get(0).unwrap();
        drop(conn);
        save_commission_line_override(&pool, "transaction_detail", td_id, budi_emp_id, 150_000.0, Some("kesepakatan")).await.unwrap();

        let preview = get_weekly_payroll_preview(&pool, &week_from, &week_to).await.unwrap();
        let budi = preview.iter().find(|p| p.employee_id == budi_emp_id).unwrap();
        // base_amount = weekly_base_salary (375_000) + commission_ref (150_000) = 525_000
        assert!((budi.base_amount - 525_000.0).abs() < 0.01);

        // Commission summary shows the per-line override as well
        let summary = get_weekly_commission_summary(&pool, budi_emp_id, &week_from, &week_to).await.unwrap();
        assert_eq!(summary.lines.len(), 1);
        assert!((summary.system_amount - 0.0).abs() < 0.01);
        assert!((summary.effective_total - 150_000.0).abs() < 0.01);
        assert!(summary.lines[0].is_edited);

        // Save with a corrected final amount, then mark paid
        save_weekly_payroll(&pool, budi_emp_id, &week_from, &week_to, 150_000.0, "draft", Some("koreksi"), None).await.unwrap();
        let saved = get_weekly_payrolls(&pool, &week_from).await.unwrap();
        assert_eq!(saved.len(), 1);
        assert_eq!(saved[0].status, "draft");
        assert!((saved[0].final_amount - 150_000.0).abs() < 0.01);
        assert_eq!(saved[0].date_from, week_from);
        assert_eq!(saved[0].date_to, week_to);

        save_weekly_payroll(&pool, budi_emp_id, &week_from, &week_to, 150_000.0, "paid", None, None).await.unwrap();
        let saved = get_weekly_payrolls(&pool, &week_from).await.unwrap();
        assert_eq!(saved[0].status, "paid");
        assert!(saved[0].paid_at.is_some());
    }

    #[tokio::test]
    async fn helper_commission_summary_lists_daily_logs() {
        let pool = setup().await;
        add_employee(&pool, CreateEmployeeInput {
            name: "Asisten".into(),
            role: "helper".into(),
            phone: None,
            base_salary: None,
            daily_rate: Some(100_000.0),
        }).await.unwrap();
        let conn = pool.lock().await;
        let mut rows = conn.query("SELECT id FROM employees LIMIT 1", ()).await.unwrap();
        let emp_id: i64 = rows.next().await.unwrap().unwrap().get(0).unwrap();
        drop(conn);

        let d = today();
        log_helper_day(&pool, emp_id, &d, 2.0, Some("bongkar")).await.unwrap();

        let summary = get_weekly_commission_summary(&pool, emp_id, &d, &d).await.unwrap();
        assert_eq!(summary.role, "helper");
        assert_eq!(summary.lines.len(), 1);
        assert!((summary.system_amount - 200_000.0).abs() < 0.01);
    }

    #[tokio::test]
    async fn log_helper_day_rejects_non_helper() {
        let pool = setup().await;
        add_employee(&pool, CreateEmployeeInput {
            name: "Budi".into(),
            role: "mechanic".into(),
            phone: None,
            base_salary: None,
            daily_rate: None,
        }).await.unwrap();
        let conn = pool.lock().await;
        let mut rows = conn.query("SELECT id FROM employees LIMIT 1", ()).await.unwrap();
        let emp_id: i64 = rows.next().await.unwrap().unwrap().get(0).unwrap();
        drop(conn);

        let err = log_helper_day(&pool, emp_id, &today(), 1.0, None).await;
        assert!(err.is_err());
    }
}
