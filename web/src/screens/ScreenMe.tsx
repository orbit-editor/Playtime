import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Gift, Hand } from 'lucide-react';
import { Button } from '../components/Button';
import { FlowerMark } from '../components/FlowerMark';
import { useClaim } from '../lib/claim';
import { useStudentFlowers } from '../lib/useApi';

export function ScreenMe() {
  const navigate = useNavigate();
  const { claim } = useClaim();
  const flowers = useStudentFlowers(claim ? claim.id : null);

  return (
    <div className="screen screen-me">
      <header className="sub-header">
        <button type="button" className="icon-button" onClick={() => navigate('/')} aria-label="回首页">
          <ArrowLeft size={28} strokeWidth={2.2} aria-hidden="true" />
        </button>
        <div className="sub-header__copy">
          <p className="sub-header__eyebrow">我的小红花</p>
          <h1 className="sub-header__title">{claim ? claim.name + '的小红花' : '我的小红花'}</h1>
        </div>
        <FlowerMark size={44} />
      </header>

      <main className="me-main">
        {!claim ? (
          <section className="me-panel me-panel--empty">
            <span className="me-panel__big-icon" aria-hidden="true">
              <Hand size={54} strokeWidth={1.7} />
            </span>
            <h2>先认领一下，才能看到自己的小红花</h2>
            <p>回到首页点「认领我的小红花」，输入学号或拼音开头就好。</p>
            <Button size="lg" onClick={() => navigate('/')}>
              回首页认领
            </Button>
          </section>
        ) : (
          <div className="me-columns">
            <section className="me-panel me-panel--score">
              <p className="me-panel__eyebrow">我的小红花</p>
              <div className="me-score">
                <FlowerMark size={66} />
                <span className="me-score__value">{flowers.data?.balance ?? '—'}</span>
                <span className="me-score__unit">朵</span>
              </div>
              <p className="me-score__today">今天又得到 {flowers.data?.today ?? 0} 朵</p>
              <p className="me-score__note">每一次认真玩，都会留下小红花。</p>
            </section>

            <section className="me-panel me-panel--rewards">
              <div className="me-panel__head">
                <span>
                  <Gift size={24} strokeWidth={2} aria-hidden="true" />
                  想要的小奖励
                </span>
                <span className="me-panel__hint">想换哪个，告诉老师就好</span>
              </div>
              {flowers.data && flowers.data.rewards.length > 0 ? (
                <ul className="reward-list">
                  {flowers.data.rewards.map((reward) => (
                    <li key={reward.id} className="reward">
                      <span className="reward__title">{reward.title}</span>
                      <span className="reward__cost">
                        <FlowerMark size={16} />
                        {reward.cost} 朵
                      </span>
                      <span className={'reward__state' + (reward.affordable ? ' reward__state--ok' : '')}>
                        {reward.pending
                          ? '等老师确认'
                          : reward.weekly_left === 0
                            ? '这周换过啦'
                            : reward.affordable
                              ? '可以换'
                              : '再攒一攒'}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="me-panel__fallback">
                  {flowers.loading ? '正在把奖励摆出来…' : '小奖励还在准备中，先攒小红花吧。'}
                </p>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
