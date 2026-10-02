import { cn } from '@/utils/cn';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Badge({ children, variant = 'default', size = 'md', className }: BadgeProps) {
  const variants = {
    default: 'bg-industrial-100 text-industrial-700',
    success: 'bg-success-100 text-success-700',
    warning: 'bg-warning-100 text-warning-700',
    danger: 'bg-danger-100 text-danger-700',
    info: 'bg-blue-100 text-blue-700',
    outline: 'border border-industrial-300 text-industrial-700 bg-transparent',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
    lg: 'px-3 py-1.5 text-base',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full',
        variants[variant],
        sizes[size],
        className
      )}
    >
      {children}
    </span>
  );
}

interface StockBadgeProps {
  stock: number;
  threshold?: number;
}

export function StockBadge({ stock, threshold = 5 }: StockBadgeProps) {
  if (stock <= 0) {
    return <Badge variant="danger" size="sm">Habis</Badge>;
  }
  if (stock <= threshold) {
    return <Badge variant="warning" size="sm">Stok Rendah ({stock})</Badge>;
  }
  return <Badge variant="success" size="sm">Tersedia ({stock})</Badge>;
}