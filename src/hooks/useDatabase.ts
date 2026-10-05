import { invoke } from '@tauri-apps/api/core';
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
  await invoke('backup_database', { path });
}

export async function dbRestoreDatabase(path: string): Promise<void> {
  await invoke('restore_database', { path });
}