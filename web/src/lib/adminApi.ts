// 老师工作台与手机版用到的接口，路径与后端 internal/httpapi 一一对应。
import { api } from './api';
import type { Notice, Plugin, SchoolClass } from './types';

export interface MeResponse {
  authenticated: boolean;
  role: string;
}

export interface AdminStudent {
  id: number;
  sid: string;
  name: string;
  pinyin: string;
  enabled: boolean;
  balance: number;
  today: number;
}

export interface AdminReward {
  id: number;
  title: string;
  cost: number;
  weekly_limit: number;
  enabled: boolean;
}

export interface AdminRedeem {
  id: number;
  student_id: number;
  student_name: string;
  reward_id: number;
  reward_title: string;
  cost: number;
  status: string;
  created_at: string;
}

export interface AdminStats {
  db_bytes: number;
  backup_at: string;
  plugins: number;
  students: number;
  flowers_week: number;
  version: string;
  port: number;
  lan_urls: string[];
}

export interface CatalogEntry {
  id: string;
  name: string;
  description: string;
  author: string;
  repo: string;
  commit: string;
  sha256: string;
  icon: string;
  size: number;
  grades: number[] | null;
  installed?: boolean;
}

export interface AdminPlugin extends Plugin {
  author?: string;
  icon?: string;
  icon_url?: string;
  builtin?: boolean;
  kind?: string;
  scoring?: boolean;
  entry?: string;
}

export interface JoinLink {
  token: string;
  url: string;
  lan_urls: string[];
  expires_at: string;
}

export interface ImportResult {
  added: number;
  updated: number;
  skipped: number;
}

export const adminApi = {
  me(): Promise<MeResponse> {
    return api.get<MeResponse>('/api/auth/me');
  },
  login(pin: string): Promise<{ ok: boolean }> {
    return api.post<{ ok: boolean }>('/api/auth/pin', { pin });
  },
  logout(): Promise<{ ok: boolean }> {
    return api.post<{ ok: boolean }>('/api/auth/logout', {});
  },
  changePIN(pin: string): Promise<{ ok: boolean }> {
    // 会话已经证明是老师本人，后端不再要求旧密码。
    return api.post<{ ok: boolean }>('/api/admin/pin', { new: pin });
  },
  stats(): Promise<AdminStats> {
    return api.get<AdminStats>('/api/admin/stats');
  },
  classInfo(): Promise<{ class: SchoolClass; configured: boolean }> {
    return api.get<{ class: SchoolClass; configured: boolean }>('/api/admin/class');
  },
  saveClass(input: SchoolClass): Promise<{ ok: boolean }> {
    return api.post<{ ok: boolean }>('/api/admin/class', input);
  },
  notices(): Promise<{ notices: Notice[] }> {
    return api.get<{ notices: Notice[] }>('/api/admin/notices');
  },
  createNotice(input: { title: string; body: string; pinned: boolean }): Promise<{ id: number }> {
    return api.post<{ id: number }>('/api/admin/notices', input);
  },
  updateNotice(id: number, input: { title: string; body: string; pinned: boolean }): Promise<{ ok: boolean }> {
    return api.put<{ ok: boolean }>('/api/admin/notices/' + String(id), input);
  },
  deleteNotice(id: number): Promise<{ ok: boolean }> {
    return api.delete<{ ok: boolean }>('/api/admin/notices/' + String(id));
  },
  students(): Promise<{ students: AdminStudent[] }> {
    return api.get<{ students: AdminStudent[] }>('/api/admin/students');
  },
  importStudents(text: string, mode: 'merge' | 'replace' = 'merge'): Promise<ImportResult> {
    return api.post<ImportResult>('/api/admin/students/import', { text, mode });
  },
  setStudentEnabled(id: number, enabled: boolean): Promise<{ ok: boolean }> {
    return api.patch<{ ok: boolean }>('/api/admin/students/' + String(id), { enabled });
  },
  exportStudentsCSV(): Promise<Blob> {
    return api.download('/api/admin/students/export');
  },
  rewards(): Promise<{ rewards: AdminReward[] }> {
    return api.get<{ rewards: AdminReward[] }>('/api/admin/rewards');
  },
  createReward(input: { title: string; cost: number; weekly_limit: number; enabled: boolean }): Promise<{ id: number }> {
    return api.post<{ id: number }>('/api/admin/rewards', input);
  },
  updateReward(id: number, input: { title: string; cost: number; weekly_limit: number; enabled: boolean }): Promise<{ ok: boolean }> {
    return api.put<{ ok: boolean }>('/api/admin/rewards/' + String(id), input);
  },
  deleteReward(id: number): Promise<{ ok: boolean }> {
    return api.delete<{ ok: boolean }>('/api/admin/rewards/' + String(id));
  },
  redeems(status: 'pending' | 'approved' | 'rejected' | '' = ''): Promise<{ redeems: AdminRedeem[] }> {
    return api.get<{ redeems: AdminRedeem[] }>('/api/admin/redeems', status ? { status } : undefined);
  },
  decideRedeem(id: number, approve: boolean): Promise<{ ok: boolean }> {
    return api.post<{ ok: boolean }>('/api/admin/redeems/' + String(id) + '/decide', { approve });
  },
  link(): Promise<JoinLink> {
    return api.post<JoinLink>('/api/admin/link', {});
  },
  plugins(): Promise<{ plugins: AdminPlugin[] }> {
    return api.get<{ plugins: AdminPlugin[] }>('/api/admin/plugins');
  },
  catalog(refresh = false): Promise<{ plugins: CatalogEntry[]; updated_at?: string; error?: string }> {
    return api.get<{ plugins: CatalogEntry[]; updated_at?: string; error?: string }>(
      '/api/admin/catalog',
      refresh ? { refresh: 1 } : undefined,
    );
  },
  installPlugin(id: string): Promise<{ ok: boolean; message?: string }> {
    return api.post<{ ok: boolean; message?: string }>('/api/admin/plugins/install', { id });
  },
  uploadPlugin(file: File): Promise<{ ok: boolean; message?: string }> {
    return api.upload<{ ok: boolean; message?: string }>('/api/admin/plugins/upload', file);
  },
  togglePlugin(id: string, enabled: boolean): Promise<{ ok: boolean }> {
    return api.patch<{ ok: boolean }>('/api/admin/plugins/' + encodeURIComponent(id), { enabled });
  },
  uninstallPlugin(id: string): Promise<{ ok: boolean }> {
    return api.delete<{ ok: boolean }>('/api/admin/plugins/' + encodeURIComponent(id));
  },
  backup(): Promise<Blob> {
    return api.download('/api/admin/backup');
  },
  restore(file: File): Promise<{ ok: boolean; students: number }> {
    return api.upload<{ ok: boolean; students: number }>('/api/admin/restore', file);
  },
  quit(): Promise<{ ok: boolean; message: string }> {
    return api.post<{ ok: boolean; message: string }>('/api/admin/quit', {});
  },
};
