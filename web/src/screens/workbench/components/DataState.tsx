import { AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '../../../components/Button';

export function LoadingState({ text = '正在加载…' }: { text?: string }) {
  return (
    <div className="wb-state" role="status">
      <Loader2 className="wb-spin" size={28} aria-hidden="true" />
      <span>{text}</span>
    </div>
  );
}

export interface ErrorStateProps {
  text: string;
  onRetry?: () => void;
}

export function ErrorState({ text, onRetry }: ErrorStateProps) {
  return (
    <div className="wb-state wb-state--error" role="alert">
      <AlertTriangle size={26} aria-hidden="true" />
      <span>{text}</span>
      {onRetry ? (
        <Button variant="soft" size="sm" onClick={onRetry}>
          重新加载
        </Button>
      ) : null}
    </div>
  );
}
