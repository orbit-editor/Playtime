import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CircleAlert, Loader2, Play, RefreshCw } from 'lucide-react';
import { Button } from '../components/Button';
import { FlowerMark } from '../components/FlowerMark';
import { useToast } from '../components/Toast';
import { api } from '../lib/api';
import { useClaim } from '../lib/claim';
import { attachPluginHost, type SubmitPayload, type SubmitOutcome } from '../lib/pluginHost';
import { gamesOf, useBootstrap } from '../lib/useApi';

const PREPARE_TIMEOUT_MS = 15_000;

interface StartResponse {
  play_id: number;
  seed: number;
}

type Phase = 'preparing' | 'playing' | 'failed';

export function ScreenPlay() {
  const navigate = useNavigate();
  const toast = useToast();
  const { pluginId = '' } = useParams<{ pluginId: string }>();
  const { claim } = useClaim();
  const bootstrap = useBootstrap();
  const [phase, setPhase] = useState<Phase>('preparing');
  const [attempt, setAttempt] = useState(0);
  const [notice, setNotice] = useState('');

  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const playIdRef = useRef<number | null>(null);
  const claimRef = useRef(claim);
  const bootstrapRef = useRef(bootstrap.data);
  const pluginRef = useRef(pluginId);
  claimRef.current = claim;
  bootstrapRef.current = bootstrap.data;
  pluginRef.current = pluginId;

  const plugin = gamesOf(bootstrap.data).find((item) => item.id === pluginId);

  const startRound = useCallback(async (): Promise<number> => {
    const who = claimRef.current;
    if (!who) throw new Error('先认领小红花');
    const started = await api.post<StartResponse>('/api/play/start', {
      student_id: who.id,
      plugin_id: pluginRef.current,
    });
    playIdRef.current = started.play_id;
    return started.play_id;
  }, []);

  useEffect(() => {
    let alive = true;
    setPhase('preparing');
    setNotice('');
    playIdRef.current = null;
    if (!claim || !pluginId) {
      setPhase('failed');
      return () => {
        alive = false;
      };
    }
    const timer = window.setTimeout(() => {
      if (alive) {
        setPhase((current) => (current === 'preparing' ? 'failed' : current));
        setNotice('教室的小助手没有回应，再试一次吧');
      }
    }, PREPARE_TIMEOUT_MS);

    startRound()
      .then(() => {
        if (alive) setPhase('playing');
      })
      .catch(() => {
        if (!alive) return;
        setPhase('failed');
        setNotice('这一局没能开始，再试一次吧');
      })
      .finally(() => window.clearTimeout(timer));

    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
    // 认领的人和游戏变了才重新开局；attempt 用于重新打开。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claim?.id, pluginId, attempt, startRound]);

  const handleSubmit = useCallback(async (payload: SubmitPayload): Promise<SubmitOutcome> => {
    const playId = playIdRef.current ?? (await startRound());
    const result = await api.post<SubmitOutcome>('/api/play/finish', {
      play_id: playId,
      correct: payload.correct,
      total: payload.total,
      elapsed_ms: payload.elapsed,
    });
    // 这一局已经结算，下次提交前换一局，孩子重玩才有小红花。
    playIdRef.current = null;
    return result;
  }, [startRound]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || phase !== 'playing') return undefined;
    const host = attachPluginHost(frame, {
      pluginId,
      context: () => {
        const data = bootstrapRef.current;
        const who = claimRef.current;
        return {
          class: {
            name: data?.class?.name?.trim() ?? '',
            grade: data?.class?.grade ?? 3,
          },
          student: {
            id: who?.id ?? 0,
            name: who?.name ?? '',
            sid: who?.sid ?? '',
          },
          plugin: { id: pluginId },
        };
      },
      onSubmit: handleSubmit,
      onToast: (text) => toast.show(text, 'info'),
      onExit: () => navigate('/'),
      onFail: (reason) => {
        setPhase('failed');
        setNotice(reason);
      },
    });
    return () => host.dispose();
  }, [phase, pluginId, attempt, handleSubmit, navigate, toast]);

  const retry = () => {
    setAttempt((value) => value + 1);
  };

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

  const base = '/ext/' + encodeURIComponent(pluginId) + '/';
  const rawEntry = plugin?.entry ?? 'index.html';
  const resolved = rawEntry.startsWith('/') ? rawEntry : base + rawEntry.replace(/^\.\//, '');
  // 开发与验收时可以带 ?test=1，让内置游戏跑三秒的短局。
  const testMode = new URLSearchParams(window.location.search).get('test') === '1';
  const entry = testMode ? resolved + (resolved.includes('?') ? '&' : '?') + 'test=1' : resolved;

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
        <Button variant="ghost" size="sm" icon={RefreshCw} onClick={retry}>
          重新打开
        </Button>
      </header>

      <div className="play-stage">
        {phase === 'preparing' ? (
          <div className="play-overlay" role="status">
            <span className="play-overlay__spinner" aria-hidden="true">
              <Loader2 size={40} className="spin" />
            </span>
            <p>游戏正在打开，请稍等一下下…</p>
          </div>
        ) : null}

        {phase === 'failed' ? (
          <div className="play-message" role="alert">
            <span className="play-message__icon play-message__icon--warn" aria-hidden="true">
              <CircleAlert size={52} strokeWidth={1.8} />
            </span>
            <h1>这个游戏没打开</h1>
            <p>{notice || '再试一次，或者先回首页玩别的小游戏。'}</p>
            <div className="play-message__actions">
              <Button size="lg" icon={RefreshCw} onClick={retry}>
                再试一次
              </Button>
              <Button variant="ghost" size="lg" icon={Play} onClick={() => navigate('/')}>
                换一个玩
              </Button>
            </div>
          </div>
        ) : null}

        {phase === 'playing' ? (
          <iframe
            ref={frameRef}
            key={attempt}
            className="play-frame play-frame--ready"
            title={plugin?.name ?? '小游戏'}
            src={entry}
            sandbox="allow-scripts allow-forms"
            allow="autoplay"
          />
        ) : null}
      </div>
    </div>
  );
}
