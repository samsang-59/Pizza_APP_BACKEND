import type { ReactNode } from 'react';

interface Props {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className = '' }: Props) {
  return (
    <div className={`flex flex-col items-center justify-center rounded-xl border border-dashed border-line/15 px-4 py-8 text-center ${className}`}>
      {icon && <div className="mb-3 text-accent/70" aria-hidden="true">{icon}</div>}
      <p className="text-sm font-medium text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
