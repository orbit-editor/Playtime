import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Gamepad2, RefreshCw, WifiOff } from 'lucide-react';
import { FlowerBoard } from '../components/FlowerBoard';
import { FlowerMark } from '../components/FlowerMark';
import { GameWall } from '../components/GameWall';
import { GearButton } from '../components/GearButton';
import { IdentifySheet } from '../components/IdentifySheet';
import { LeaderboardPreview } from '../components/LeaderboardPreview';
import { NoticeBar } from '../components/NoticeBar';
import { useToast } from '../components/Toast';
import { useClaim } from '../lib/claim';
import { formatClock, formatDateCN, greetingFor } from '../lib/format';
import {
  gamesOf,
  useBootstrap,
  useLeaderboard,
  useStudentFlowers,
} from '../lib/useApi';
import { useSSE } from '../lib/useSSE';
import type { Plugin, Student } from '../lib/types';

function useNow(): Date {
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

function OfflineBar({ loading, onRetry }: { loading: boolean; onRetry: () => void }) {
  return (
    <div className="offline-bar" role="status">
      <span className="offline-bar__icon" aria-hidden="true">
        <WifiOff size={24} strokeWidth={2} />
      </span>
      <p className="offline-bar__text">教室里的小助手暂时没连上，先看看样子吧</p>
      <button type="button" className="text-button offline-bar__retry" onClick={onRetry} disabled={loading}>
        {loading ? '正在连…' : '再试一次'}
        {loading ? null : <RefreshCw size={18} strokeWidth={2.2} aria-hidden="true" />}
      </button>
    </div>
  );
}

export function ScreenHome() {
  const navigate = useNavigate();
  const toast = useToast();
  const now = useNow();

  const bootstrapResource = useBootstrap();
  const bootstrap = bootstrapResource.data;
  const { claim, setClaim, clearClaim } = useClaim();
  const personal = useStudentFlowers(claim ? claim.id : null);
  const leaderboard = useLeaderboard('today');

  const [sheetOpen, setSheetOpen] = useState(false);
  const [pendingPlugin, setPendingPlugin] = useState<Plugin | null>(null);
  const pickedRef = useRef(false);

  const degraded = bootstrapResource.degraded;
  const games = gamesOf(bootstrap);
  const rosterEmpty =
    !degraded && bootstrap !== null && bootstrap.stats.students === 0;
  const className = bootstrap?.class?.name?.trim() || '我们的教室';
  const school = bootstrap?.class?.school?.trim() ?? '';
  const notice = bootstrap?.notice ?? null;
  const noticesCount = bootstrap?.notices_count ?? 0;

  const refreshBootstrap = bootstrapResource.refresh;
  const refreshLeaderboard = leaderboard.refresh;
  const refreshPersonal = personal.refresh;
  const refreshAll = useCallback(() => {
    refreshBootstrap();
    refreshLeaderboard();
    refreshPersonal();
  }, [refreshBootstrap, refreshLeaderboard, refreshPersonal]);

  useSSE(refreshAll, !degraded && bootstrap !== null);

  const openForClaim = useCallback(() => {
    if (rosterEmpty) return;
    pickedRef.current = false;
    setPendingPlugin(null);
    setSheetOpen(true);
  }, [rosterEmpty]);

  const handlePlay = useCallback(
    (plugin: Plugin) => {
      if (rosterEmpty) {
        toast.show('名单还没来，先请老师导入名单吧', 'info');
        return;
      }
      if (claim) {
        navigate('/play/' + encodeURIComponent(plugin.id));
        return;
      }
      pickedRef.current = false;
      setPendingPlugin(plugin);
      setSheetOpen(true);
    },
    [claim, navigate, rosterEmpty, toast],
  );

  const handlePicked = useCallback(
    (student: Student) => {
      pickedRef.current = true;
      setClaim(student);
    },
    [setClaim],
  );

  const handleRejected = useCallback(() => {
    pickedRef.current = false;
    clearClaim();
  }, [clearClaim]);

  const handleSheetClose = useCallback(() => {
    setSheetOpen(false);
    const plugin = pendingPlugin;
    setPendingPlugin(null);
    const picked = pickedRef.current;
    pickedRef.current = false;
    if (picked && plugin) {
      navigate('/play/' + encodeURIComponent(plugin.id));
    }
  }, [navigate, pendingPlugin]);

  const releaseClaim = useCallback(() => {
    clearClaim();
    toast.show('好，这次先不认领啦', 'info');
  }, [clearClaim, toast]);

  return (
    <div className="screen screen-home">
      <header className="home-header">
        <div className="home-brand">
          <span className="home-brand__mark" aria-hidden="true">
            <Gamepad2 size={34} strokeWidth={1.9} />
          </span>
          <div className="home-brand__copy">
            <div className="home-brand__line">
              <h1 className="home-brand__name">{className}</h1>
              {claim ? (
                <span className="home-brand__hello">
                  <FlowerMark size={16} />
                  {claim.name}，你好
                </span>
              ) : null}
              {rosterEmpty ? <span className="home-brand__warn">名单还没来</span> : null}
            </div>
            <p className="home-brand__sub">
              {school ? school + ' · ' : ''}
              {greetingFor(now)}，课间玩一局吧
            </p>
          </div>
        </div>

        <div className="home-clock">
          <span className="home-clock__date">{formatDateCN(now)}</span>
          <span className="home-clock__time">
            <Clock size={26} strokeWidth={2} aria-hidden="true" />
            {formatClock(now)}
          </span>
        </div>
      </header>

      {degraded ? (
        <OfflineBar loading={bootstrapResource.loading} onRetry={refreshBootstrap} />
      ) : (
        <NoticeBar notice={notice} count={noticesCount} />
      )}

      <main className="home-main">
        <div className="home-left">
          <GameWall
            games={games}
            loading={bootstrapResource.loading}
            onPlay={handlePlay}
          />
          <LeaderboardPreview
            rows={leaderboard.data?.rows ?? []}
            loading={leaderboard.loading}
            error={leaderboard.error}
            claimId={claim ? claim.id : null}
            onSeeAll={() => navigate('/board')}
          />
        </div>

        <FlowerBoard
          claim={claim}
          personal={personal.data}
          personalLoading={personal.loading}
          personalError={personal.error}
          stats={bootstrap?.stats ?? { students: 0, flowers_today: 0, flowers_week: 0 }}
          rosterEmpty={rosterEmpty}
          onClaim={openForClaim}
          onRelease={releaseClaim}
          onRewards={() => navigate('/me')}
        />
      </main>

      <GearButton highlight={rosterEmpty} onClick={() => navigate('/admin')} />

      <IdentifySheet
        open={sheetOpen}
        onPicked={handlePicked}
        onClose={handleSheetClose}
        onRejected={handleRejected}
        nextLabel={pendingPlugin ? '开始玩' : '好啦'}
      />
    </div>
  );
}
