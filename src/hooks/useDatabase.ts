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

export async function dbPrintReceipt(transactionId: number, printerName?: string, paperWidth = 80): Promise<Uint8Array> {
  const result = await invoke('print_receipt', { transactionId, printerName, paperWidth });
  return new Uint8Array(result as ArrayLike<number>);
}

export async function dbGetPrinters(): Promise<PrinterInfo[]> {
  return await invoke('get_printers');
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
  commission_rate: number;
  base_salary: number;
  is_active: number;
}

export interface CreateEmployeeInput {
  name: string;
  role: string;
  phone?: string | null;
  commission_rate?: number;
  base_salary?: number;
}

export interface MechanicCommissionSummary {
  mechanic_id: number;
  mechanic_name: string;
  services_count: number;
  total_services: number;
  total_commission: number;
}

export interface MechanicMonthlySummary {
  mechanic_id: number;
  mechanic_name: string;
  services_count: number;
  total_services: number;
  total_commission: number;
  lines: { service_name: string; invoice_number: string; transaction_date: string; price: number; commission: number }[];
}

export async function dbGetEmployees(): Promise<Employee[]> {
  return await invoke('get_employees', { token: getToken() });
}

export async function dbAddEmployee(data: CreateEmployeeInput): Promise<Employee> {
  return await invoke('add_employee', { token: getToken(), data });
}

export async function dbDeleteEmployee(id: number): Promise<void> {
  await invoke('delete_employee', { token: getToken(), id });
}

export async function dbCalculateMechanicCommission(dateFrom?: string, dateTo?: string): Promise<MechanicCommissionSummary[]> {
  return await invoke('calculate_mechanic_commission', { token: getToken(), dateFrom: dateFrom ?? null, dateTo: dateTo ?? null });
}

export async function dbGetMechanicMonthlySummary(employeeId: number, month: number, year: number): Promise<MechanicMonthlySummary> {
  return await invoke('get_mechanic_monthly_summary', { token: getToken(), employeeId, month, year });
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