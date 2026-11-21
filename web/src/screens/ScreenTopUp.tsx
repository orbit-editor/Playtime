import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Flower2, Hand, Loader2 } from 'lucide-react';
import { FlowerMark } from '../components/FlowerMark';
import { Button } from '../components/Button';
import { useClaim } from '../lib/claim';
import { useLeaderboard } from '../lib/useApi';

/** 赠花/兑换的过渡占位页，保留路由位置，后续任务接入真实接口。 */
export function ScreenTopUp() {
  const navigate = useNavigate();
  const { claim } = useClaim();
  const leaderboard = useLeaderboard('week');

  return (
    <div className="screen screen-topup">
      <header className="sub-header">
        <button type="button" className="icon-button" onClick={() => navigate('/')} aria-label="回首页">
          <ArrowLeft size={28} strokeWidth={2.2} aria-hidden="true" />
        </button>
        <div className="sub-header__copy">
          <p className="sub-header__eyebrow">小红花</p>
          <h1 className="sub-header__title">给认真玩的小朋友送花</h1>
        </div>
        <FlowerMark size={40} />
      </header>
      <main className="placeholder-main">
        <div className="placeholder-card">
          <span className="placeholder-card__icon" aria-hidden="true">
            {claim ? <FlowerMark size={64} /> : <Hand size={64} strokeWidth={1.6} />}
          </span>
          <h2>{claim ? claim.name + '，送花马上就能用' : '先认领自己，再给同学送花'}</h2>
          <p>
            {claim
              ? '这里以后可以给同学送小红花，现在先回首页玩一局吧。'
              : '回到首页认领，就能看到自己的小红花，也能给同学送花。'}
          </p>
          {leaderboard.loading && claim ? (
            <p className="placeholder-card__loading">
              <Loader2 size={18} className="spin" aria-hidden="true" />
              正在看看这周谁最棒…
            </p>
          ) : null}
          <Button
            variant="ghost"
            size="lg"
            icon={claim ? Flower2 : undefined}
            onClick={() => navigate('/')}
          >
            回首页
          </Button>
        </div>
      </main>
    </div>
  );
}
