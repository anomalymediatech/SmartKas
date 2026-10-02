import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Transaction, TransactionDetail, HistoryFilters, SearchResult } from '@/types';
import { dbGetTransactions, dbGetTransactionDetails, dbVoidTransaction } from '@/hooks/useDatabase';

interface HistoryState {
  transactions: Transaction[];
  selectedTransaction: Transaction | null;
  selectedDetails: TransactionDetail[];
  filters: HistoryFilters;
  isLoading: boolean;
  error: string | null;
  totalCount: number;
  
  loadTransactions: () => Promise<void>;
  setFilters: (filters: Partial<HistoryFilters>) => void;
  selectTransaction: (transaction: Transaction | null) => Promise<void>;
  voidTransaction: (transactionId: number) => Promise<boolean>;
  refresh: () => Promise<void>;
}

const initialFilters: HistoryFilters = {
  date_from: undefined,
  date_to: undefined,
  search: '',
  page: 1,
  page_size: 50,
};

export const useHistoryStore = create<HistoryState>()(
  devtools(
    (set, get) => ({
      transactions: [],
      selectedTransaction: null,
      selectedDetails: [],
      filters: initialFilters,
      isLoading: false,
      error: null,
      totalCount: 0,

      loadTransactions: async () => {
        set({ isLoading: true, error: null });
        try {
          const result = await dbGetTransactions(get().filters);
          set({ 
            transactions: result.data, 
            totalCount: result.total,
            isLoading: false 
          });
        } catch (err) {
          set({ error: 'Gagal memuat riwayat transaksi', isLoading: false });
        }
      },

      setFilters: (filters) => {
        set((state) => ({
          filters: { ...state.filters, ...filters, page: 1 },
        }));
        get().loadTransactions();
      },

      selectTransaction: async (transaction) => {
        if (!transaction) {
          set({ selectedTransaction: null, selectedDetails: [] });
          return;
        }
        
        set({ selectedTransaction: transaction, isLoading: true });
        try {
          const details = await dbGetTransactionDetails(transaction.id);
          set({ selectedDetails: details, isLoading: false });
        } catch (err) {
          set({ error: 'Gagal memuat detail transaksi', isLoading: false });
        }
      },

      voidTransaction: async (transactionId) => {
        set({ isLoading: true, error: null });
        try {
          await dbVoidTransaction(transactionId);
          // Reload transactions to update status
          await get().loadTransactions();
          set({ isLoading: false });
          return true;
        } catch (err) {
          set({ error: 'Gagal membatalkan transaksi', isLoading: false });
          return false;
        }
      },

      refresh: async () => {
        await get().loadTransactions();
      },
    }),
    { name: 'history-store' }
  )
);