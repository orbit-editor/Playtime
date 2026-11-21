import { useCallback, useEffect, useRef, useState } from 'react';

export interface LoadState<T> {
  data: T | null;
  loading: boolean;
  error: unknown;
  reload: () => Promise<void>;
}

/**
 * 打开面板时拉一次数据，之后靠传进来的 tick 在 SSE 事件到达时静默刷新。
 * 编辑中的草稿由面板自己保存，不会被这里的刷新覆盖。
 */
export function useLoad<T>(loader: () => Promise<T>, deps: ReadonlyArray<unknown>): LoadState<T> {
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const tokenRef = useRef(0);
  const aliveRef = useRef(true);
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const reload = useCallback(async () => {
    const token = ++tokenRef.current;
    setLoading(true);
    try {
      const next = await loaderRef.current();
      if (!aliveRef.current || token !== tokenRef.current) return;
      setData(next);
      setError(null);
    } catch (err) {
      if (!aliveRef.current || token !== tokenRef.current) return;
      setError(err);
    } finally {
      if (aliveRef.current && token === tokenRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    void reload();
    return () => {
      aliveRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error, reload };
}
