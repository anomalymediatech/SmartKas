import { invoke } from '@tauri-apps/api/core';

function getToken(): string {
  return localStorage.getItem('smartkas.session_token') ?? '';
}

import type { 
  Settings, 
  Mechanic, 
  Sparepart, 
  Service, 
  Transaction, 
  TransactionDetail,
  StockMovement,
  HistoryFilters,
  SearchResult,
  PrinterInfo,
  CreateTransactionInput,
  TransactionOutput,
} from '@/types';

export async function dbInit(): Promise<void> {
  await invoke('init_database');
}

export async function dbGetSettings(): Promise<Settings | null> {
  return await invoke('get_settings');
}

export async function dbUpdateSettings(settings: Partial<Settings>): Promise<Settings> {
  return await invoke('update_settings', { settings });
}

export async function dbUploadShopLogo(fileData: number[], extension: string): Promise<string> {
  return await invoke('upload_shop_logo', { fileData, extension });
}

export async function dbDeleteShopLogo(): Promise<void> {
  await invoke('delete_shop_logo');
}

export async function dbGetShopLogoPath(): Promise<string | null> {
  return await invoke('get_shop_logo_path');
}

export async function dbGetShopLogoBase64(): Promise<string | null> {
  return await invoke('get_shop_logo_base64');
}

export async function dbGetMechanics(activeOnly = true): Promise<Mechanic[]> {
  return await invoke('get_mechanics', { activeOnly });
}

export async function dbCreateMechanic(name: string): Promise<Mechanic> {
  return await invoke('create_mechanic', { name });
}

export async function dbUpdateMechanic(id: number, name: string): Promise<Mechanic> {
  return await invoke('update_mechanic', { id, name });
}

export async function dbDeleteMechanic(id: number): Promise<void> {
  await invoke('delete_mechanic', { id });
}

export async function dbToggleMechanicActive(id: number, isActive: number): Promise<void> {
  await invoke('toggle_mechanic_active', { id, isActive });
}

export async function dbGetSpareparts(activeOnly = true): Promise<Sparepart[]> {
  return await invoke('get_spareparts', { activeOnly });
}

export async function dbSearchSpareparts(query: string): Promise<Sparepart[]> {
  return await invoke('search_spareparts', { query });
}

export async function dbCreateSparepart(data: Omit<Sparepart, 'id'>): Promise<Sparepart> {
  return await invoke('create_sparepart', { data });
}

export async function dbUpdateSparepart(id: number, data: Partial<Sparepart>): Promise<Sparepart> {
  return await invoke('update_sparepart', { id, data });
}

export async function dbDeleteSparepart(id: number): Promise<void> {
  await invoke('delete_sparepart', { id });
}

export async function dbAdjustStock(sparepartId: number, delta: number, reason: string): Promise<Sparepart> {
  return await invoke('adjust_stock', { sparepartId, delta, reason });
}

export async function dbGetServices(activeOnly = true): Promise<Service[]> {
  return await invoke('get_services', { activeOnly });
}

export async function dbSearchServices(query: string): Promise<Service[]> {
  return await invoke('search_services', { query });
}

export async function dbCreateService(data: Omit<Service, 'id'>): Promise<Service> {
  return await invoke('create_service', { data });
}

export async function dbUpdateService(id: number, data: Partial<Service>): Promise<Service> {
  return await invoke('update_service', { id, data });
}

export async function dbDeleteService(id: number): Promise<void> {
  await invoke('delete_service', { id });
}

export async function dbCreateTransaction(input: CreateTransactionInput): Promise<TransactionOutput> {
  return await invoke('create_transaction', { input });
}

export async function dbVoidTransaction(transactionId: number): Promise<void> {
  await invoke('void_transaction', { transactionId });
}

export async function dbGetTransactions(filters: HistoryFilters): Promise<SearchResult<Transaction>> {
  return await invoke('get_transactions', { filters });
}

export async function dbGetTransactionDetails(transactionId: number): Promise<TransactionDetail[]> {
  return await invoke('get_transaction_details', { transactionId });
}

export async function dbGetStockMovements(sparepartId?: number): Promise<StockMovement[]> {
  return await invoke('get_stock_movements', { sparepartId });
}

export async function dbPrintReceipt(transactionId: number, printerName?: string, paperWidth?: number): Promise<Uint8Array> {
  const result = await invoke('print_receipt', { transactionId, printerName, paperWidth });
  return new Uint8Array(result as ArrayLike<number>);
}

export async function dbGetPrinters(): Promise<PrinterInfo[]> {
  return await invoke('get_printers');
}

export async function dbImportSpareparts(items: { name: string; buy_price: number | null; sell_price: number | null; stock: number | null }[]): Promise<[number, number]> {
  return await invoke<[number, number]>('import_spareparts', { items });
}

export async function dbImportServices(items: { name: string; price: number | null; service_type?: string }[]): Promise<[number, number]> {
  return await invoke<[number, number]>('import_services', { items });
}

export async function dbGetNextQueueNumber(): Promise<number> {
  return await invoke('get_next_queue_number');
}

export interface DailyCloseRow {
  payment_method: string;
  count: number;
  total: number;
}

export interface DailyCloseReport {
  rows: DailyCloseRow[];
  total_count: number;
  total_amount: number;
}

export async function dbGetDailyClose(date?: string): Promise<DailyCloseReport> {
  return await invoke('get_daily_close', { date: date ?? null });
}

export async function dbPrintDailyClose(date: string | undefined, printerName?: string, paperWidth?: number): Promise<void> {
  await invoke('print_daily_close', { date: date ?? null, printerName, paperWidth });
}

export interface ReceiptItem {
  item_type: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface ReceiptData {
  shop_name: string;
  shop_address: string;
  shop_logo: string | null;
  invoice_number: string;
  queue_number: number;
  customer_name: string;
  transaction_date: string;
  cashier_name: string;
  mechanic_name: string;
  layanan: ReceiptItem[];
  sparepart: ReceiptItem[];
  layanan_total: number;
  sparepart_total: number;
  subtotal: number;
  discount: number;
  total_amount: number;
  paid_amount: number;
  change_amount: number;
  status: string;
  payment_method: string;
  custom_message: string;
}

export async function dbGetReceiptData(transactionId: number): Promise<ReceiptData> {
  return await invoke('get_receipt_data', { transactionId });
}

export async function dbBackupDatabase(path: string): Promise<void> {
  await invoke('backup_database', { token: getToken(), path });
}

export async function dbRestoreDatabase(path: string): Promise<void> {
  await invoke('restore_database', { token: getToken(), path });
}

export interface DailySummary {
  total_omzet: number;
  total_transactions: number;
  total_voids: number;
  gross_profit: number;
}

export interface LowStockItem {
  id: number;
  name: string;
  stock: number;
  sell_price: number;
}

export interface MechanicPerformance {
  mechanic_name: string;
  services_handled: number;
}

export interface SalesTrendPoint {
  date: string;
  total_amount: number;
}

export interface TopSparepart {
  name: string;
  qty_sold: number;
  revenue: number;
  stock: number | null;
}

export async function dbGetDailySummary(date?: string): Promise<DailySummary> {
  return await invoke('get_daily_summary', { date: date ?? null });
}

export async function dbGetLowStockItems(threshold = 5): Promise<LowStockItem[]> {
  return await invoke('get_low_stock_items', { threshold });
}

export async function dbGetMechanicPerformance(dateFrom?: string, dateTo?: string): Promise<MechanicPerformance[]> {
  return await invoke('get_mechanic_performance', { dateFrom: dateFrom ?? null, dateTo: dateTo ?? null });
}

export async function dbGetSalesTrend(days = 7): Promise<SalesTrendPoint[]> {
  return await invoke('get_sales_trend', { days });
}

export async function dbGetTopSpareparts(days = 30, limit = 5): Promise<TopSparepart[]> {
  return await invoke('get_top_spareparts', { days, limit });
}

export interface VehicleVisit {
  id: number;
  invoice_number: string;
  transaction_date: string;
  mechanic_name: string | null;
  customer_name: string | null;
  total_amount: number;
  status: string;
  items: { item_type: string; item_name: string; quantity: number; unit_price: number; total_price: number }[];
}

export interface VehicleReminder {
  months_since_service: number;
  last_service_name: string;
  last_service_date: string;
  recommended_service: string;
}

export interface UpcomingReminder {
  vehicle_plate: string;
  customer_name: string | null;
  months_since_service: number;
  last_service_name: string;
  recommended_service: string;
}

export async function dbGetVehicleHistory(plateNumber: string): Promise<VehicleVisit[]> {
  return await invoke('get_vehicle_history', { plateNumber });
}

export async function dbGetVehicleReminder(plateNumber: string): Promise<VehicleReminder | null> {
  return await invoke('get_vehicle_reminder', { plateNumber });
}

export async function dbGetUpcomingReminders(): Promise<UpcomingReminder[]> {
  return await invoke('get_upcoming_reminders');
}

export async function dbSearchVehiclePlates(query: string): Promise<string[]> {
  return await invoke('search_vehicle_plates', { query });
}

export interface Employee {
  id: number;
  name: string;
  role: string;
  phone: string | null;
  base_salary: number;
  daily_rate: number;
  is_active: number;
}

export interface CreateEmployeeInput {
  name: string;
  role: string;
  phone?: string | null;
  base_salary?: number;
  daily_rate?: number;
}

export interface UpdateEmployeeInput {
  id: number;
  name: string;
  phone?: string | null;
  base_salary: number;
  daily_rate: number;
}

export interface MechanicCommissionSummary {
  mechanic_id: number;
  mechanic_name: string;
  services_count: number;
  total_services: number;
  total_commission: number;
}

export async function dbGetEmployees(): Promise<Employee[]> {
  return await invoke('get_employees', { token: getToken() });
}

export async function dbAddEmployee(data: CreateEmployeeInput): Promise<Employee> {
  return await invoke('add_employee', { token: getToken(), data });
}

export async function dbUpdateEmployee(data: UpdateEmployeeInput): Promise<Employee> {
  return await invoke('update_employee', { token: getToken(), data });
}

export async function dbDeleteEmployee(id: number): Promise<void> {
  await invoke('delete_employee', { token: getToken(), id });
}

export async function dbCalculateMechanicCommission(dateFrom?: string, dateTo?: string): Promise<MechanicCommissionSummary[]> {
  return await invoke('calculate_mechanic_commission', { token: getToken(), dateFrom: dateFrom ?? null, dateTo: dateTo ?? null });
}

export interface HelperDailyLog {
  id: number;
  employee_id: number;
  work_date: string;
  days: number;
  rate: number;
  note: string | null;
}

export interface HelperDailyLogSummary {
  employee_id: number;
  employee_name: string;
  daily_rate: number;
  total_days: number;
  total_amount: number;
  logs: HelperDailyLog[];
}

export interface PayrollRow {
  id: number;
  employee_id: number;
  employee_name: string;
  role: string;
  date_from: string;
  date_to: string;
  computed_amount: number;
  weekly_salary_override: number | null;
  final_amount: number;
  status: string;
  paid_at: string | null;
  note: string | null;
}

export interface WeeklyPayrollPreviewRow {
  employee_id: number;
  employee_name: string;
  role: string;
  daily_rate: number;
  base_salary: number;
  weekly_base_salary: number;
  total_services: number;
  commission_ref: number;
  total_days: number;
  daily_amount: number;
  base_amount: number;
  weekly_salary_override: number | null;
  existing: PayrollRow | null;
}

export interface WeeklyCommissionLine {
  line_id: number;
  line_kind: string;
  line_date: string;
  invoice_number: string | null;
  item_type: string | null;
  item_name: string;
  amount: number;
  system_commission: number;
  commission: number;
  is_edited: boolean;
}

export interface WeeklyCommissionSummary {
  employee_id: number;
  employee_name: string;
  role: string;
  total_services: number;
  system_amount: number;
  effective_total: number;
  lines: WeeklyCommissionLine[];
}

export async function dbGetHelperDailyLogs(employeeId: number, dateFrom: string, dateTo: string): Promise<HelperDailyLogSummary> {
  return await invoke('get_helper_daily_logs', { token: getToken(), employeeId, dateFrom, dateTo });
}

export async function dbLogHelperDay(employeeId: number, workDate: string, days: number, note?: string | null): Promise<HelperDailyLog> {
  return await invoke('log_helper_day', { token: getToken(), employeeId, workDate, days, note: note ?? null });
}

export async function dbDeleteHelperDay(id: number): Promise<void> {
  await invoke('delete_helper_day', { token: getToken(), id });
}

export async function dbGetWeeklyPayrollPreview(dateFrom: string, dateTo: string): Promise<WeeklyPayrollPreviewRow[]> {
  return await invoke('get_weekly_payroll_preview', { token: getToken(), dateFrom, dateTo });
}

export async function dbSaveWeeklyPayroll(
  employeeId: number,
  dateFrom: string,
  dateTo: string,
  finalAmount: number,
  status: string,
  note?: string | null,
  weeklySalaryOverride?: number | null
): Promise<PayrollRow> {
  return await invoke('save_weekly_payroll', { token: getToken(), employeeId, dateFrom, dateTo, finalAmount, status, note: note ?? null, weekly_salary_override: weeklySalaryOverride ?? null });
}

export async function dbGetWeeklyPayrolls(dateFrom: string): Promise<PayrollRow[]> {
  return await invoke('get_weekly_payrolls', { token: getToken(), dateFrom });
}

export async function dbGetWeeklyCommissionSummary(employeeId: number, dateFrom: string, dateTo: string): Promise<WeeklyCommissionSummary> {
  return await invoke('get_weekly_commission_summary', { token: getToken(), employeeId, dateFrom, dateTo });
}

export async function dbSaveCommissionLineOverride(
  lineKind: string,
  lineRefId: number,
  employeeId: number,
  amount: number,
  note?: string | null
): Promise<void> {
  await invoke('save_commission_line_override', { token: getToken(), lineKind, lineRefId, employeeId, amount, note: note ?? null });
}

export async function dbDeleteCommissionLineOverride(lineKind: string, lineRefId: number): Promise<void> {
  await invoke('delete_commission_line_override', { token: getToken(), lineKind, lineRefId });
}

export interface Supplier {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
  contact_person: string | null;
}

export interface PurchaseOrder {
  id: number;
  supplier_id: number;
  supplier_name: string | null;
  purchase_date: string;
  total_cost: number;
  status: string;
  created_by: string | null;
}

export async function dbGetSuppliers(): Promise<Supplier[]> {
  return await invoke('get_suppliers');
}

export async function dbCreateSupplier(data: { name: string; phone?: string | null; address?: string | null; contact_person?: string | null }): Promise<Supplier> {
  return await invoke('create_supplier', { data });
}

export async function dbCreatePurchaseOrder(data: { supplier_id: number; created_by?: string | null; items: { sparepart_id: number; quantity: number; unit_cost: number }[] }): Promise<PurchaseOrder> {
  return await invoke('create_purchase_order', { data });
}

export async function dbReceivePurchaseOrder(poId: number): Promise<void> {
  await invoke('receive_purchase_order', { poId });
}

export async function dbGetPurchaseOrders(status?: string): Promise<PurchaseOrder[]> {
  return await invoke('get_purchase_orders', { status: status ?? null });
}