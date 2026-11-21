import { ArrowRight, Calculator, Gamepad2, Puzzle, Sparkles } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Empty } from './Empty';
import { gradesLabel } from '../lib/format';
import type { Plugin } from '../lib/types';

export interface GameWallProps {
  games: Plugin[];
  loading?: boolean;
  onPlay: (plugin: Plugin) => void;
}

function iconFor(plugin: Plugin): LucideIcon {
  if (plugin.id.includes('math')) return Calculator;
  if (plugin.id.includes('puzzle')) return Puzzle;
  return Gamepad2;
}

export function GameWall({ games, loading = false, onPlay }: GameWallProps) {
  const visible = games.filter((plugin) => plugin.enabled !== false);
  const solo = visible.length === 1;

  let body;
  if (loading && visible.length === 0) {
    body = (
      <div className="game-wall__grid" aria-hidden="true">
        {[0, 1, 2].map((item) => (
          <div className="game-card game-card--skeleton" key={item}>
            <span className="skeleton skeleton--icon" />
            <span className="skeleton skeleton--line skeleton--line-lg" />
            <span className="skeleton skeleton--line" />
          </div>
        ))}
      </div>
    );
  } else if (visible.length === 0) {
    body = (
      <div className="game-wall__empty">
        <Empty
          icon={Sparkles}
          title="还没有游戏"
          hint="等老师装上小游戏，这里就会热闹起来"
        />
      </div>
    );
  } else {
    body = (
      <div className={'game-wall__grid' + (solo ? ' game-wall__grid--solo' : '')}>
        {visible.map((plugin) => {
          const Icon = iconFor(plugin);
          return (
            <button
              type="button"
              key={plugin.id}
              className={'game-card' + (solo ? ' game-card--hero' : '')}
              data-testid="game-card"
              onClick={() => onPlay(plugin)}
            >
              <span className="game-card__art" aria-hidden="true">
                <span className="game-card__art-ring" />
                <span className="game-card__art-ring game-card__art-ring--two" />
                <span className="game-card__icon">
                  <Icon size={solo ? 116 : 64} strokeWidth={1.7} />
                </span>
                {solo ? (
                  <span className="game-card__art-flower">
                    <Sparkles size={28} strokeWidth={2} />
                  </span>
                ) : null}
              </span>
              <span className="game-card__copy">
                {solo ? <span className="game-card__eyebrow">今天玩这个</span> : null}
                <span className="game-card__name">{plugin.name}</span>
                <span className="game-card__desc">{plugin.description}</span>
                {plugin.grades.length > 0 ? (
                  <span className="game-card__grades">适合{gradesLabel(plugin.grades)}</span>
                ) : null}
              </span>
              <span className="game-card__play">
                开始玩
                <ArrowRight size={22} strokeWidth={2.4} aria-hidden="true" />
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <section className="game-wall" aria-label="小游戏">
      <div className="game-wall__head">
        <div>
          <h2 className="game-wall__title">课间玩一玩</h2>
          <p className="game-wall__sub">挑一个喜欢的，点一下就开始</p>
        </div>
        {visible.length > 0 ? (
          <span className="game-wall__count">{visible.length} 个小游戏</span>
        ) : null}
      </div>
      {body}
    </section>
  );
}
