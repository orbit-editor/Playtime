import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AlertCircle, Check, Info } from 'lucide-react';

export type ToastTone = 'info' | 'success' | 'error';

interface ToastItem {
  id: number;
  text: string;
  tone: ToastTone;
}

interface ToastContextValue {
  show: (text: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const sequence = useRef(0);
  const timers = useRef<number[]>([]);

  const show = useCallback((text: string, tone: ToastTone = 'info') => {
    sequence.current += 1;
    const id = sequence.current;
    setItems((current) => [...current, { id, text, tone }]);
    const timer = window.setTimeout(() => {
      setItems((current) => current.filter((item) => item.id !== id));
    }, 2400);
    timers.current.push(timer);
  }, []);

  useEffect(() => {
    return () => {
      for (const timer of timers.current) window.clearTimeout(timer);
    };
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <ToastViewport items={items} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext);
  if (!value) throw new Error('ToastProvider 没有包裹页面');
  return value;
}

function ToneIcon({ tone }: { tone: ToastTone }) {
  if (tone === 'error') return <AlertCircle size={22} strokeWidth={2.2} />;
  if (tone === 'success') return <Check size={22} strokeWidth={2.6} />;
  return <Info size={22} strokeWidth={2.2} />;
}

function ToastViewport({ items }: { items: ToastItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="toast-viewport" aria-live="polite">
      {items.map((item) => (
        <div key={item.id} className={'toast toast--' + item.tone}>
          <span className="toast__icon" aria-hidden="true">
            <ToneIcon tone={item.tone} />
          </span>
          <span>{item.text}</span>
        </div>
      ))}
    </div>
  );
}
