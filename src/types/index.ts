export interface Settings {
  id: number;
  shop_name: string | null;
  shop_address: string | null;
  receipt_footer: string | null;
  printer_name: string | null;
  paper_width: number | null;
}

export interface Mechanic {
  id: number;
  name: string;
  is_active: number;
}

export interface Sparepart {
  id: number;
  name: string;
  buy_price: number;
  sell_price: number;
  stock: number;
  is_active: number;
}

export interface Service {
  id: number;
  name: string;
  price: number;
}

export interface Transaction {
  id: number;
  invoice_number: string;
  queue_number: number | null;
  customer_name: string | null;
  vehicle_plate: string;
  mechanic_id: number | null;
  cashier_name: string;
  subtotal: number;
  discount: number;
  total_amount: number;
  paid_amount: number;
  change_amount: number;
  payment_method: string;
  status: string;
  transaction_date: string;
  mechanic_name?: string;
}

export interface TransactionDetail {
  id: number;
  transaction_id: number;
  item_type: 'layanan' | 'sparepart';
  item_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface CreateTransactionInput {
  vehicle_plate: string;
  customer_name: string | null;
  queue_number: number | null;
  mechanic_id: number | null;
  cashier_name: string;
  subtotal: number;
  discount: number;
  total_amount: number;
  paid_amount: number;
  change_amount: number;
  payment_method: string;
  details: CreateTransactionDetailInput[];
}

export interface CreateTransactionDetailInput {
  item_type: 'layanan' | 'sparepart';
  item_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  sparepart_id?: number | null;
  service_id?: number | null;
}

export interface TransactionOutput {
  id: number;
  invoice_number: string;
  transaction_date: string;
}

export interface CartItem {
  id: string;
  item_type: 'layanan' | 'sparepart';
  item_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  sparepart_id?: number;
  service_id?: number;
}

export interface StockMovement {
  id: number;
  sparepart_id: number;
  movement_type: 'in' | 'out' | 'adjustment' | 'void_restore';
  quantity: number;
  reference_type: 'transaction' | 'adjustment' | 'void' | null;
  reference_id: number | null;
  reason: string | null;
  created_at: string;
}

export interface StockAdjustmentInput {
  sparepart_id: number;
  delta: number;
  reason: string;
}

export interface SearchResult<T> {
  data: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface HistoryFilters {
  date_from?: string;
  date_to?: string;
  search?: string;
  page: number;
  page_size: number;
}

export interface PrinterInfo {
  name: string;
  is_default: boolean;
}

export type ItemType = 'layanan' | 'sparepart';

export type PaymentMethod = 'Cash' | 'QRIS' | 'Transfer';

export type TransactionStatus = 'Lunas' | 'Batal' | 'Pending';