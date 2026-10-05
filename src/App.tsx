import { useState, useEffect } from 'react';
import { AppLayout } from './components/layout';
import { MobileSidebar, MobileMenuButton } from './components/layout/Sidebar';
import { ToastContainer } from './components/ui';
import POSPage from './pages/POS';
import DashboardPage from './pages/Dashboard';
import SettingsPage from './pages/Settings';
import HistoryPage from './pages/History';
import InventoryPage from './pages/Inventory';
import EmployeesPage from './pages/Employees';
import PurchasesPage from './pages/Purchases';
import { useAppStore } from './stores';
import { dbPrintReceipt } from './hooks/useDatabase';
import { useToastStore } from './hooks/useToast';
import { useAuth } from './context/AuthContext';
import LoginPage from './pages/Login';

const pages = [
  { key: 'dashboard', label: 'Dashboard', component: DashboardPage, adminOnly: true },
  { key: 'pos', label: 'POS', component: POSPage, adminOnly: false },
  { key: 'history', label: 'Riwayat', component: HistoryPage, adminOnly: false },
  { key: 'inventory', label: 'Inventori', component: InventoryPage, adminOnly: false },
  { key: 'employees', label: 'Karyawan', component: EmployeesPage, adminOnly: true },
  { key: 'purchases', label: 'Pembelian', component: PurchasesPage, adminOnly: true },
  { key: 'settings', label: 'Pengaturan', component: SettingsPage, adminOnly: false },
];

function App() {
  console.log('✅ App Component Rendered');
  const { user, isLoading: authLoading } = useAuth();
  const [currentPage, setCurrentPage] = useState('pos');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { initializeApp } = useAppStore();

  useEffect(() => {
    initializeApp();
  }, [initializeApp]);

  useEffect(() => {
    const handler = () => useAppStore.getState().loadMechanics();
    window.addEventListener('mechanics-changed', handler);
    return () => window.removeEventListener('mechanics-changed', handler);
  }, []);

  const { settings } = useAppStore();

  useEffect(() => {
    const handler = async (e: Event) => {
      const transactionId = (e as CustomEvent<number>).detail;
      try {
        await dbPrintReceipt(transactionId, settings?.printer_name ?? undefined, settings?.paper_width ?? 80);
        useToastStore.getState().addToast({ type: 'success', title: 'Berhasil', message: 'Struk dikirim ke printer' });
      } catch (err) {
        console.error('Print failed:', err);
        useToastStore.getState().addToast({ type: 'error', title: 'Gagal Cetak', message: err instanceof Error ? err.message : String(err), duration: 5000 });
      }
    };
    window.addEventListener('print-receipt', handler);
    return () => window.removeEventListener('print-receipt', handler);
  }, [settings]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-industrial-50">
        <div className="animate-spin h-8 w-8 border-4 border-accent-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const isAdmin = user.role === 'admin';
  const visiblePages = pages.filter((p) => isAdmin || !p.adminOnly);
  const pageConfig = visiblePages.find((p) => p.key === currentPage) || visiblePages[0];
  const CurrentComponent = pageConfig.component;

  return (
    <>
      <ToastContainer />
      <AppLayout currentPage={currentPage} onNavigate={setCurrentPage}>
        <MobileSidebar 
          isOpen={mobileSidebarOpen} 
          onClose={() => setMobileSidebarOpen(false)}
          currentPage={currentPage}
          onNavigate={setCurrentPage}
        />
        <div className="flex gap-4">
          <MobileMenuButton onClick={() => setMobileSidebarOpen(true)} />
          <div className="flex-1 min-w-0">
            <CurrentComponent />
          </div>
        </div>
      </AppLayout>
    </>
  );
}

export default App;