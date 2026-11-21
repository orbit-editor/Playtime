import { useEffect, useRef, type ReactNode } from 'react';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
  variant?: 'full' | 'bottom';
  className?: string;
  panelClassName?: string;
}

/** 覆盖整个大屏的浮层。点空白处或按 Esc 关闭。 */
export function Sheet({
  open,
  onClose,
  label,
  children,
  variant = 'full',
  className,
  panelClassName,
}: SheetProps) {
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className={'sheet-backdrop sheet-backdrop--' + variant + (className ? ' ' + className : '')}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeRef.current();
      }}
    >
      <section
        className={'sheet-panel sheet-panel--' + variant + (panelClassName ? ' ' + panelClassName : '')}
        role="dialog"
        aria-modal="true"
        aria-label={label}
      >
        {children}
      </section>
    </div>
  );
}
