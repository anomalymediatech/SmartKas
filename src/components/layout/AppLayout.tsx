import { type ReactNode } from 'react';
import { Header } from './Header';

interface AppLayoutProps {
  children: ReactNode;
  currentPage: string;
  onNavigate: (page: string) => void;
}

export function AppLayout({ children, currentPage, onNavigate }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-industrial-50 flex flex-col">
      <Header currentPage={currentPage} onNavigate={onNavigate} />
      <main className="flex-1 p-4 md:p-6">
        <div className="max-w-full mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}