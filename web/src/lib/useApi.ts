import { useCallback, useEffect, useRef, useState } from 'react';
import { apiCalls, toApiError, type ApiError } from './api';
import type {
  Bootstrap,
  Leaderboard,
  Plugin,
  StudentFlowers,
} from './types';

export interface Resource<T> {
  data: T | null;
  loading: boolean;
  error: ApiError | null;
  refresh: () => void;
}

export function useApi<T>(load: () => Promise<T>, deps: readonly unknown[]): Resource<T> {
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    loadRef
      .current()
      .then((next) => {
        if (alive) setData(next);
      })
      .catch((reason: unknown) => {
        if (alive) setError(toApiError(reason));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
    // deps 由调用方声明，tick 用于手动刷新。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const refresh = useCallback(() => setTick((value) => value + 1), []);
  return { data, loading, error, refresh };
}

const FALLBACK_GAMES: Plugin[] = [
  {
    id: 'math-sprint',
    name: '口算闯关',
    version: '1.0.0',
    description: '一分钟口算，看看你能闯过几关。',
    grades: [3, 4],
    enabled: true,
  },
];

export const FALLBACK_BOOTSTRAP: Bootstrap = {
  class: { name: '我们的教室', grade: 3, school: '' },
  configured: true,
  notice: null,
  notices_count: 0,
  games: FALLBACK_GAMES,
  plugins: FALLBACK_GAMES,
  stats: { students: 0, flowers_today: 0, flowers_week: 0 },
  lan_urls: [],
  port: 8730,
};

/** 新版后端返回 games，旧版返回 plugins；两个字段都兼容。 */
export function gamesOf(bootstrap: Bootstrap | null | undefined): Plugin[] {
  if (!bootstrap) return [];
  const list = bootstrap.games ?? bootstrap.plugins;
  return Array.isArray(list) ? list : [];
}

export interface BootstrapResource extends Resource<Bootstrap> {
  degraded: boolean;
}

export function useBootstrap(): BootstrapResource {
  const resource = useApi<Bootstrap>(apiCalls.bootstrap, []);
  const degraded = resource.error !== null;
  const data = resource.data ?? (degraded ? FALLBACK_BOOTSTRAP : null);
  return { ...resource, data, degraded };
}

export function useLeaderboard(range: 'today' | 'week' = 'today'): Resource<Leaderboard> {
  return useApi<Leaderboard>(() => apiCalls.leaderboard(range), [range]);
}

export function useStudentFlowers(studentId: number | null): Resource<StudentFlowers | null> {
  return useApi<StudentFlowers | null>(
    () => (studentId === null ? Promise.resolve(null) : apiCalls.studentFlowers(studentId)),
    [studentId],
  );
}
