import { type ReactNode, useState } from 'react';
import { cn } from '@/utils/cn';

interface Tab {
  key: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  badge?: string | number;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (key: string) => void;
  variant?: 'default' | 'pills' | 'underline';
  className?: string;
}

export function Tabs({ tabs, activeTab, onChange, variant = 'default', className }: TabsProps) {
  const baseStyles = 'flex gap-1';
  
  const variants = {
    default: 'bg-industrial-100 rounded-lg p-1',
    pills: '',
    underline: 'border-b border-industrial-200 -mb-px',
  };

  const tabVariants = {
    default: 'rounded-md px-4 py-2 text-sm font-medium transition-all duration-200',
    pills: 'rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200',
    underline: 'pb-2 px-1 text-sm font-medium border-b-2 transition-all duration-200',
  };

  const activeStyles = {
    default: 'bg-white text-industrial-700 shadow-sm',
    pills: 'bg-industrial-100 text-industrial-700',
    underline: 'border-accent-500 text-accent-600',
  };

  const inactiveStyles = {
    default: 'text-industrial-500 hover:text-industrial-700',
    pills: 'text-industrial-500 hover:text-industrial-700 hover:bg-industrial-100',
    underline: 'text-industrial-500 hover:text-industrial-700 border-transparent',
  };

  return (
    <div className={cn(baseStyles, variants[variant], className)} role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          role="tab"
          aria-selected={activeTab === tab.key}
          aria-controls={`${tab.key}-panel`}
          id={`${tab.key}-tab`}
          onClick={() => !tab.disabled && onChange(tab.key)}
          disabled={tab.disabled}
          className={cn(
            tabVariants[variant],
            activeTab === tab.key ? activeStyles[variant] : inactiveStyles[variant],
            tab.disabled && 'opacity-50 cursor-not-allowed',
            'flex items-center gap-2'
          )}
        >
          {tab.icon && <span className="flex-shrink-0">{tab.icon}</span>}
          {tab.label}
          {tab.badge && (
            <span className={cn(
              'text-xs font-medium px-1.5 py-0.5 rounded-full',
              activeTab === tab.key ? 'bg-industrial-200 text-industrial-700' : 'bg-industrial-200 text-industrial-600'
            )}>
              {tab.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

interface TabPanelProps {
  children: ReactNode;
  tabKey: string;
  activeTab: string;
}

export function TabPanel({ children, tabKey, activeTab }: TabPanelProps) {
  if (activeTab !== tabKey) return null;
  return <div role="tabpanel" id={`${tabKey}-panel`} aria-labelledby={`${tabKey}-tab`}>{children}</div>;
}