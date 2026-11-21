import { useCallback, useEffect, useState } from 'react';
import type { Student } from './types';

export const CLAIM_STORAGE_KEY = 'playtime.student';
export const CLAIM_TTL_MS = 5 * 60 * 1000;

export interface Claim {
  id: number;
  name: string;
  sid: string;
  expiresAt: number;
}

function isClaim(value: unknown): value is Claim {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'number' &&
    typeof record.name === 'string' &&
    typeof record.sid === 'string' &&
    typeof record.expiresAt === 'number'
  );
}

function readClaim(): Claim | null {
  try {
    const raw = window.sessionStorage.getItem(CLAIM_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isClaim(parsed)) {
      window.sessionStorage.removeItem(CLAIM_STORAGE_KEY);
      return null;
    }
    if (parsed.expiresAt <= Date.now()) {
      window.sessionStorage.removeItem(CLAIM_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeClaim(claim: Claim): void {
  try {
    window.sessionStorage.setItem(CLAIM_STORAGE_KEY, JSON.stringify(claim));
  } catch {
    // 隐身模式或存储被禁用时，认领只在本次页面里有效。
  }
}

function removeClaim(): void {
  try {
    window.sessionStorage.removeItem(CLAIM_STORAGE_KEY);
  } catch {
    // 忽略存储被禁用的情况。
  }
}

export interface ClaimState {
  claim: Claim | null;
  setClaim: (student: Student) => Claim;
  clearClaim: () => void;
}

export function useClaim(): ClaimState {
  const [claim, setClaim] = useState<Claim | null>(() => readClaim());

  useEffect(() => {
    if (!claim) return;
    const remaining = claim.expiresAt - Date.now();
    if (remaining <= 0) {
      removeClaim();
      setClaim(null);
      return;
    }
    const timer = window.setTimeout(() => {
      removeClaim();
      setClaim(null);
    }, remaining);
    return () => window.clearTimeout(timer);
  }, [claim]);

  const set = useCallback((student: Student): Claim => {
    const next: Claim = {
      id: student.id,
      name: student.name,
      sid: student.sid,
      expiresAt: Date.now() + CLAIM_TTL_MS,
    };
    writeClaim(next);
    setClaim(next);
    return next;
  }, []);

  const clear = useCallback(() => {
    removeClaim();
    setClaim(null);
  }, []);

  return { claim, setClaim: set, clearClaim: clear };
}
