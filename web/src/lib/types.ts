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
  /** 入口文件的相对路径，缺省按 index.html 打开；后端返回时是 /ext/<id>/<entry> 形式，可直接用。 */
  entry?: string;
  /** 图标地址，形如 /ext/<id>/icon.svg。 */
  icon_url?: string;
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
  /** 新版后端用 games 返回游戏清单。 */
  games?: Plugin[];
  /** 旧版字段，保留兼容。 */
  plugins?: Plugin[];
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

export interface FlowerEntry {
  delta: number;
  reason: string;
  at: string;
}

export interface StudentFlowers {
  balance: number;
  today: number;
  rewards: Reward[];
  /** 最近几笔小红花记录，可能缺省。 */
  recent?: FlowerEntry[];
}

export interface LeaderRow {
  student_id: number;
  name: string;
  flowers: number;
}

export interface Leaderboard {
  rows: LeaderRow[];
}
