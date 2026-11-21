import {
  Flower2,
  Gamepad2,
  Gift,
  Hand,
  Sparkles,
  Target,
} from 'lucide-react';
import { Avatar } from './Avatar';
import { Button } from './Button';
import { FlowerMark } from './FlowerMark';
import type { ApiError } from '../lib/api';
import type { Claim } from '../lib/claim';
import type { ClassStats, StudentFlowers } from '../lib/types';

export interface FlowerBoardProps {
  claim: Claim | null;
  personal: StudentFlowers | null;
  personalLoading: boolean;
  personalError: ApiError | null;
  stats: ClassStats;
  rosterEmpty: boolean;
  onClaim: () => void;
  onRelease: () => void;
  onRewards: () => void;
}

function FlowerRules() {
  return (
    <div className="flower-rules">
      <p className="flower-rules__title">
        <Flower2 size={18} strokeWidth={2} aria-hidden="true" />
        小红花怎么来
      </p>
      <ul className="flower-rules__list">
        <li>
          <span className="flower-rules__icon flower-rules__icon--green" aria-hidden="true">
            <Gamepad2 size={18} strokeWidth={2} />
          </span>
          <span>认真玩一局</span>
          <b>+1</b>
        </li>
        <li>
          <span className="flower-rules__icon flower-rules__icon--sky" aria-hidden="true">
            <Target size={18} strokeWidth={2} />
          </span>
          <span>答对大多数</span>
          <b>+2</b>
        </li>
        <li>
          <span className="flower-rules__icon flower-rules__icon--sun" aria-hidden="true">
            <Sparkles size={18} strokeWidth={2} />
          </span>
          <span>又对又快</span>
          <b>+3</b>
        </li>
      </ul>
    </div>
  );
}

function ClassStatsRow({ stats }: { stats: ClassStats }) {
  return (
    <div className="class-stats">
      <div className="class-stat">
        <span className="class-stat__label">全班今天</span>
        <span className="class-stat__value">
          {stats.flowers_today}
          <small>朵</small>
        </span>
      </div>
      <div className="class-stat class-stat--sky">
        <span className="class-stat__label">全班这周</span>
        <span className="class-stat__value">
          {stats.flowers_week}
          <small>朵</small>
        </span>
      </div>
    </div>
  );
}

export function FlowerBoard({
  claim,
  personal,
  personalLoading,
  personalError,
  stats,
  rosterEmpty,
  onClaim,
  onRelease,
  onRewards,
}: FlowerBoardProps) {
  if (!claim) {
    return (
      <section className="flower-board" aria-label="我的小红花">
        <div className="flower-board__head">
          <span className="flower-board__title">
            <FlowerMark size={26} />
            我的小红花
          </span>
          <span className="flower-board__tag">先认领一下</span>
        </div>

        <div className="flower-board__hero">
          <span className="flower-board__halo" aria-hidden="true">
            <FlowerMark size={92} />
            <span className="flower-board__halo-dot flower-board__halo-dot--one" />
            <span className="flower-board__halo-dot flower-board__halo-dot--two" />
          </span>
          <p className="flower-board__hero-title">找到你自己，就能看到小红花啦</p>
          <p className="flower-board__hero-hint">输入学号，或者名字拼音的开头</p>
        </div>

        <ClassStatsRow stats={stats} />

        <Button
          size="lg"
          block
          icon={<Hand size={26} strokeWidth={2} />}
          onClick={onClaim}
          disabled={rosterEmpty}
        >
          认领我的小红花
        </Button>
        <p className="flower-board__note">
          {rosterEmpty
            ? '名单还没来，先请老师导入名单吧'
            : '认领后 5 分钟内，玩游戏不用再输一遍'}
        </p>

        <FlowerRules />
      </section>
    );
  }

  return (
    <section className="flower-board flower-board--claimed" aria-label="我的小红花">
      <div className="flower-board__head">
        <span className="flower-board__title">
          <FlowerMark size={26} />
          我的小红花
        </span>
        <button type="button" className="text-button" onClick={onRelease}>
          不是我
        </button>
      </div>

      <div className="me-row">
        <Avatar name={claim.name} size={64} />
        <div className="me-row__copy">
          <p className="me-row__name">{claim.name}</p>
          <p className="me-row__sid">学号 {claim.sid}</p>
        </div>
        <span className="me-row__hello">欢迎你</span>
      </div>

      {personal ? (
        <div className="my-flower-hero">
          <span className="my-flower-hero__mark" aria-hidden="true">
            <FlowerMark size={52} />
          </span>
          <div className="my-flower-hero__copy">
            <p className="my-flower-hero__label">一共收到的</p>
            <p className="my-flower-hero__value">
              {personal.balance}
              <small>朵</small>
            </p>
          </div>
          <span className="my-flower-hero__today">今天 +{personal.today}</span>
        </div>
      ) : personalLoading ? (
        <div className="my-flower-hero my-flower-hero--loading" aria-hidden="true">
          <span className="skeleton skeleton--icon" />
          <span className="skeleton skeleton--line skeleton--line-lg" />
        </div>
      ) : (
        <div className="flower-board__fallback">
          <p className="flower-board__fallback-title">
            {personalError ? '你的花还没数出来' : '你的花正在路上'}
          </p>
          <p className="flower-board__fallback-hint">先看看我们班的吧</p>
          <ClassStatsRow stats={stats} />
        </div>
      )}

      <Button
        variant="soft"
        size="md"
        block
        icon={<Gift size={23} strokeWidth={2} />}
        onClick={onRewards}
      >
        看看我的小奖励
      </Button>

      <FlowerRules />
    </section>
  );
}
