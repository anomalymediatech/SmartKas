import { useState, useEffect } from 'react';
import { AppLayout } from './components/layout';
import { MobileSidebar, MobileMenuButton } from './components/layout/Sidebar';
import { ToastContainer } from './components/ui';
import POSPage from './pages/POS';
import SettingsPage from './pages/Settings';
import HistoryPage from './pages/History';
import InventoryPage from './pages/Inventory';
import { useAppStore } from './stores';

const pages = [
  { key: 'pos', label: 'POS', component: POSPage },
  { key: 'history', label: 'Riwayat', component: HistoryPage },
  { key: 'inventory', label: 'Inventori', component: InventoryPage },
  { key: 'settings', label: 'Pengaturan', component: SettingsPage },
];

function App() {
  console.log('✅ App Component Rendered');
  const [currentPage, setCurrentPage] = useState('pos');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { initializeApp } = useAppStore();

  useEffect(() => {
    initializeApp();
  }, [initializeApp]);

  const pageConfig = pages.find(p => p.key === currentPage) || pages[0];
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