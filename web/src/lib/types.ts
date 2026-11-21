export interface SchoolClass {
  id?: number;
  name: string;
  grade: number;
  school: string;
}

export interface Notice {
  id: number;
  title: string;
  body: string;
  pinned: boolean;
  created_at?: string;
}

export interface Plugin {
  id: string;
  name: string;
  version: string;
  description: string;
  grades: number[];
  /** 后端只返回启用的扩展；兼容显式传 false 的情况。 */
  enabled?: boolean;
}

export interface ClassStats {
  students: number;
  flowers_today: number;
  flowers_week: number;
}

export interface Bootstrap {
  class: SchoolClass | null;
  configured: boolean;
  notice: Notice | null;
  notices_count: number;
  plugins: Plugin[];
  stats: ClassStats;
  lan_urls: string[];
  port: number;
}

export interface Student {
  id: number;
  sid: string;
  name: string;
  pinyin?: string;
  flowers_today: number;
  flowers_total: number;
  duplicate_name: boolean;
}

export interface IdentifyResponse {
  students: Student[];
}

export interface Reward {
  id: number;
  title: string;
  cost: number;
  affordable: boolean;
  weekly_left: number;
  pending: boolean;
}

export interface StudentFlowers {
  balance: number;
  today: number;
  rewards: Reward[];
}

export interface LeaderRow {
  student_id: number;
  name: string;
  flowers: number;
}

export interface Leaderboard {
  rows: LeaderRow[];
}
