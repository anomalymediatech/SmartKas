import { Fragment, useEffect, useState } from 'react';
import { X, LayoutDashboard, Package, History, Settings, Settings2, Wrench, ShoppingBag, ChevronRight, Users, ShoppingCart } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Modal } from '@/components/ui';

interface MobileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentPage: string;
  onNavigate: (page: string) => void;
}

const navItems = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'pos', label: 'POS', icon: ShoppingBag },
  { key: 'history', label: 'Riwayat', icon: History },
  { key: 'inventory', label: 'Inventori', icon: Package },
  { key: 'employees', label: 'Karyawan', icon: Users },
  { key: 'purchases', label: 'Pembelian', icon: ShoppingCart },
  { key: 'settings', label: 'Pengaturan', icon: Settings2 },
];

export function MobileSidebar({ isOpen, onClose, currentPage, onNavigate }: MobileSidebarProps) {
  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      size="sm" 
      closeOnOverlayClick={true}
      showCloseButton={false}
      className="max-w-sm"
    >
      <div className="flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-accent-500 rounded-lg flex items-center justify-center">
              <Wrench className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-industrial-900">SmartKas</span>
          </div>
        </div>
        <nav className="flex-1" role="navigation" aria-label="Navigasi mobile">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.key;
            return (
              <button
                key={item.key}
                onClick={() => { onNavigate(item.key); onClose(); }}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left font-medium transition-all duration-200',
                  isActive
                    ? 'bg-accent-50 text-accent-700'
                    : 'text-industrial-600 hover:text-industrial-900 hover:bg-industrial-50'
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="pt-4 border-t border-industrial-200">
          <p className="text-xs text-industrial-500 text-center">
            SmartKas v1.0.0 - Bengkel POS
          </p>
        </div>
      </div>
    </Modal>
  );
}

export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="md:hidden p-2 rounded-lg text-industrial-600 hover:text-industrial-900 hover:bg-industrial-100 transition-colors"
      aria-label="Buka menu"
    >
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </button>
  );
}