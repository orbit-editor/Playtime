import { useEffect, useId, type ReactNode } from 'react';
import { ArrowLeft, Loader2, RefreshCw } from 'lucide-react';
import { toApiError } from '../../lib/api';
import type { SchoolClass } from '../../lib/types';

/** 子页完成后回到列表：message 走顶部轻提示，nextClass 用于顺手刷新班级名。 */
export type DoneHandler = (message: string, nextClass?: SchoolClass) => void;

/** 手机端错误文案：把接口错误翻译成老师能看懂的一句话。 */
export function mobileError(error: unknown): string {
  const apiError = toApiError(error);
  if (apiError.status === 401) return '登录状态过期了，请老师在教室大屏上重新扫码';
  if (apiError.status === 0) return '没有连上教室的小助手，请检查网络后再试';
  if (apiError.status >= 500) return '小助手有点忙，请稍后再试';
  if (apiError.message && apiError.message !== apiError.code) return apiError.message;
  return '没有成功，请再试一次';
}

function pad2(value: number): string {
  return value < 10 ? '0' + String(value) : String(value);
}

function sameDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

/** 通知时间：今天 / 昨天 / 本月内 / 跨年。 */
export function formatTime(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const clock = pad2(date.getHours()) + ':' + pad2(date.getMinutes());
  if (sameDay(date, now)) return '今天 ' + clock;
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (sameDay(date, yesterday)) return '昨天 ' + clock;
  if (date.getFullYear() === now.getFullYear()) {
    return String(date.getMonth() + 1) + '月' + String(date.getDate()) + '日 ' + clock;
  }
  return String(date.getFullYear()) + '年' + String(date.getMonth() + 1) + '月' + String(date.getDate()) + '日';
}

/** 回到页面顶部；jsdom 里不支持滚动，忽略即可。 */
export function scrollToTop(): void {
  try {
    window.scrollTo(0, 0);
  } catch {
    /* 测试环境不支持滚动 */
  }
}

export function TabHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="m-pagehead">
      <h1 className="m-pagehead__title">{title}</h1>
      {action ? <div className="m-pagehead__action">{action}</div> : null}
    </div>
  );
}

export function SectionTitle({ title, count }: { title: string; count?: number }) {
  return (
    <h2 className="m-section__title">
      {title}
      {typeof count === 'number' && count > 0 ? <span className="m-count">{count}</span> : null}
    </h2>
  );
}

export function SubpageHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <header className="m-subhead">
      <div className="m-subhead__inner">
        <button type="button" className="m-back" onClick={onBack} aria-label="返回">
          <ArrowLeft size={22} strokeWidth={2.2} aria-hidden="true" />
        </button>
        <h1 className="m-subhead__title">{title}</h1>
        <span className="m-subhead__spacer" aria-hidden="true" />
      </div>
    </header>
  );
}

export function Field({
  label,
  hint,
  counter,
  error,
  children,
}: {
  label: string;
  hint?: string;
  counter?: string;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <div className="m-field">
      <div className="m-field__top">
        <span className="m-field__label">{label}</span>
        {counter ? <span className="m-field__counter">{counter}</span> : null}
      </div>
      {children}
      {error ? (
        <p className="m-field__error" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="m-field__hint">{hint}</p>
      ) : null}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="m-switch"
      onClick={() => onChange(!checked)}
    >
      <span className="m-switch__text">
        <span className="m-switch__label">{label}</span>
        {hint ? <span className="m-switch__hint">{hint}</span> : null}
      </span>
      <span className="m-switch__track" aria-hidden="true" />
    </button>
  );
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = '确定',
  cancelLabel = '取消',
  busy = false,
  tone = 'danger',
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  tone?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const textId = useId();

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div className="m-dialog-backdrop" onClick={busy ? undefined : onCancel}>
      <div
        className="m-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? textId : undefined}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="m-dialog__title" id={titleId}>
          {title}
        </h2>
        {description ? (
          <p className="m-dialog__text" id={textId}>
            {description}
          </p>
        ) : null}
        <div className="m-dialog__actions">
          <button type="button" className="m-btn m-btn--ghost" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={'m-btn ' + (tone === 'danger' ? 'm-btn--danger' : 'm-btn--primary')}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? '请稍等' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function LoadingBlock({ text = '正在加载' }: { text?: string }) {
  return (
    <div className="m-loading-block" role="status">
      <Loader2 className="spin" size={24} aria-hidden="true" />
      <span>{text}</span>
    </div>
  );
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="m-error-block">
      <p>{message}</p>
      <button type="button" className="m-btn m-btn--soft m-btn--sm" onClick={onRetry}>
        <RefreshCw size={16} aria-hidden="true" />
        再试一次
      </button>
    </div>
  );
}
