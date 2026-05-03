import type { ReactNode } from 'react';

export type SignalType = 'bullish' | 'bearish';

export interface SignalItemProps {
  type: SignalType;
  children: ReactNode;
}

export function SignalItem({ type, children }: SignalItemProps) {
  const isBullish = type === 'bullish';

  return (
    <div className="flex items-start gap-3 px-4 py-3 bg-[var(--bg-primary)] rounded-xl text-sm">
      <span
        className={`flex-shrink-0 w-5 h-5 rounded-lg flex items-center justify-center text-xs font-bold ${
          isBullish
            ? 'bg-[var(--accent-green-dim)] text-[var(--accent-green)]'
            : 'bg-[var(--accent-red-dim)] text-[var(--accent-red)]'
        }`}
      >
        {isBullish ? '✓' : '✗'}
      </span>
      <span className="text-[var(--text-secondary)]">{children}</span>
    </div>
  );
}
