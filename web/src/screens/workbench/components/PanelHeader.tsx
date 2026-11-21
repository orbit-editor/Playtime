import type { ReactNode } from 'react';

export interface PanelHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function PanelHeader({ title, subtitle, actions }: PanelHeaderProps) {
  return (
    <header className="wb-panel__head">
      <div className="wb-panel__heading">
        <h2 className="wb-panel__title">{title}</h2>
        {subtitle ? <p className="wb-panel__sub">{subtitle}</p> : null}
      </div>
      {actions ? <div className="wb-panel__actions">{actions}</div> : null}
    </header>
  );
}
