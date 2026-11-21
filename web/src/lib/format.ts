import type { ApiError } from './api';

const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
const CHINESE_NUMBERS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

function pad2(value: number): string {
  return value < 10 ? '0' + String(value) : String(value);
}

export function formatClock(date: Date): string {
  return pad2(date.getHours()) + ':' + pad2(date.getMinutes());
}

export function formatDateCN(date: Date): string {
  return String(date.getMonth() + 1) + '月' + String(date.getDate()) + '日 ' + (WEEKDAYS[date.getDay()] ?? '');
}

export function greetingFor(date: Date): string {
  const hour = date.getHours();
  if (hour < 9) return '早上好呀';
  if (hour < 12) return '上午好呀';
  if (hour < 14) return '中午好呀';
  if (hour < 18) return '下午好呀';
  return '晚上好呀';
}

export function gradeLabel(grade: number): string {
  if (grade >= 1 && grade <= 9) return (CHINESE_NUMBERS[grade] ?? String(grade)) + '年级';
  return String(grade) + ' 年级';
}

export function gradesLabel(grades: number[]): string {
  if (grades.length === 0) return '';
  return grades.map(gradeLabel).join('、');
}

export interface AvatarTone {
  background: string;
  foreground: string;
}

const TONES: AvatarTone[] = [
  { background: '#FBE4DE', foreground: '#A93F34' },
  { background: '#E4F0E8', foreground: '#2E7350' },
  { background: '#FCF0D5', foreground: '#7A5207' },
  { background: '#E8F0F8', foreground: '#396A9E' },
  { background: '#F0E8F7', foreground: '#6C4D8F' },
  { background: '#F8E7EF', foreground: '#9B3F66' },
];

export function avatarTone(seed: string): AvatarTone {
  let hash = 0;
  for (const char of seed) {
    hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
  }
  return TONES[hash % TONES.length] ?? TONES[0] ?? { background: '#E4F0E8', foreground: '#2E7350' };
}

export function friendlyError(error: ApiError | null): string {
  if (!error) return '出了点小问题，再试一次吧';
  if (error.status === 0) return '教室里的小助手还没连上，过一会儿再试试';
  if (error.status === 401) return '先请老师来看一下吧';
  if (error.status === 403) return '这个要老师来点哦';
  if (error.status === 404) return '没有找到，再试一次吧';
  if (error.status >= 500) return '小助手有点忙，过一会儿再试试';
  return '出了点小问题，再试一次吧';
}

export function flowersText(count: number): string {
  return String(count) + ' 朵';
}
