import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Sparepart, StockMovement, StockAdjustmentInput } from '@/types';
import { dbGetSpareparts, dbSearchSpareparts, dbAdjustStock, dbGetStockMovements } from '@/hooks/useDatabase';

interface InventoryState {
  spareparts: Sparepart[];
  stockMovements: StockMovement[];
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  
  loadSpareparts: () => Promise<void>;
  searchSpareparts: (query: string) => Promise<Sparepart[]>;
  adjustStock: (input: StockAdjustmentInput) => Promise<Sparepart>;
  loadStockMovements: (sparepartId?: number) => Promise<void>;
  getLowStockItems: () => Sparepart[];
}

export const useInventoryStore = create<InventoryState>()(
  devtools(
    (set, get) => ({
      spareparts: [],
      stockMovements: [],
      isLoading: false,
      error: null,
      searchQuery: '',

      loadSpareparts: async () => {
        set({ isLoading: true, error: null });
        try {
          const spareparts = await dbGetSpareparts(false); // Include inactive
          set({ spareparts, isLoading: false });
        } catch {
          set({ error: 'Gagal memuat sparepart', isLoading: false });
        }
      },

      searchSpareparts: async (query) => {
        return await dbSearchSpareparts(query);
      },

      adjustStock: async (input) => {
        set({ isLoading: true, error: null });
        try {
          const updated = await dbAdjustStock(input.sparepart_id, input.delta, input.reason);
          set((state) => ({
            spareparts: state.spareparts.map((s) => (s.id === input.sparepart_id ? updated : s)),
            isLoading: false,
          }));
          return updated;
        } catch (err) {
          set({ error: 'Gagal menyesuaikan stok', isLoading: false });
          throw err;
        }
      },

      loadStockMovements: async (sparepartId) => {
        set({ isLoading: true, error: null });
        try {
          const movements = await dbGetStockMovements(sparepartId);
          set({ stockMovements: movements, isLoading: false });
        } catch {
          set({ error: 'Gagal memuat riwayat stok', isLoading: false });
        }
      },

      getLowStockItems: () => {
        return get().spareparts.filter((s) => s.stock <= 5 && s.is_active === 1);
      },
    }),
    { name: 'inventory-store' }
  )
);
