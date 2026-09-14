import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export function Card({ children, className, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white rounded-2xl border border-slate-100 shadow-sm',
        onClick && 'cursor-pointer hover:shadow-md transition-shadow',
        className
      )}
    >
      {children}
    </div>
  );
}

export function StatCard({
  label, value, icon, trend, color = 'brand',
}: {
  label: string;
  value: string;
  icon: ReactNode;
  trend?: string;
  color?: 'brand' | 'amber' | 'rose' | 'blue';
}) {
  const colors = {
    brand: 'bg-brand-50 text-brand-600',
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600',
    blue: 'bg-blue-50 text-blue-600',
  };
  return (
    <Card className="p-4 md:p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs md:text-sm text-slate-500 font-medium">{label}</p>
          <p className="text-lg md:text-2xl font-bold text-slate-900 mt-1">{value}</p>
          {trend && <p className="text-xs text-brand-600 mt-1">{trend}</p>}
        </div>
        <div className={cn('p-2.5 rounded-xl', colors[color])}>{icon}</div>
      </div>
    </Card>
  );
}

export function Button({
  children, variant = 'primary', size = 'md', className, disabled, ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}) {
  const variants = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm',
    secondary: 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50',
    ghost: 'text-slate-600 hover:bg-slate-100',
    danger: 'bg-rose-600 text-white hover:bg-rose-700',
  };
  const sizes = { sm: 'px-3 py-1.5 text-sm', md: 'px-4 py-2.5 text-sm', lg: 'px-6 py-3 text-base' };
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors disabled:opacity-50',
        variants[variant], sizes[size], className
      )}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}

export function Input({
  className, label, ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <div className="space-y-1.5">
      {label && <label className="text-sm font-medium text-slate-700">{label}</label>}
      <input
        className={cn(
          'w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white',
          'focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500',
          'placeholder:text-slate-400 text-sm',
          className
        )}
        {...props}
      />
    </div>
  );
}

export function Badge({ children, variant = 'default' }: { children: ReactNode; variant?: string }) {
  const variants: Record<string, string> = {
    default: 'bg-slate-100 text-slate-700',
    success: 'bg-brand-100 text-brand-700',
    warning: 'bg-amber-100 text-amber-700',
    danger: 'bg-rose-100 text-rose-700',
    rx: 'bg-purple-100 text-purple-700',
  };
  return (
    <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-semibold', variants[variant] ?? variants.default)}>
      {children}
    </span>
  );
}
