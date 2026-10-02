import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { Settings, Mechanic, Sparepart, Service } from '@/types';
import { 
  dbGetSettings, 
  dbUpdateSettings, 
  dbGetMechanics, 
  dbCreateMechanic, 
  dbUpdateMechanic, 
  dbDeleteMechanic, 
  dbToggleMechanicActive,
  dbGetSpareparts,
  dbSearchSpareparts,
  dbCreateSparepart,
  dbUpdateSparepart,
  dbDeleteSparepart,
  dbAdjustStock,
  dbGetServices,
  dbSearchServices,
  dbCreateService,
  dbUpdateService,
  dbDeleteService,
} from '@/hooks/useDatabase';
import { useToast } from '@/hooks/useToast';

interface AppState {
  settings: Settings | null;
  mechanics: Mechanic[];
  spareparts: Sparepart[];
  services: Service[];
  isLoading: boolean;
  error: string | null;
  
  // Settings
  loadSettings: () => Promise<void>;
  updateSettings: (settings: Partial<Settings>) => Promise<void>;
  
  // Mechanics
  loadMechanics: (activeOnly?: boolean) => Promise<void>;
  addMechanic: (name: string) => Promise<Mechanic>;
  updateMechanic: (id: number, name: string) => Promise<void>;
  deleteMechanic: (id: number) => Promise<void>;
  toggleMechanicActive: (id: number, isActive: number) => Promise<void>;
  
  // Spareparts
  loadSpareparts: (activeOnly?: boolean) => Promise<void>;
  searchSpareparts: (query: string) => Promise<Sparepart[]>;
  addSparepart: (data: Omit<Sparepart, 'id'>) => Promise<Sparepart>;
  updateSparepart: (id: number, data: Partial<Sparepart>) => Promise<void>;
  deleteSparepart: (id: number) => Promise<void>;
  adjustStock: (sparepartId: number, delta: number, reason: string) => Promise<Sparepart>;
  
  // Services
  loadServices: (activeOnly?: boolean) => Promise<void>;
  searchServices: (query: string) => Promise<Service[]>;
  addService: (data: Omit<Service, 'id'>) => Promise<Service>;
  updateService: (id: number, data: Partial<Service>) => Promise<void>;
  deleteService: (id: number) => Promise<void>;
  
  // Initialize all
  initializeApp: () => Promise<void>;
}

export const useAppStore = create<AppState>()(
  devtools(
    (set, get) => ({
      settings: null,
      mechanics: [],
      spareparts: [],
      services: [],
      isLoading: false,
      error: null,

      // Settings
      loadSettings: async () => {
        set({ isLoading: true, error: null });
        try {
          const settings = await dbGetSettings();
          set({ settings, isLoading: false });
        } catch (err) {
          set({ error: 'Gagal memuat pengaturan', isLoading: false });
          throw err;
        }
      },

      updateSettings: async (settings) => {
        set({ isLoading: true, error: null });
        try {
          const updated = await dbUpdateSettings(settings);
          set({ settings: updated, isLoading: false });
        } catch (err) {
          set({ error: 'Gagal menyimpan pengaturan', isLoading: false });
          throw err;
        }
      },

      // Mechanics
      loadMechanics: async (activeOnly = true) => {
        set({ isLoading: true, error: null });
        try {
          const mechanics = await dbGetMechanics(activeOnly);
          set({ mechanics, isLoading: false });
        } catch (err) {
          set({ error: 'Gagal memuat daftar mekanik', isLoading: false });
        }
      },

      addMechanic: async (name) => {
        set({ isLoading: true, error: null });
        try {
          const mechanic = await dbCreateMechanic(name);
          set((state) => ({ mechanics: [...state.mechanics, mechanic], isLoading: false }));
          return mechanic;
        } catch (err) {
          set({ error: 'Gagal menambah mekanik', isLoading: false });
          throw err;
        }
      },

      updateMechanic: async (id, name) => {
        set({ isLoading: true, error: null });
        try {
          const updated = await dbUpdateMechanic(id, name);
          set((state) => ({
            mechanics: state.mechanics.map((m) => (m.id === id ? updated : m)),
            isLoading: false,
          }));
        } catch (err) {
          set({ error: 'Gagal memperbarui mekanik', isLoading: false });
          throw err;
        }
      },

      deleteMechanic: async (id) => {
        set({ isLoading: true, error: null });
        try {
          await dbDeleteMechanic(id);
          set((state) => ({
            mechanics: state.mechanics.filter((m) => m.id !== id),
            isLoading: false,
          }));
        } catch (err) {
          set({ error: 'Gagal menghapus mekanik', isLoading: false });
          throw err;
        }
      },

      toggleMechanicActive: async (id, isActive) => {
        set({ isLoading: true, error: null });
        try {
          await dbToggleMechanicActive(id, isActive);
          set((state) => ({
            mechanics: state.mechanics.map((m) => (m.id === id ? { ...m, is_active: isActive } : m)),
            isLoading: false,
          }));
        } catch (err) {
          set({ error: 'Gagal mengubah status mekanik', isLoading: false });
          throw err;
        }
      },

      // Spareparts
      loadSpareparts: async (activeOnly = true) => {
        set({ isLoading: true, error: null });
        try {
          const spareparts = await dbGetSpareparts(activeOnly);
          set({ spareparts, isLoading: false });
        } catch (err) {
          set({ error: 'Gagal memuat sparepart', isLoading: false });
        }
      },

      searchSpareparts: async (query) => {
        return await dbSearchSpareparts(query);
      },

      addSparepart: async (data) => {
        set({ isLoading: true, error: null });
        try {
          const sparepart = await dbCreateSparepart(data);
          set((state) => ({ spareparts: [...state.spareparts, sparepart], isLoading: false }));
          return sparepart;
        } catch (err) {
          set({ error: 'Gagal menambah sparepart', isLoading: false });
          throw err;
        }
      },

      updateSparepart: async (id, data) => {
        set({ isLoading: true, error: null });
        try {
          const updated = await dbUpdateSparepart(id, data);
          set((state) => ({
            spareparts: state.spareparts.map((s) => (s.id === id ? updated : s)),
            isLoading: false,
          }));
        } catch (err) {
          set({ error: 'Gagal memperbarui sparepart', isLoading: false });
          throw err;
        }
      },

      deleteSparepart: async (id) => {
        set({ isLoading: true, error: null });
        try {
          await dbDeleteSparepart(id);
          set((state) => ({
            spareparts: state.spareparts.filter((s) => s.id !== id),
            isLoading: false,
          }));
        } catch (err) {
          set({ error: 'Gagal menghapus sparepart', isLoading: false });
          throw err;
        }
      },

      adjustStock: async (sparepartId, delta, reason) => {
        set({ isLoading: true, error: null });
        try {
          const updated = await dbAdjustStock(sparepartId, delta, reason);
          set((state) => ({
            spareparts: state.spareparts.map((s) => (s.id === sparepartId ? updated : s)),
            isLoading: false,
          }));
          return updated;
        } catch (err) {
          set({ error: 'Gagal menyesuaikan stok', isLoading: false });
          throw err;
        }
      },

      // Services
      loadServices: async (activeOnly = true) => {
        set({ isLoading: true, error: null });
        try {
          const services = await dbGetServices(activeOnly);
          set({ services, isLoading: false });
        } catch (err) {
          set({ error: 'Gagal memuat layanan', isLoading: false });
        }
      },

      searchServices: async (query) => {
        return await dbSearchServices(query);
      },

      addService: async (data) => {
        set({ isLoading: true, error: null });
        try {
          const service = await dbCreateService(data);
          set((state) => ({ services: [...state.services, service], isLoading: false }));
          return service;
        } catch (err) {
          set({ error: 'Gagal menambah layanan', isLoading: false });
          throw err;
        }
      },

      updateService: async (id, data) => {
        set({ isLoading: true, error: null });
        try {
          const updated = await dbUpdateService(id, data);
          set((state) => ({
            services: state.services.map((s) => (s.id === id ? updated : s)),
            isLoading: false,
          }));
        } catch (err) {
          set({ error: 'Gagal memperbarui layanan', isLoading: false });
          throw err;
        }
      },

      deleteService: async (id) => {
        set({ isLoading: true, error: null });
        try {
          await dbDeleteService(id);
          set((state) => ({
            services: state.services.filter((s) => s.id !== id),
            isLoading: false,
          }));
        } catch (err) {
          set({ error: 'Gagal menghapus layanan', isLoading: false });
          throw err;
        }
      },

      initializeApp: async () => {
        set({ isLoading: true, error: null });
        try {
          await Promise.all([
            get().loadSettings(),
            get().loadMechanics(),
            get().loadSpareparts(),
            get().loadServices(),
          ]);
          set({ isLoading: false });
        } catch (err) {
          set({ error: 'Gagal menginisialisasi aplikasi', isLoading: false });
        }
      },
    }),
    { name: 'app-store' }
  )
);