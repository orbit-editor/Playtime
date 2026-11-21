import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Flower2, Trophy } from 'lucide-react';
import { Avatar } from '../components/Avatar';
import { FlowerMark } from '../components/FlowerMark';
import { Empty } from '../components/Empty';
import { useBootstrap, useLeaderboard } from '../lib/useApi';

export function ScreenBoard() {
  const navigate = useNavigate();
  const bootstrap = useBootstrap();
  const leaderboard = useLeaderboard('today');
  const rows = leaderboard.data?.rows ?? [];
  const visible = rows.slice(0, 24);

  return (
    <div className="screen screen-board">
      <header className="sub-header">
        <button type="button" className="icon-button" onClick={() => navigate('/')} aria-label="回首页">
          <ArrowLeft size={28} strokeWidth={2.2} aria-hidden="true" />
        </button>
        <div className="sub-header__copy">
          <p className="sub-header__eyebrow">红花榜</p>
          <h1 className="sub-header__title">今天的红花榜</h1>
        </div>
        <div className="sub-header__right">
          <FlowerMark size={42} />
          <div>
            <p className="sub-header__class">{bootstrap.data?.class?.name ?? '我们的教室'}</p>
            <p className="sub-header__hint">每一朵，都是认真玩出来的</p>
          </div>
        </div>
      </header>

      <main className="board-main">
        <section className="board-panel" aria-label="今天的红花榜">
          <div className="board-panel__head">
            <span className="board-panel__title">
              <Trophy size={24} strokeWidth={2} aria-hidden="true" />
              今天收到最多小红花的同学
            </span>
            <span className="board-panel__count">{rows.length} 位同学上榜</span>
          </div>

          {leaderboard.loading && rows.length === 0 ? (
            <div className="board-loading" aria-hidden="true">
              {[0, 1, 2, 3, 4, 5].map((item) => (
                <span className="skeleton skeleton--row" key={item} />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <Empty
              icon={Flower2}
              title="今天还没有人上榜"
              hint="去首页玩一局，第一朵小红花就是你的"
            />
          ) : (
            <div className="board-grid">
              {visible.map((row, index) => (
                <div className="board-row" key={row.student_id}>
                  <span className={'board-row__rank' + (index < 3 ? ' board-row__rank--top' : '')}>
                    {index + 1}
                  </span>
                  <Avatar name={row.name} size={46} />
                  <span className="board-row__name">{row.name}</span>
                  <span className="board-row__flowers">
                    <FlowerMark size={18} />
                    {row.flowers} 朵
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
