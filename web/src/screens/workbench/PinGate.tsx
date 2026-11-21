import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, Check, Delete, Loader2, Lock, ShieldCheck } from 'lucide-react';
import { Button } from '../../components/Button';
import { toApiError } from '../../lib/api';

const PIN_LENGTH = 4;
const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
const LOCK_SECONDS = 60;

export interface PinGateProps {
  /** 校验并登录；失败时抛错，由密码门显示提示。 */
  onLogin: (pin: string) => Promise<void>;
  onBackHome: () => void;
}

/** 4 位密码门：大方格 + 大数字键盘。 */
export function PinGate({ onLogin, onBackHome }: PinGateProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const busyRef = useRef(false);

  const lockLeft = lockedUntil === null ? 0 : Math.max(0, Math.ceil((lockedUntil - nowMs) / 1000));
  const locked = lockedUntil !== null && lockLeft > 0;

  useEffect(() => {
    if (lockedUntil === null) return;
    const timer = window.setInterval(() => {
      const now = Date.now();
      setNowMs(now);
      if (now >= lockedUntil) {
        setLockedUntil(null);
        setError('');
      }
    }, 500);
    return () => window.clearInterval(timer);
  }, [lockedUntil]);

  const submit = useCallback(
    async (value: string) => {
      if (busyRef.current || lockedUntil !== null) return;
      busyRef.current = true;
      setBusy(true);
      setError('');
      try {
        await onLogin(value);
      } catch (err) {
        const apiError = toApiError(err);
        if (apiError.status === 401) {
          setError('密码不对');
          setPin('');
        } else if (apiError.status === 429) {
          setError('错太多次了，一分钟后再试');
          setLockedUntil(Date.now() + LOCK_SECONDS * 1000);
          setNowMs(Date.now());
          setPin('');
        } else {
          setError('连不上教室的小助手，过一会儿再试');
          setPin('');
        }
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [onLogin, lockedUntil],
  );

  const pressDigit = useCallback(
    (digit: string) => {
      if (busy || locked || pin.length >= PIN_LENGTH) return;
      const next = pin + digit;
      setError('');
      setPin(next);
      if (next.length === PIN_LENGTH) void submit(next);
    },
    [busy, locked, pin, submit],
  );

  const pressBackspace = useCallback(() => {
    if (busy || locked) return;
    setPin((current) => current.slice(0, -1));
    setError('');
  }, [busy, locked]);

  const pressConfirm = useCallback(() => {
    if (busy || locked) return;
    if (pin.length !== PIN_LENGTH) {
      setError('请输入 4 位数字');
      return;
    }
    void submit(pin);
  }, [busy, locked, pin, submit]);

  const actionsRef = useRef({ pressDigit, pressBackspace, pressConfirm });
  actionsRef.current = { pressDigit, pressBackspace, pressConfirm };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.length === 1 && event.key >= '0' && event.key <= '9') {
        event.preventDefault();
        actionsRef.current.pressDigit(event.key);
      } else if (event.key === 'Backspace') {
        event.preventDefault();
        actionsRef.current.pressBackspace();
      } else if (event.key === 'Enter') {
        event.preventDefault();
        actionsRef.current.pressConfirm();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="screen pin-gate">
      <div className="pin-gate__back">
        <Button variant="ghost" size="lg" icon={ArrowLeft} onClick={onBackHome}>
          回首页
        </Button>
      </div>

      <div className="pin-gate__card">
        <span className="pin-gate__mark" aria-hidden="true">
          <ShieldCheck size={46} strokeWidth={2} />
        </span>
        <h1 className="pin-gate__title">老师工作台</h1>
        <p className="pin-gate__sub">输入 4 位密码，管理班级、通知和小红花</p>

        <div className="pin-dots" aria-hidden="true">
          {Array.from({ length: PIN_LENGTH }, (_, index) => {
            const filled = pin.length > index;
            const active = !locked && !busy && pin.length === index;
            return (
              <span
                key={index}
                data-testid="pin-dot"
                className={
                  'pin-dot' + (filled ? ' pin-dot--filled' : '') + (active ? ' pin-dot--active' : '')
                }
              >
                {pin[index] ?? ''}
              </span>
            );
          })}
        </div>
        <p className="pin-gate__sr" aria-live="polite">
          已输入 {pin.length} 位密码
        </p>

        <div className="pin-gate__error" role="alert">
          {locked ? (
            <>
              <Lock size={20} aria-hidden="true" />
              <span>错太多次了，一分钟后再试</span>
              <span className="pin-gate__count">{lockLeft} 秒</span>
            </>
          ) : error ? (
            <>
              <AlertCircle size={20} aria-hidden="true" />
              <span>{error}</span>
            </>
          ) : null}
        </div>

        <div className="pin-keypad">
          {DIGITS.map((digit) => (
            <button
              key={digit}
              type="button"
              className="pin-key"
              disabled={busy || locked}
              onClick={() => pressDigit(digit)}
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            className="pin-key pin-key--quiet"
            aria-label="退格"
            disabled={busy || locked || pin.length === 0}
            onClick={pressBackspace}
          >
            <Delete size={28} strokeWidth={2} />
          </button>
          <button
            type="button"
            className="pin-key"
            disabled={busy || locked}
            onClick={() => pressDigit('0')}
          >
            0
          </button>
          <button
            type="button"
            className="pin-key pin-key--confirm"
            disabled={busy || locked}
            onClick={pressConfirm}
          >
            {busy ? (
              <Loader2 className="wb-spin" size={26} strokeWidth={2.4} aria-hidden="true" />
            ) : (
              <Check size={26} strokeWidth={2.8} aria-hidden="true" />
            )}
            <span>确定</span>
          </button>
        </div>

        <p className="pin-gate__hint">可以用下面的键盘，也可以直接用键盘输入</p>
      </div>
    </div>
  );
}
