import type { ReactNode } from "react";

export interface CardProps {
  title?: string;
  icon?: string;
  children: ReactNode;
  className?: string;
}

export function Card({ title, icon, children, className = "" }: CardProps) {
  return (
    <div className={`bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden ${className}`}>
      {title && (
        <div className="flex items-center gap-2 px-6 py-5 border-b border-[var(--border)] bg-[var(--bg-elevated)]">
          {icon && <span className="text-lg">{icon}</span>}
          <span className="text-sm font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
            {title}
          </span>
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  );
}
