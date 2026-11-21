import { X, type LucideIcon } from 'lucide-react';

export interface SheetHeadProps {
  icon: LucideIcon;
  title: string;
  hint?: string;
  onClose: () => void;
}

export function SheetHead({ icon: Icon, title, hint, onClose }: SheetHeadProps) {
  return (
    <header className="wb-sheet__head">
      <span className="wb-sheet__icon" aria-hidden="true">
        <Icon size={28} strokeWidth={2} />
      </span>
      <div className="wb-sheet__copy">
        <h2 className="wb-sheet__title">{title}</h2>
        {hint ? <p className="wb-sheet__hint">{hint}</p> : null}
      </div>
      <button type="button" className="icon-button wb-sheet__close" aria-label="关闭" onClick={onClose}>
        <X size={26} strokeWidth={2.2} />
      </button>
    </header>
  );
}
