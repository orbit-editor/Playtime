import { AlertTriangle } from 'lucide-react';
import { Button } from '../../../components/Button';
import { Sheet } from '../../../components/Sheet';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/** 大屏上的二次确认，按钮足够大，点空白或 Esc 也能取消。 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = '确认',
  cancelLabel = '取消',
  danger = true,
  busy = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <Sheet open={open} onClose={onClose} label={title} panelClassName="wb-sheet wb-sheet--confirm">
      <div className="wb-confirm">
        <span className="wb-confirm__icon" aria-hidden="true">
          <AlertTriangle size={36} strokeWidth={2} />
        </span>
        <h2 className="wb-confirm__title">{title}</h2>
        <p className="wb-confirm__text">{message}</p>
        <div className="wb-confirm__actions">
          <Button variant="ghost" size="lg" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} size="lg" onClick={onConfirm} disabled={busy}>
            {busy ? '正在处理…' : confirmLabel}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
