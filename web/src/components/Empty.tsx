import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export interface EmptyProps {
  icon: LucideIcon;
  title: string;
  hint?: string;
  action?: ReactNode;
  compact?: boolean;
}

export function Empty({ icon: Icon, title, hint, action, compact = false }: EmptyProps) {
  return (
    <div className={'empty' + (compact ? ' empty--compact' : '')}>
      <span className="empty__icon" aria-hidden="true">
        <Icon size={compact ? 30 : 40} strokeWidth={1.8} />
      </span>
      <p className="empty__title">{title}</p>
      {hint ? <p className="empty__hint">{hint}</p> : null}
      {action ? <div className="empty__action">{action}</div> : null}
    </div>
  );
}
