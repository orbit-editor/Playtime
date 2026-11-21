import { ChevronRight, Megaphone } from 'lucide-react';
import type { Notice } from '../lib/types';

export interface NoticeBarProps {
  notice: Notice | null;
  count?: number;
}

/** 顶部通知条；没有通知时整条收起，高度为 0，不占位置。 */
export function NoticeBar({ notice, count = 0 }: NoticeBarProps) {
  if (!notice) {
    return <div className="notice-bar notice-bar--collapsed collapsed" aria-hidden="true" />;
  }

  const extra = Math.max(0, count - 1);

  return (
    <section className="notice-bar" aria-label="最新通知">
      <span className="notice-bar__icon" aria-hidden="true">
        <Megaphone size={24} strokeWidth={2.1} />
      </span>
      <div className="notice-bar__copy">
        <p className="notice-bar__title">{notice.title}</p>
        <p className="notice-bar__body">{notice.body}</p>
      </div>
      {extra > 0 ? (
        <span className="notice-bar__more">
          还有 {extra} 条
          <ChevronRight size={20} strokeWidth={2.2} aria-hidden="true" />
        </span>
      ) : null}
    </section>
  );
}
