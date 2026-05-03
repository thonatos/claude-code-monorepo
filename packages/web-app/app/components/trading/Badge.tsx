import type { ReactNode } from 'react';

export type BadgeVariant = 'buy' | 'sell' | 'wait' | 'up' | 'down' | 'neutral';

export interface BadgeProps {
  variant: BadgeVariant;
  children: ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const variantStyles: Record<BadgeVariant, string> = {
  buy: 'bg-[var(--accent-green-dim)] text-[var(--accent-green)]',
  sell: 'bg-[var(--accent-red-dim)] text-[var(--accent-red)]',
  wait: 'bg-[var(--accent-amber-dim)] text-[var(--accent-amber)]',
  up: 'bg-[var(--accent-green-dim)] text-[var(--accent-green)]',
  down: 'bg-[var(--accent-red-dim)] text-[var(--accent-red)]',
  neutral: 'bg-[var(--accent-amber-dim)] text-[var(--accent-amber)]',
};

const sizeStyles: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'px-3 py-1 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
};

export function Badge({ variant, children, className = '', size = 'md' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-xl font-bold uppercase tracking-wider ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {children}
    </span>
  );
}
