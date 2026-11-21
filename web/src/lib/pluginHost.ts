// 平台与扩展之间的握手与消息路由，协议见 docs/plugin-api.md。
export interface PluginContextPayload {
  class: { name: string; grade: number };
  student: { id: number; name: string; sid: string };
  plugin: { id: string };
}

export interface SubmitPayload {
  correct: number;
  total: number;
  elapsed: number;
  score?: number;
}

export interface SubmitOutcome {
  flowers: number;
  capped: boolean;
  flowers_today: number;
  flowers_total: number;
}

export interface PluginHostOptions {
  pluginId: string;
  context: () => PluginContextPayload;
  onSubmit: (payload: SubmitPayload) => Promise<SubmitOutcome>;
  onToast?: (text: string) => void;
  onExit?: () => void;
  onReady?: () => void;
  onFail?: (reason: string) => void;
  timeoutMs?: number;
}

const STORAGE_PREFIX = 'pt.storage.';
const STORAGE_LIMIT = 64 * 1024;
const MAX_QUESTIONS = 100000;
const MAX_ROUND_MS = 6 * 60 * 60 * 1000;

function toInt(value: unknown): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.round(num));
}

/** 把扩展报上来的成绩夹紧成合理范围，坏插件也污染不了小红花。 */
export function normalizeSubmit(raw: unknown): SubmitPayload {
  const data = (raw ?? {}) as Record<string, unknown>;
  const total = Math.min(toInt(data.total), MAX_QUESTIONS);
  const correct = Math.min(toInt(data.correct), total);
  const elapsed = Math.min(toInt(data.elapsed), MAX_ROUND_MS);
  const score = data.score === undefined || data.score === null ? undefined : toInt(data.score);
  return score === undefined ? { correct, total, elapsed } : { correct, total, elapsed, score };
}

export function attachPluginHost(iframe: HTMLIFrameElement, options: PluginHostOptions) {
  const timeoutMs = options.timeoutMs ?? 15000;
  let closed = false;
  let ready = false;
  let timer = 0;
  let port: MessagePort | null = null;

  const storageKey = (key: string) => STORAGE_PREFIX + options.pluginId + '.' + key;

  const readStorage = (key: string): string | null => {
    try {
      return window.localStorage.getItem(storageKey(key));
    } catch {
      return null;
    }
  };

  const writeStorage = (key: string, value: unknown): boolean => {
    let text: string;
    try {
      text = typeof value === 'string' ? value : JSON.stringify(value ?? null);
    } catch {
      return false;
    }
    if (text.length > STORAGE_LIMIT) return false;
    try {
      window.localStorage.setItem(storageKey(key), text);
      return true;
    } catch {
      return false;
    }
  };

  // SDK 的请求号是自增数字；原样回传，别转成字符串。
  const reply = (id: unknown, data?: unknown) => {
    if (!closed && port) port.postMessage({ type: 'reply', id, data });
  };

  const handle = async (message: unknown) => {
    if (closed || typeof message !== 'object' || message === null) return;
    const msg = message as Record<string, unknown>;
    const type = typeof msg.type === 'string' ? msg.type : '';
    const id = msg.id as unknown;

    switch (type) {
      case 'ready':
        if (!ready) {
          ready = true;
          window.clearTimeout(timer);
          options.onReady?.();
        }
        return;
      case 'context':
        reply(id, options.context());
        return;
      case 'submit':
        try {
          reply(id, await options.onSubmit(normalizeSubmit(msg.data)));
        } catch {
          reply(id, { flowers: 0, capped: false, flowers_today: 0, flowers_total: 0 });
        }
        return;
      case 'toast': {
        const data = (msg.data ?? {}) as Record<string, unknown>;
        const text = typeof data.text === 'string' ? data.text.slice(0, 120) : '';
        if (text) options.onToast?.(text);
        return;
      }
      case 'storage:get': {
        const data = (msg.data ?? {}) as Record<string, unknown>;
        const key = typeof data.key === 'string' ? data.key : '';
        reply(id, { value: key ? readStorage(key) : null });
        return;
      }
      case 'storage:set': {
        const data = (msg.data ?? {}) as Record<string, unknown>;
        const key = typeof data.key === 'string' ? data.key : '';
        reply(id, { ok: key ? writeStorage(key, data.value) : false });
        return;
      }
      case 'exit':
        options.onExit?.();
        return;
      default:
        return;
    }
  };

  // 每次加载都用一条新的 MessageChannel：转移过的端口不能重复使用。
  const connect = () => {
    if (closed) return;
    if (port) {
      port.onmessage = null;
      port.close();
      port = null;
    }
    ready = false;
    window.clearTimeout(timer);

    const channel = new MessageChannel();
    port = channel.port1;
    port.onmessage = (event: MessageEvent) => {
      void handle(event.data);
    };
    port.start();

    try {
      iframe.contentWindow?.postMessage({ type: 'playtime:hello', version: 1 }, '*', [channel.port2]);
    } catch (error) {
      options.onFail?.(error instanceof Error ? error.message : '交接失败');
      return;
    }

    timer = window.setTimeout(() => {
      if (!closed && !ready) options.onFail?.('游戏 15 秒没有回应');
    }, timeoutMs);
  };

  iframe.addEventListener('load', connect);

  return {
    dispose() {
      closed = true;
      window.clearTimeout(timer);
      iframe.removeEventListener('load', connect);
      if (port) {
        port.onmessage = null;
        port.close();
        port = null;
      }
    },
  };
}
