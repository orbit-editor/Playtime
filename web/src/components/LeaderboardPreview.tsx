import { ChevronRight, Trophy } from 'lucide-react';
import { Avatar } from './Avatar';
import { FlowerMark } from './FlowerMark';
import type { ApiError } from '../lib/api';
import type { LeaderRow } from '../lib/types';

export interface LeaderboardPreviewProps {
  rows: LeaderRow[];
  loading: boolean;
  error: ApiError | null;
  claimId: number | null;
  onSeeAll: () => void;
}

export function LeaderboardPreview({
  rows,
  loading,
  error,
  claimId,
  onSeeAll,
}: LeaderboardPreviewProps) {
  const visible = rows.slice(0, 5);

  return (
    <section className="leaderboard" aria-label="今天的红花榜">
      <div className="leaderboard__head">
        <span className="leaderboard__title">
          <span className="leaderboard__trophy" aria-hidden="true">
            <Trophy size={22} strokeWidth={2} />
          </span>
          今天的红花榜
        </span>
        <button type="button" className="text-button text-button--arrow" onClick={onSeeAll}>
          看全部
          <ChevronRight size={18} strokeWidth={2.4} aria-hidden="true" />
        </button>
      </div>

      {loading && visible.length === 0 ? (
        <div className="leaderboard__loading" aria-hidden="true">
          {[0, 1, 2].map((item) => (
            <span className="skeleton skeleton--chip" key={item} />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="leaderboard__empty">
          <span className="leaderboard__empty-icon" aria-hidden="true">
            <Trophy size={26} strokeWidth={1.8} />
          </span>
          <p>{error ? '红花榜正在赶来的路上，等一下再看看吧' : '今天还没有人上榜，快去当第一名'}</p>
        </div>
      ) : (
        <div className="leaderboard__strip">
          {visible.map((row, index) => (
            <div
              key={row.student_id}
              className={
                'leader-chip' +
                (index === 0 ? ' leader-chip--first' : '') +
                (index === 1 ? ' leader-chip--second' : '') +
                (index === 2 ? ' leader-chip--third' : '') +
                (row.student_id === claimId ? ' leader-chip--me' : '')
              }
            >
              <span className="leader-chip__rank">{index + 1}</span>
              <Avatar name={row.name} size={40} />
              <span className="leader-chip__copy">
                <span className="leader-chip__name">{row.name}</span>
                <span className="leader-chip__flowers">
                  <FlowerMark size={14} />
                  {row.flowers} 朵
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
