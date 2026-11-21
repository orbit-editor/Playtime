import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  BadgeCheck,
  Bell,
  Gift,
  Link2Off,
  Loader2,
  LogOut,
  MoreHorizontal,
  RefreshCw,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { adminApi, type AdminReward } from '../../lib/adminApi';
import { useToast } from '../../components/Toast';
import type { Notice, SchoolClass } from '../../lib/types';
import { MobileMore, ChangePinPage, ClassInfoPage } from './MobileMore';
import { MobileNotices, NoticeEditor } from './MobileNotices';
import { MobileRewards, RewardEditor } from './MobileRewards';
import { MobileStudents, StudentImport } from './MobileStudents';
import { scrollToTop, type DoneHandler } from './mobileUi';

type AuthState = 'checking' | 'ready' | 'expired';
type TabKey = 'notices' | 'students' | 'rewards' | 'more';

type Detail =
  | { kind: 'notice-new' }
  | { kind: 'notice-edit'; notice: Notice }
  | { kind: 'students-import' }
  | { kind: 'reward-new' }
  | { kind: 'reward-edit'; reward: AdminReward }
  | { kind: 'change-pin' }
  | { kind: 'class-info' };

const TABS: { key: TabKey; label: string; icon: LucideIcon }[] = [
  { key: 'notices', label: '通知', icon: Bell },
  { key: 'students', label: '名单', icon: Users },
  { key: 'rewards', label: '奖励', icon: Gift },
  { key: 'more', label: '更多', icon: MoreHorizontal },
];

export function ScreenMobileApp() {
  const toast = useToast();
  const [auth, setAuth] = useState<AuthState>('checking');
  const [classInfo, setClassInfo] = useState<SchoolClass | null>(null);
  const [tab, setTab] = useState<TabKey>('notices');
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  // 手机页用文档原生滚动，避免输入法把固定高度布局顶坏。
  useEffect(() => {
    const body = document.body;
    const previousTitle = document.title;
    body.classList.add('mobile-body');
    document.title = '老师手机版 · 课间玩一玩';
    return () => {
      body.classList.remove('mobile-body');
      document.title = previousTitle;
    };
  }, []);

  const checkAuth = useCallback(async () => {
    setAuth('checking');
    try {
      const me = await adminApi.me();
      setAuth(me.authenticated ? 'ready' : 'expired');
    } catch {
      setAuth('expired');
    }
  }, []);

  useEffect(() => {
    void checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (auth !== 'ready') return;
    let cancelled = false;
    adminApi
      .classInfo()
      .then((result) => {
        if (!cancelled) setClassInfo(result.class);
      })
      .catch(() => {
        /* 班级名拉不到不影响其他功能，顶部先显示兜底文案 */
      });
    return () => {
      cancelled = true;
    };
  }, [auth]);

  const closeDetail = useCallback(() => {
    setDetail(null);
    scrollToTop();
  }, []);

  const finishDetail: DoneHandler = useCallback(
    (message: string, nextClass?: SchoolClass) => {
      if (nextClass) setClassInfo(nextClass);
      setDetail(null);
      scrollToTop();
      toast.show(message, 'success');
    },
    [toast],
  );

  const handleLogout = useCallback(async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await adminApi.logout();
    } catch {
      /* 网络异常也回到失效页，避免卡在旧页面 */
    }
    setLoggingOut(false);
    setDetail(null);
    setClassInfo(null);
    setAuth('expired');
    toast.show('已退出登录', 'info');
  }, [loggingOut, toast]);

  const switchTab = useCallback((next: TabKey) => {
    setTab(next);
    scrollToTop();
  }, []);

  const renderTab = (): ReactNode => {
    switch (tab) {
      case 'notices':
        return (
          <MobileNotices
            onNew={() => setDetail({ kind: 'notice-new' })}
            onEdit={(notice) => setDetail({ kind: 'notice-edit', notice })}
          />
        );
      case 'students':
        return <MobileStudents onImport={() => setDetail({ kind: 'students-import' })} />;
      case 'rewards':
        return (
          <MobileRewards
            onNew={() => setDetail({ kind: 'reward-new' })}
            onEdit={(reward) => setDetail({ kind: 'reward-edit', reward })}
          />
        );
      case 'more':
        return (
          <MobileMore
            classInfo={classInfo}
            onOpenClassInfo={() => setDetail({ kind: 'class-info' })}
            onOpenChangePin={() => setDetail({ kind: 'change-pin' })}
          />
        );
      default:
        return null;
    }
  };

  const renderDetail = (current: Detail): ReactNode => {
    switch (current.kind) {
      case 'notice-new':
        return <NoticeEditor notice={null} onClose={closeDetail} onDone={finishDetail} />;
      case 'notice-edit':
        return <NoticeEditor notice={current.notice} onClose={closeDetail} onDone={finishDetail} />;
      case 'students-import':
        return <StudentImport onClose={closeDetail} onDone={finishDetail} />;
      case 'reward-new':
        return <RewardEditor reward={null} onClose={closeDetail} onDone={finishDetail} />;
      case 'reward-edit':
        return <RewardEditor reward={current.reward} onClose={closeDetail} onDone={finishDetail} />;
      case 'change-pin':
        return <ChangePinPage onClose={closeDetail} onDone={finishDetail} />;
      case 'class-info':
        return <ClassInfoPage onClose={closeDetail} onDone={finishDetail} />;
      default:
        return null;
    }
  };

  return (
    <div className="m-app">
      {auth === 'checking' ? (
        <div className="m-loading-screen" role="status">
          <Loader2 className="spin" size={30} aria-hidden="true" />
          <p>正在打开手机版</p>
        </div>
      ) : null}

      {auth === 'expired' ? <ExpiredScreen onRetry={() => void checkAuth()} /> : null}

      {auth === 'ready' ? (
        detail ? (
          renderDetail(detail)
        ) : (
          <>
            <TopBar
              className={classInfo?.name ?? '我的班级'}
              loggingOut={loggingOut}
              onLogout={() => void handleLogout()}
            />
            <main className="m-main">{renderTab()}</main>
            <TabBar active={tab} onChange={switchTab} />
          </>
        )
      ) : null}
    </div>
  );
}

function TopBar({
  className,
  loggingOut,
  onLogout,
}: {
  className: string;
  loggingOut: boolean;
  onLogout: () => void;
}) {
  return (
    <header className="m-topbar">
      <div className="m-topbar__inner">
        <div className="m-topbar__identity">
          <span className="m-topbar__class" title={className}>
            {className}
          </span>
          <span className="m-topbar__badge">
            <BadgeCheck size={13} strokeWidth={2.4} aria-hidden="true" />
            老师
          </span>
        </div>
        <button type="button" className="m-topbar__logout" onClick={onLogout} disabled={loggingOut}>
          <LogOut size={18} strokeWidth={2.1} aria-hidden="true" />
          <span>{loggingOut ? '退出中' : '退出'}</span>
        </button>
      </div>
    </header>
  );
}

function TabBar({ active, onChange }: { active: TabKey; onChange: (next: TabKey) => void }) {
  return (
    <nav className="m-tabbar" aria-label="手机版页签">
      {TABS.map(({ key, label, icon: Icon }) => {
        const isActive = key === active;
        return (
          <button
            key={key}
            type="button"
            className={isActive ? 'm-tab m-tab--active' : 'm-tab'}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => onChange(key)}
          >
            <Icon size={22} strokeWidth={2} aria-hidden="true" />
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function ExpiredScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="m-expired">
      <span className="m-expired__icon" aria-hidden="true">
        <Link2Off size={38} strokeWidth={1.8} />
      </span>
      <h1 className="m-expired__title">这个链接已经用过或过期了</h1>
      <p className="m-expired__text">请老师在教室大屏上重新生成二维码。</p>
      <button type="button" className="m-btn m-btn--primary m-expired__retry" onClick={onRetry}>
        <RefreshCw size={18} aria-hidden="true" />
        重试
      </button>
    </div>
  );
}
