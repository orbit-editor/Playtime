import { describe, expect, it } from 'vitest';
import { ApiError } from '../../lib/api';
import {
  errorText,
  excerpt,
  formatBackupFileName,
  formatCountdown,
  formatDatabaseSize,
  formatWhen,
  remainingSeconds,
} from './format';

describe('formatDatabaseSize', () => {
  it('TestShowsKiloBytesForSmallDatabase', () => {
    expect(formatDatabaseSize(4096)).toBe('4 KB');
    expect(formatDatabaseSize(512)).toBe('1 KB');
  });

  it('TestShowsZeroForMissingSize', () => {
    expect(formatDatabaseSize(0)).toBe('0 KB');
    expect(formatDatabaseSize(Number.NaN)).toBe('0 KB');
  });

  it('TestShowsMegaBytesForBigDatabase', () => {
    expect(formatDatabaseSize(1024 * 1024)).toBe('1 MB');
    expect(formatDatabaseSize(3 * 1024 * 1024)).toBe('3 MB');
    expect(formatDatabaseSize(Math.round(2.5 * 1024 * 1024))).toBe('2.5 MB');
  });
});

describe('formatBackupFileName', () => {
  it('TestNamesBackupWithLocalDate', () => {
    expect(formatBackupFileName(new Date(2026, 10, 21))).toBe('playtime-备份-20261121.zip');
    expect(formatBackupFileName(new Date(2026, 0, 3))).toBe('playtime-备份-20260103.zip');
  });
});

describe('formatCountdown', () => {
  it('TestShowsMinutesAndSeconds', () => {
    expect(formatCountdown(272)).toBe('4 分 32 秒');
  });

  it('TestShowsSecondsOnly', () => {
    expect(formatCountdown(45)).toBe('45 秒');
    expect(formatCountdown(0)).toBe('0 秒');
    expect(formatCountdown(-3)).toBe('0 秒');
  });
});

describe('remainingSeconds', () => {
  it('TestCountsDownToExpiry', () => {
    expect(remainingSeconds('2026-11-21T10:05:00Z', Date.parse('2026-11-21T10:00:00Z'))).toBe(300);
    expect(remainingSeconds('2026-11-21T10:00:01Z', Date.parse('2026-11-21T10:00:00Z'))).toBe(1);
  });

  it('TestReturnsZeroForExpiredOrInvalidLink', () => {
    expect(remainingSeconds('2026-11-21T09:00:00Z', Date.parse('2026-11-21T10:00:00Z'))).toBe(0);
    expect(remainingSeconds('不是时间', Date.now())).toBe(0);
  });
});

describe('formatWhen', () => {
  it('TestShowsTodayTime', () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 14, 9);
    expect(formatWhen(today.toISOString())).toBe('今天 14:09');
  });

  it('TestShowsYesterdayTime', () => {
    const now = new Date();
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 8, 5);
    expect(formatWhen(yesterday.toISOString())).toBe('昨天 08:05');
  });

  it('TestShowsEmptyForMissingTime', () => {
    expect(formatWhen('')).toBe('');
    expect(formatWhen(null)).toBe('');
    expect(formatWhen('不是时间')).toBe('');
  });
});

describe('excerpt', () => {
  it('TestCollapsesWhitespace', () => {
    expect(excerpt('  周五下午\n\n大扫除  ')).toBe('周五下午 大扫除');
  });

  it('TestCutsLongText', () => {
    const text = '一'.repeat(120);
    const result = excerpt(text);
    expect(result.endsWith('…')).toBe(true);
    expect(result.length).toBe(97);
  });
});

describe('errorText', () => {
  it('TestExplainsOffline', () => {
    expect(errorText(new ApiError(0, 'offline', ''))).toBe('教室里的小助手没连上，检查一下网络');
  });

  it('TestPrefersServerMessage', () => {
    expect(errorText(new ApiError(401, 'bad_pin', '密码不对'))).toBe('密码不对');
  });

  it('TestFallsBackWhenMessageMissing', () => {
    expect(errorText(new ApiError(500, 'oops', ''))).toBe('出了点小问题，再试一次');
    expect(errorText(new ApiError(500, 'oops', ''), '自定义提示')).toBe('自定义提示');
  });
});
