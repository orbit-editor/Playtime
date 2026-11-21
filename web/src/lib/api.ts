import type {
  Bootstrap,
  IdentifyResponse,
  Leaderboard,
  StudentFlowers,
} from './types';

export type QueryValue = string | number | boolean | undefined;
export type Query = Record<string, QueryValue>;

/** 面向界面的接口错误。status 为 0 表示网络没有连上。 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message?: string) {
    super(message && message.length > 0 ? message : code);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

const BASE_HEADERS: Record<string, string> = {
  Accept: 'application/json',
  // 后端用它挡住其他网页偷偷发来的写请求。
  'X-Playtime': '1',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function textOf(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function withQuery(path: string, params?: Query): string {
  if (!params) return path;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value));
  }
  const query = search.toString();
  if (!query) return path;
  return path + (path.includes('?') ? '&' : '?') + query;
}

async function readFailure(res: Response): Promise<{ code: string; message: string }> {
  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }
  let code = 'http_' + String(res.status);
  let message = '';
  if (isRecord(payload)) {
    const nested = isRecord(payload.error) ? payload.error : null;
    const embeddedCode = textOf(payload.code);
    const nestedCode = nested ? textOf(nested.code) : null;
    const embeddedMessage = textOf(payload.message);
    const nestedMessage = nested ? textOf(nested.message) : null;
    code = nestedCode ?? embeddedCode ?? code;
    message = nestedMessage ?? embeddedMessage ?? '';
  }
  return { code, message };
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { credentials: 'same-origin', ...init });
  } catch {
    throw new ApiError(0, 'offline', '教室的小助手没有连上');
  }
  if (!res.ok) {
    const failure = await readFailure(res);
    throw new ApiError(res.status, failure.code, failure.message);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  try {
    return (await res.json()) as T;
  } catch {
    throw new ApiError(res.status, 'invalid_response', '收到了一份看不懂的回信');
  }
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof Error) return new ApiError(0, 'unknown', error.message);
  return new ApiError(0, 'unknown', '出了点小问题');
}

function send<T>(method: string, path: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method, headers: BASE_HEADERS };
  if (body !== undefined) {
    init.headers = { ...BASE_HEADERS, 'Content-Type': 'application/json' };
    init.body = JSON.stringify(body);
  }
  return request<T>(path, init);
}

export const api = {
  get<T>(path: string, params?: Query): Promise<T> {
    return request<T>(withQuery(path, params), {
      method: 'GET',
      headers: BASE_HEADERS,
    });
  },
  post<T>(path: string, body: unknown): Promise<T> {
    return send<T>('POST', path, body);
  },
  put<T>(path: string, body: unknown): Promise<T> {
    return send<T>('PUT', path, body);
  },
  patch<T>(path: string, body: unknown): Promise<T> {
    return send<T>('PATCH', path, body);
  },
  delete<T>(path: string): Promise<T> {
    return send<T>('DELETE', path);
  },
  /** 上传文件（multipart），用于导入备份。 */
  async upload<T>(path: string, file: File, field = 'file'): Promise<T> {
    const form = new FormData();
    form.append(field, file);
    let res: Response;
    try {
      res = await fetch(path, { method: 'POST', headers: BASE_HEADERS, body: form, credentials: 'same-origin' });
    } catch {
      throw new ApiError(0, 'offline', '教室的小助手没有连上');
    }
    if (!res.ok) {
      const failure = await readFailure(res);
      throw new ApiError(res.status, failure.code, failure.message);
    }
    return (await res.json()) as T;
  },
  /** 下载文件（备份 zip / 导出 CSV）。 */
  async download(path: string): Promise<Blob> {
    let res: Response;
    try {
      res = await fetch(path, { headers: BASE_HEADERS, credentials: 'same-origin' });
    } catch {
      throw new ApiError(0, 'offline', '教室的小助手没有连上');
    }
    if (!res.ok) {
      const failure = await readFailure(res);
      throw new ApiError(res.status, failure.code, failure.message);
    }
    return res.blob();
  },
};

/** 供页面直接使用的数据方法，接口路径集中在这里。 */
export const apiCalls = {
  bootstrap(): Promise<Bootstrap> {
    return api.get<Bootstrap>('/api/bootstrap');
  },
  identify(q: string): Promise<IdentifyResponse> {
    return api.post<IdentifyResponse>('/api/identify', { q });
  },
  studentFlowers(studentId: number): Promise<StudentFlowers> {
    return api.get<StudentFlowers>('/api/students/' + String(studentId) + '/flowers');
  },
  leaderboard(range: 'today' | 'week' = 'today'): Promise<Leaderboard> {
    return api.get<Leaderboard>('/api/leaderboard', { range });
  },
};
