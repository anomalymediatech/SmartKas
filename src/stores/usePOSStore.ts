import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { CartItem, Mechanic } from '@/types';
import { dbCreateTransaction } from '@/hooks/useDatabase';

interface POSState {
  // Customer/Vehicle Input
  vehiclePlate: string;
  customerName: string;
  queueNumber: number;
  mechanicId: number | null;
  mechanics: Mechanic[];
  
  // Cart - STRICTLY SEPARATED
  layananItems: CartItem[];
  sparepartItems: CartItem[];
  
  // Calculations
  discount: number;
  paidAmount: number;
  
  // UI State
  isProcessing: boolean;
  vehiclePlateSuggestions: string[];
  showVehiclePlateDropdown: boolean;
  showCustomerNameDropdown: boolean;
  customerNameSuggestions: string[];
  
  // Focus refs (for keyboard shortcuts)
  focusRefs: {
    vehiclePlate: React.RefObject<HTMLInputElement> | null;
    customerName: React.RefObject<HTMLInputElement> | null;
    queueNumber: React.RefObject<HTMLInputElement> | null;
    mechanic: React.RefObject<HTMLSelectElement> | null;
    layananSearch: React.RefObject<HTMLInputElement> | null;
    sparepartSearch: React.RefObject<HTMLInputElement> | null;
    discount: React.RefObject<HTMLInputElement> | null;
    paidAmount: React.RefObject<HTMLInputElement> | null;
  };
  
  // Actions - Customer/Vehicle
  setVehiclePlate: (plate: string) => void;
  setCustomerName: (name: string) => void;
  setQueueNumber: (num: number) => void;
  setMechanicId: (id: number | null) => void;
  setMechanics: (mechanics: Mechanic[]) => void;
  setVehiclePlateSuggestions: (suggestions: string[]) => void;
  setShowVehiclePlateDropdown: (show: boolean) => void;
  setCustomerNameSuggestions: (suggestions: string[]) => void;
  setShowCustomerNameDropdown: (show: boolean) => void;
  
  // Focus setters
  setVehiclePlateFocus: () => void;
  setCustomerNameFocus: () => void;
  setQueueNumberFocus: () => void;
  setMechanicFocus: () => void;
  setDiscountFocus: () => void;
  setPaidAmountFocus: () => void;
  setLayananSearchFocus: () => void;
  setSparepartSearchFocus: () => void;
  setFocusRef: (key: keyof POSState['focusRefs'], ref: React.RefObject<HTMLInputElement | HTMLSelectElement | null> | null) => void;
  
  // Actions - Layanan
  addLayanan: (item: Omit<CartItem, 'id'>) => void;
  updateLayananPrice: (index: number, price: number) => void;
  updateLayananQty: (index: number, qty: number) => void;
  removeLayanan: (index: number) => void;
  clearLayanan: () => void;
  
  // Actions - Sparepart (with stock sync)
  addSparepart: (item: Omit<CartItem, 'id'>, currentStock: number) => Promise<boolean>;
  updateSparepartQty: (index: number, qty: number, currentStock: number) => Promise<boolean>;
  updateSparepartPrice: (index: number, price: number) => void;
  removeSparepart: (index: number) => void;
  clearSparepart: () => void;
  
  // Actions - Payment
  setDiscount: (amount: number) => void;
  setPaidAmount: (amount: number) => void;
  
  // Computed (via getters)
  getSubtotalLayanan: () => number;
  getSubtotalSparepart: () => number;
  getSubtotal: () => number;
  getTotalAmount: () => number;
  getChangeAmount: () => number;
  canCheckout: () => boolean;
  
  // Checkout
  checkout: () => Promise<{ success: boolean; transactionId?: number; invoiceNumber?: string }>;
  
  // Reset
  resetPOS: () => void;
  loadNextQueueNumber: () => Promise<void>;
}

const initialState = {
  vehiclePlate: '',
  customerName: '',
  queueNumber: 1,
  mechanicId: null,
  mechanics: [],
  layananItems: [],
  sparepartItems: [],
  discount: 0,
  paidAmount: 0,
  isProcessing: false,
  vehiclePlateSuggestions: [],
  showVehiclePlateDropdown: false,
  customerNameSuggestions: [],
  showCustomerNameDropdown: false,
  focusRefs: {
    vehiclePlate: null,
    customerName: null,
    queueNumber: null,
    mechanic: null,
    layananSearch: null,
    sparepartSearch: null,
    discount: null,
    paidAmount: null,
  },
};

export const usePOSStore = create<POSState>()(
  devtools(
    (set, get) => ({
      ...initialState,

      // Customer/Vehicle
      setVehiclePlate: (plate) => set({ vehiclePlate: plate.toUpperCase() }),
      setCustomerName: (name) => set({ customerName: name }),
      setQueueNumber: (num) => set({ queueNumber: num }),
      setMechanicId: (id) => set({ mechanicId: id }),
      setMechanics: (mechanics) => set({ mechanics }),
      setVehiclePlateSuggestions: (suggestions) => set({ vehiclePlateSuggestions: suggestions }),
      setShowVehiclePlateDropdown: (show) => set({ showVehiclePlateDropdown: show }),
      setCustomerNameSuggestions: (suggestions) => set({ customerNameSuggestions: suggestions }),
      setShowCustomerNameDropdown: (show) => set({ showCustomerNameDropdown: show }),

      // Focus setters
      setVehiclePlateFocus: () => get().focusRefs.vehiclePlate?.current?.focus(),
      setCustomerNameFocus: () => get().focusRefs.customerName?.current?.focus(),
      setQueueNumberFocus: () => get().focusRefs.queueNumber?.current?.focus(),
      setMechanicFocus: () => get().focusRefs.mechanic?.current?.focus(),
      setDiscountFocus: () => get().focusRefs.discount?.current?.focus(),
      setPaidAmountFocus: () => get().focusRefs.paidAmount?.current?.focus(),
      setLayananSearchFocus: () => get().focusRefs.layananSearch?.current?.focus(),
      setSparepartSearchFocus: () => get().focusRefs.sparepartSearch?.current?.focus(),
      setFocusRef: (key, ref) => set((state) => ({
        focusRefs: { ...state.focusRefs, [key]: ref }
      })),

      // Layanan actions
      addLayanan: (item) => set((state) => ({
        layananItems: [...state.layananItems, { ...item, id: crypto.randomUUID() }],
      })),

      updateLayananPrice: (index, price) => set((state) => {
        const items = [...state.layananItems];
        if (items[index]) {
          items[index] = {
            ...items[index],
            unit_price: price,
            total_price: price * items[index].quantity,
          };
        }
        return { layananItems: items };
      }),

      updateLayananQty: (index, qty) => set((state) => {
        const items = [...state.layananItems];
        if (items[index] && qty > 0) {
          items[index] = {
            ...items[index],
            quantity: qty,
            total_price: items[index].unit_price * qty,
          };
        }
        return { layananItems: items };
      }),

      removeLayanan: (index) => set((state) => ({
        layananItems: state.layananItems.filter((_, i) => i !== index),
      })),

      clearLayanan: () => set({ layananItems: [] }),

      // Sparepart actions (with stock validation)
      addSparepart: async (item, currentStock) => {
        if (item.quantity > currentStock) {
          return false;
        }
        set((state) => ({
          sparepartItems: [...state.sparepartItems, { ...item, id: crypto.randomUUID() }],
        }));
        return true;
      },

      updateSparepartQty: async (index, qty, currentStock) => {
        const state = get();
        const item = state.sparepartItems[index];
        if (!item) return false;
        
        // Calculate available stock (current stock + qty already in cart)
        const availableStock = currentStock + item.quantity;
        if (qty > availableStock) {
          return false;
        }
        
        set((state) => {
          const items = [...state.sparepartItems];
          if (items[index]) {
            items[index] = {
              ...items[index],
              quantity: qty,
              total_price: items[index].unit_price * qty,
            };
          }
          return { sparepartItems: items };
        });
        return true;
      },

      updateSparepartPrice: (index, price) => set((state) => {
        const items = [...state.sparepartItems];
        if (items[index]) {
          items[index] = {
            ...items[index],
            unit_price: price,
            total_price: price * items[index].quantity,
          };
        }
        return { sparepartItems: items };
      }),

      removeSparepart: (index) => set((state) => ({
        sparepartItems: state.sparepartItems.filter((_, i) => i !== index),
      })),

      clearSparepart: () => set({ sparepartItems: [] }),

      // Payment
      setDiscount: (amount) => {
        const subtotal = get().getSubtotal();
        set({ discount: Math.min(Math.max(0, amount), subtotal) });
      },
      setPaidAmount: (amount) => set({ paidAmount: Math.max(0, amount) }),

      // Computed
      getSubtotalLayanan: () => {
        return get().layananItems.reduce((sum, item) => sum + item.total_price, 0);
      },
      getSubtotalSparepart: () => {
        return get().sparepartItems.reduce((sum, item) => sum + item.total_price, 0);
      },
      getSubtotal: () => {
        return get().getSubtotalLayanan() + get().getSubtotalSparepart();
      },
      getTotalAmount: () => {
        return get().getSubtotal() - get().discount;
      },
      getChangeAmount: () => {
        return get().paidAmount - get().getTotalAmount();
      },
      canCheckout: () => {
        const state = get();
        return state.vehiclePlate.trim() !== '' &&
               state.mechanicId !== null &&
               state.paidAmount >= state.getTotalAmount() &&
               state.getTotalAmount() > 0;
      },

      // Checkout
      checkout: async () => {
        const state = get();
        if (!state.canCheckout()) {
          return { success: false };
        }

        set({ isProcessing: true });

        try {
          
          const details = [
            ...state.layananItems.map((item) => ({
              item_type: 'layanan' as const,
              item_name: item.item_name,
              quantity: item.quantity,
              unit_price: item.unit_price,
              total_price: item.total_price,
            })),
            ...state.sparepartItems.map((item) => ({
              item_type: 'sparepart' as const,
              item_name: item.item_name,
              quantity: item.quantity,
              unit_price: item.unit_price,
              total_price: item.total_price,
              sparepart_id: item.sparepart_id ?? null,
            })),
          ];

          const input = {
            vehicle_plate: state.vehiclePlate,
            customer_name: state.customerName || null,
            queue_number: state.queueNumber,
            mechanic_id: state.mechanicId,
            cashier_name: 'Admin',
            subtotal: state.getSubtotal(),
            discount: state.discount,
            total_amount: state.getTotalAmount(),
            paid_amount: state.paidAmount,
            change_amount: state.getChangeAmount(),
            payment_method: 'Cash',
            details,
          };

          const result = await dbCreateTransaction(input);
          
          set({ isProcessing: false });
          return { success: true, transactionId: result.id, invoiceNumber: result.invoice_number };
        } catch (err) {
          console.error('Checkout error:', err);
          set({ isProcessing: false });
          return { success: false };
        }
      },

      // Reset
      resetPOS: () => {
        set({
          ...initialState,
          queueNumber: get().queueNumber + 1,
        });
      },

      loadNextQueueNumber: async () => {
        // This will be implemented via a Tauri command to get max queue number for today
        // For now, just increment
        set((state) => ({ queueNumber: state.queueNumber + 1 }));
      },
    }),
    { name: 'pos-store' }
  )
);

