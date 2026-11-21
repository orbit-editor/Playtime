import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Gift, Hand, Sparkles, Trophy } from 'lucide-react';
import { Button } from '../components/Button';
import { FlowerMark } from '../components/FlowerMark';
import { Sheet } from '../components/Sheet';
import { useToast } from '../components/Toast';
import { api, toApiError } from '../lib/api';
import { useClaim } from '../lib/claim';
import { useBootstrap, useStudentFlowers } from '../lib/useApi';
import type { Reward } from '../lib/types';

/** 把 ISO 时间写成「今天 14:16」这样孩子看得懂的样子。 */
function formatShort(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  const clock = String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0');
  if (sameDay) return '今天 ' + clock;
  return String(date.getMonth() + 1) + '月' + String(date.getDate()) + '日 ' + clock;
}

export function ScreenMe() {
  const navigate = useNavigate();
  const toast = useToast();
  const { claim } = useClaim();
  const bootstrap = useBootstrap();
  const flowers = useStudentFlowers(claim ? claim.id : null);
  const [picked, setPicked] = useState<Reward | null>(null);
  const [busy, setBusy] = useState(false);

  const stats = bootstrap.data?.stats;

  const confirmRedeem = () => {
    if (!claim || !picked || busy) return;
    setBusy(true);
    api
      .post<{ redeem_id: number; status: string }>('/api/redeem', {
        student_id: claim.id,
        reward_id: picked.id,
      })
      .then(() => {
        toast.show('已经告诉老师啦，等老师确认', 'success');
        setPicked(null);
        flowers.refresh();
      })
      .catch((error: unknown) => {
        const failure = toApiError(error);
        const text =
          failure.code === 'insufficient'
            ? '小红花还不够，再玩一局吧'
            : failure.code === 'pending'
              ? '这个已经申请过啦，等老师确认'
              : failure.code === 'limit'
                ? '这个奖励这周已经换过啦'
                : failure.message || '没换成，等一下再试';
        toast.show(text, 'error');
      })
      .finally(() => setBusy(false));
  };

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

              <div className="me-classrow">
                <div className="me-classrow__cell">
                  <span>全班今天</span>
                  <strong>{stats ? stats.flowers_today : '—'}</strong>
                </div>
                <div className="me-classrow__cell me-classrow__cell--sky">
                  <span>全班这周</span>
                  <strong>{stats ? stats.flowers_week : '—'}</strong>
                </div>
              </div>

              <div className="me-rules">
                <p className="me-rules__title">
                  <Sparkles size={18} strokeWidth={2} aria-hidden="true" />
                  小红花怎么来
                </p>
                <ul>
                  <li>
                    <span>认真玩一局</span>
                    <b>+1</b>
                  </li>
                  <li>
                    <span>答对大多数</span>
                    <b>+2</b>
                  </li>
                  <li>
                    <span>又对又快</span>
                    <b>+3</b>
                  </li>
                </ul>
              </div>

              {flowers.data && flowers.data.recent && flowers.data.recent.length > 0 ? (
                <div className="me-ledger">
                  <p className="me-ledger__title">最近的记录</p>
                  <ul>
                    {flowers.data.recent.map((entry, index) => (
                      <li key={String(index) + entry.at}>
                        <span className="me-ledger__what">
                          {entry.reason === 'play' ? '玩了一局' : entry.reason === 'redeem' ? '换了奖励' : '老师奖的'}
                        </span>
                        <span className="me-ledger__when">{formatShort(entry.at)}</span>
                        <b className={entry.delta >= 0 ? 'me-ledger__plus' : 'me-ledger__minus'}>
                          {entry.delta >= 0 ? '+' : ''}
                          {entry.delta}
                        </b>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <p className="me-score__note">每一次认真玩，都会留下小红花。</p>
            </section>

            <section className="me-panel me-panel--rewards">
              <div className="me-panel__head">
                <span>
                  <Gift size={24} strokeWidth={2} aria-hidden="true" />
                  想要的小奖励
                </span>
                <span className="me-panel__hint">换好了，老师会来找你</span>
              </div>
              {flowers.data && flowers.data.rewards.length > 0 ? (
                <ul className="reward-list">
                  {flowers.data.rewards.map((reward) => {
                    const ready = reward.affordable && !reward.pending && reward.weekly_left > 0;
                    return (
                      <li key={reward.id} className="reward">
                        <span className="reward__title">{reward.title}</span>
                        <span className="reward__cost">
                          <FlowerMark size={16} />
                          {reward.cost} 朵
                        </span>
                        {ready ? (
                          <Button size="sm" className="reward__action" onClick={() => setPicked(reward)}>
                            换这个
                          </Button>
                        ) : (
                          <span className={'reward__state' + (reward.pending ? ' reward__state--ok' : '')}>
                            {reward.pending
                              ? '等老师确认'
                              : reward.weekly_left === 0
                                ? '这周换过啦'
                                : '再攒一攒'}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="me-panel__fallback">
                  {flowers.loading ? '正在把奖励摆出来…' : '小奖励还在准备中，先攒小红花吧。'}
                </p>
              )}

              <div className="me-tip">
                <Trophy size={20} strokeWidth={2} aria-hidden="true" />
                <p>每天最多拿 20 朵，全班一天最多 200 朵。想让老师加新奖励，直接跟老师说。</p>
              </div>
            </section>
          </div>
        )}
      </main>

      <Sheet
        open={picked !== null}
        onClose={() => (busy ? undefined : setPicked(null))}
        label="确认兑换"
        variant="bottom"
        panelClassName="redeem-sheet"
      >
        <div className="redeem-sheet__body">
          <span className="redeem-sheet__icon" aria-hidden="true">
            <Gift size={34} strokeWidth={1.8} />
          </span>
          <h2>用 {picked?.cost ?? 0} 朵小红花换「{picked?.title ?? ''}」？</h2>
          <p>
            换完还剩 {Math.max(0, (flowers.data?.balance ?? 0) - (picked?.cost ?? 0))} 朵。老师看到后会来找你。
          </p>
        </div>
        <div className="redeem-sheet__actions">
          <Button variant="ghost" size="lg" onClick={() => setPicked(null)} disabled={busy}>
            再想想
          </Button>
          <Button size="lg" onClick={confirmRedeem} disabled={busy}>
            {busy ? '正在告诉老师…' : '就换这个'}
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
