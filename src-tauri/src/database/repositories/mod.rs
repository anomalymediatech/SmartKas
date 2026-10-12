pub mod mechanics;
pub mod spareparts;
pub mod services;
pub mod transactions;
pub mod settings;
pub mod dashboard;
pub mod vehicle;
pub mod employees;
pub mod supplies;
pub mod payroll;

/// Build a SQL fragment filtering a table alias by local transaction date range.
/// Returns (fragment, values) to be appended to a query and its positional params.
pub(crate) fn date_range_filter(
    alias: &str,
    date_from: Option<&str>,
    date_to: Option<&str>,
) -> (String, Vec<libsql::Value>) {
    let mut fragment = String::new();
    let mut values = Vec::new();
    if let Some(from) = date_from {
        fragment.push_str(&format!(" AND date({alias}.transaction_date, 'localtime') >= date(?)"));
        values.push(from.into());
    }
    if let Some(to) = date_to {
        fragment.push_str(&format!(" AND date({alias}.transaction_date, 'localtime') <= date(?)"));
        values.push(to.into());
    }
    (fragment, values)
}
