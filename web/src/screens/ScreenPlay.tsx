import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CircleAlert, Loader2, Play, RefreshCw } from 'lucide-react';
import { Button } from '../components/Button';
import { FlowerMark } from '../components/FlowerMark';
import { useClaim } from '../lib/claim';
import { useBootstrap } from '../lib/useApi';

const GAME_TIMEOUT_MS = 10_000;

export function ScreenPlay() {
  const navigate = useNavigate();
  const { pluginId } = useParams<{ pluginId: string }>();
  const { claim } = useClaim();
  const bootstrap = useBootstrap();
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [attempt, setAttempt] = useState(0);

  const plugin = (bootstrap.data?.plugins ?? []).find((item) => item.id === pluginId);

  useEffect(() => {
    setStatus('loading');
    if (!pluginId) {
      setStatus('failed');
      return;
    }
    const timer = window.setTimeout(() => {
      setStatus((current) => (current === 'loading' ? 'failed' : current));
    }, GAME_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [pluginId, attempt]);

  if (!claim) {
    return (
      <div className="screen screen-play">
        <header className="play-topbar">
          <button type="button" className="icon-button" onClick={() => navigate('/')} aria-label="回首页">
            <ArrowLeft size={28} strokeWidth={2.2} aria-hidden="true" />
          </button>
          <span className="play-topbar__title">还没有认领小红花</span>
        </header>
        <div className="play-stage play-stage--message">
          <span className="play-message__icon" aria-hidden="true">
            <FlowerMark size={64} />
          </span>
          <h1>先告诉老师你是谁，就能玩了</h1>
          <p>回到首页点「认领我的小红花」，输入学号或拼音开头。</p>
          <Button size="lg" onClick={() => navigate('/')}>回首页认领</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen screen-play">
      <header className="play-topbar">
        <button type="button" className="icon-button" onClick={() => navigate('/')} aria-label="回首页">
          <ArrowLeft size={28} strokeWidth={2.2} aria-hidden="true" />
        </button>
        <div className="play-topbar__copy">
          <span className="play-topbar__title">{plugin?.name ?? '小游戏'}</span>
          <span className="play-topbar__sub">
            <FlowerMark size={15} />
            {claim.name}
          </span>
        </div>
        <Button variant="ghost" size="sm" icon={RefreshCw} onClick={() => setAttempt((value) => value + 1)}>
          重新打开
        </Button>
      </header>

      <div className="play-stage">
        {status === 'loading' ? (
          <div className="play-overlay" role="status">
            <span className="play-overlay__spinner" aria-hidden="true">
              <Loader2 size={40} className="spin" />
            </span>
            <p>游戏正在打开，请稍等一下下…</p>
          </div>
        ) : null}

        {status === 'failed' ? (
          <div className="play-message" role="alert">
            <span className="play-message__icon play-message__icon--warn" aria-hidden="true">
              <CircleAlert size={52} strokeWidth={1.8} />
            </span>
            <h1>这个游戏没打开</h1>
            <p>再试一次，或者先回首页玩别的小游戏。</p>
            <div className="play-message__actions">
              <Button size="lg" icon={RefreshCw} onClick={() => setAttempt((value) => value + 1)}>
                再试一次
              </Button>
              <Button variant="ghost" size="lg" icon={Play} onClick={() => navigate('/')}>
                换一个玩
              </Button>
            </div>
          </div>
        ) : null}

        <iframe
          key={attempt}
          className={'play-frame' + (status === 'ready' ? ' play-frame--ready' : '')}
          title={plugin?.name ?? '小游戏'}
          src={'/ext/' + encodeURIComponent(pluginId ?? '') + '/index.html'}
          allow="fullscreen"
          onLoad={() => setStatus('ready')}
        />
      </div>
    </div>
  );
}
