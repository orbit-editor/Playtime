import { useEffect, useRef } from 'react';

export type ServerEventHandler = (type: string, data: unknown) => void;

const EVENT_TYPES = ['notice', 'flowers', 'students', 'plugins', 'rewards', 'redeems', 'class'] as const;

/** 订阅 /api/events；断线后 3 秒重连。没有后端时安静地重试，不打断页面。 */
export function useSSE(onEvent: ServerEventHandler, enabled = true): void {
  const handlerRef = useRef(onEvent);

  useEffect(() => {
    handlerRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || typeof EventSource === 'undefined') return;
    let source: EventSource | null = null;
    let retryTimer: number | null = null;
    let closed = false;

    const connect = () => {
      if (closed) return;
      try {
        source = new EventSource('/api/events');
      } catch {
        scheduleRetry();
        return;
      }

      for (const type of EVENT_TYPES) {
        source.addEventListener(type, (event) => {
          let data: unknown = null;
          if (event instanceof MessageEvent && typeof event.data === 'string') {
            try {
              data = JSON.parse(event.data) as unknown;
            } catch {
              data = event.data;
            }
          }
          handlerRef.current(type, data);
        });
      }

      source.onerror = () => {
        source?.close();
        source = null;
        scheduleRetry();
      };
    };

    const scheduleRetry = () => {
      if (closed || retryTimer !== null) return;
      retryTimer = window.setTimeout(() => {
        retryTimer = null;
        connect();
      }, 3000);
    };

    connect();

    return () => {
      closed = true;
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      source?.close();
      source = null;
    };
  }, [enabled]);
}
