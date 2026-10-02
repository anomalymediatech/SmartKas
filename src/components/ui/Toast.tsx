import { type ReactNode } from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { useToastStore } from '@/hooks/useToast';
import { cn } from '@/utils/cn';

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const colors = {
  success: 'bg-success-50 border-success-200 text-success-800',
  error: 'bg-danger-50 border-danger-200 text-danger-800',
  warning: 'bg-warning-50 border-warning-200 text-warning-800',
  info: 'bg-industrial-50 border-industrial-200 text-industrial-800',
};

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  );
}

interface ToastProps {
  toast: {
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message?: string;
  };
  onClose: () => void;
}

function Toast({ toast, onClose }: ToastProps) {
  const Icon = icons[toast.type];

  return (
    <div
      className={cn(
        'pointer-events-auto flex items-start gap-3 w-full max-w-sm',
        'animate-in slide-in-from-right duration-300 ease-out',
        colors[toast.type]
      )}
      role="alert"
    >
      <div className="flex-shrink-0 mt-0.5">
        <Icon className={cn('h-5 w-5', toast.type === 'success' && 'text-success-600', toast.type === 'error' && 'text-danger-600', toast.type === 'warning' && 'text-warning-600', toast.type === 'info' && 'text-industrial-600')} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{toast.title}</p>
        {toast.message && (
          <p className="mt-0.5 text-sm opacity-90">{toast.message}</p>
        )}
      </div>
      <button
        onClick={onClose}
        className="flex-shrink-0 p-1 rounded hover:bg-black/10 transition-colors"
        aria-label="Tutup notifikasi"
      >
        <X className="h-4 w-4 opacity-60" />
      </button>
    </div>
  );
}