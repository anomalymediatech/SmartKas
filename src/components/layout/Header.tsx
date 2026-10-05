import { useEffect, useState } from 'react';
import { LayoutDashboard, Package, History, Settings2, Wrench, ShoppingBag, Users, ShoppingCart } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useAuth } from '@/context/AuthContext';

interface HeaderProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

const navItems = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, shortcut: '', adminOnly: true },
  { key: 'pos', label: 'POS', icon: ShoppingBag, shortcut: 'F1', adminOnly: false },
  { key: 'history', label: 'Riwayat', icon: History, shortcut: 'F2', adminOnly: false },
  { key: 'inventory', label: 'Inventori', icon: Package, shortcut: 'F3', adminOnly: false },
  { key: 'employees', label: 'Karyawan', icon: Users, shortcut: '', adminOnly: true },
  { key: 'purchases', label: 'Pembelian', icon: ShoppingCart, shortcut: '', adminOnly: true },
  { key: 'settings', label: 'Pengaturan', icon: Settings2, shortcut: 'F4', adminOnly: false },
];

export function Header({ currentPage, onNavigate }: HeaderProps) {
  const [time, setTime] = useState(new Date());
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'admin';
  const visibleNavItems = navItems.filter((item) => isAdmin || !item.adminOnly);

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="bg-white border-b border-industrial-200 sticky top-0 z-40">
      <div className="max-w-full mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-accent-500 rounded-lg flex items-center justify-center">
                <Wrench className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold text-industrial-900">SmartKas</span>
            </div>
            <nav className="hidden md:flex items-center gap-1" role="navigation" aria-label="Navigasi utama">
              {visibleNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentPage === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => onNavigate(item.key)}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                      isActive
                        ? 'bg-accent-50 text-accent-700'
                        : 'text-industrial-600 hover:text-industrial-900 hover:bg-industrial-50'
                    )}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                     {item.shortcut && (
                       <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-xs font-mono bg-industrial-100 rounded">
                         {item.shortcut}
                       </span>
                     )}
                  </button>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:block text-sm text-industrial-500 font-mono">
              {time.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            {user && (
              <>
                <span className="hidden sm:inline text-sm text-industrial-600">
                  {user.username} <span className="text-xs text-industrial-400">({user.role})</span>
                </span>
                <button
                  onClick={logout}
                  className="px-3 py-1.5 text-sm rounded-lg text-danger-600 hover:bg-red-50 border border-red-200 transition-colors"
                >
                  Keluar
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}