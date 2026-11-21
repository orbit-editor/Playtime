import { toApiError } from '../../lib/api';

const pad2 = (value: number): string => (value < 10 ? '0' + String(value) : String(value));

/** 把时间显示成老师一眼能看懂的样子：今天 14:09 / 11月21日 14:09。 */
export function formatWhen(iso: string | undefined | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const hhmm = pad2(date.getHours()) + ':' + pad2(date.getMinutes());
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) return '今天 ' + hhmm;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate();
  if (isYesterday) return '昨天 ' + hhmm;
  if (date.getFullYear() === now.getFullYear()) {
    return String(date.getMonth() + 1) + '月' + String(date.getDate()) + '日 ' + hhmm;
  }
  return (
    String(date.getFullYear()) +
    '年' +
    String(date.getMonth() + 1) +
    '月' +
    String(date.getDate()) +
    '日'
  );
}

/** 数据库大小：后端给的是字节，界面按 KB / MB 显示。 */
export function formatDatabaseSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) return String(Math.max(1, Math.round(bytes / 1024))) + ' KB';
  const mb = bytes / 1024 / 1024;
  return mb.toFixed(1).replace(/\.0$/, '') + ' MB';
}

/** 备份文件的下载名：playtime-备份-20261121.zip。 */
export function formatBackupFileName(date: Date): string {
  return (
    'playtime-备份-' +
    String(date.getFullYear()) +
    pad2(date.getMonth() + 1) +
    pad2(date.getDate()) +
    '.zip'
  );
}

/** 倒计时文案：4 分 32 秒 / 45 秒。 */
export function formatCountdown(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0 秒';
  const total = Math.ceil(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  if (minutes > 0) return String(minutes) + ' 分 ' + String(rest) + ' 秒';
  return String(rest) + ' 秒';
}

/** 距离过期还有多少秒，已经过期就是 0。 */
export function remainingSeconds(expiresAt: string, nowMs: number = Date.now()): number {
  const at = Date.parse(expiresAt);
  if (Number.isNaN(at)) return 0;
  return Math.max(0, Math.ceil((at - nowMs) / 1000));
}

/** 列表里的正文摘要。 */
export function excerpt(text: string, max = 96): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  return flat.slice(0, max).trimEnd() + '…';
}

/** 把接口错误翻译成中文提示，后端自带的中文消息优先。 */
export function errorText(error: unknown, fallback = '出了点小问题，再试一次'): string {
  const apiError = toApiError(error);
  if (apiError.status === 0) return '教室里的小助手没连上，检查一下网络';
  const message = apiError.message.trim();
  if (message.length > 0 && message !== apiError.code) return message;
  return fallback;
}

/** 用 a[download] 把 Blob 存到电脑上。 */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
