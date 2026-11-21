import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Database,
  Gift,
  Home,
  Loader2,
  LogOut,
  Megaphone,
  Puzzle,
  Settings2,
  ShieldCheck,
  Smartphone,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { adminApi, type JoinLink } from '../../lib/adminApi';
import type { SchoolClass } from '../../lib/types';
import { Button } from '../../components/Button';
import { useToast } from '../../components/Toast';
import { gradeLabel } from '../../lib/format';
import { useSSE } from '../../lib/useSSE';
import { LinkSheet } from './LinkSheet';
import { PinGate } from './PinGate';
import { ClassPanel } from './panels/ClassPanel';
import { DataPanel } from './panels/DataPanel';
import { NoticesPanel } from './panels/NoticesPanel';
import { PluginsPanel } from './panels/PluginsPanel';
import { RewardsPanel } from './panels/RewardsPanel';
import { errorText, remainingSeconds } from './format';

type TabKey = 'notices' | 'class' | 'rewards' | 'plugins' | 'data';
type Phase = 'checking' | 'locked' | 'unlocked';

interface TabItem {
  key: TabKey;
  label: string;
  hint: string;
  icon: LucideIcon;
}

const TABS: TabItem[] = [
  { key: 'notices', label: '通知', hint: '发给全班看', icon: Megaphone },
  { key: 'class', label: '班级', hint: '名单和班级信息', icon: Users },
  { key: 'rewards', label: '奖励', hint: '兑换和小红花', icon: Gift },
  { key: 'plugins', label: '扩展', hint: '课堂小游戏', icon: Puzzle },
  { key: 'data', label: '数据', hint: '备份与手机版', icon: Database },
];

export function ScreenWorkbench() {
  const navigate = useNavigate();
  const toast = useToast();

  const [phase, setPhase] = useState<Phase>('checking');
  const [tab, setTab] = useState<TabKey>('notices');
  const [classInfo, setClassInfo] = useState<SchoolClass | null>(null);

  const [noticeTick, setNoticeTick] = useState(0);
  const [studentTick, setStudentTick] = useState(0);
  const [rewardTick, setRewardTick] = useState(0);
  const [pluginTick, setPluginTick] = useState(0);
  const [classTick, setClassTick] = useState(0);
  const [statsTick, setStatsTick] = useState(0);

  const [link, setLink] = useState<JoinLink | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkError, setLinkError] = useState('');

  useEffect(() => {
    let alive = true;
    adminApi
      .me()
      .then((me) => {
        if (!alive) return;
        setPhase(me.authenticated && me.role === 'teacher' ? 'unlocked' : 'locked');
      })
      .catch(() => {
        if (alive) setPhase('locked');
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (phase !== 'unlocked') return;
    let alive = true;
    adminApi
      .classInfo()
      .then((result) => {
        if (alive) setClassInfo(result.class);
      })
      .catch(() => {
        if (alive) setClassInfo(null);
      });
    return () => {
      alive = false;
    };
  }, [phase, classTick]);

  const handleLogin = useCallback(async (pin: string) => {
    await adminApi.login(pin);
    setPhase('unlocked');
  }, []);

  const handleLogout = async () => {
    try {
      await adminApi.logout();
    } catch {
      // 退出接口失败也要回到密码门
    }
    setLink(null);
    setLinkOpen(false);
    setLinkError('');
    toast.show('已退出登录', 'info');
    setPhase('locked');
  };

  const handleServerEvent = useCallback((type: string) => {
    switch (type) {
      case 'notice':
        setNoticeTick((value) => value + 1);
        break;
      case 'students':
      case 'flowers':
        setStudentTick((value) => value + 1);
        break;
      case 'rewards':
      case 'redeems':
        setRewardTick((value) => value + 1);
        break;
      case 'class':
        setClassTick((value) => value + 1);
        break;
      case 'plugins':
        setPluginTick((value) => value + 1);
        break;
      default:
        break;
    }
  }, []);
  useSSE(handleServerEvent, phase === 'unlocked');

  const handleClassSaved = useCallback(() => {
    setClassTick((value) => value + 1);
  }, []);

  const handleRestored = useCallback(() => {
    setNoticeTick((value) => value + 1);
    setStudentTick((value) => value + 1);
    setRewardTick((value) => value + 1);
    setPluginTick((value) => value + 1);
    setClassTick((value) => value + 1);
    setStatsTick((value) => value + 1);
  }, []);

  const generateLink = useCallback(async () => {
    setLinkBusy(true);
    setLinkError('');
    try {
      const next = await adminApi.link();
      setLink(next);
      setLinkOpen(true);
    } catch (err) {
      setLinkError(errorText(err));
      setLinkOpen(true);
    } finally {
      setLinkBusy(false);
    }
  }, []);

  const showLink = useCallback(() => {
    setTab('data');
    if (link && remainingSeconds(link.expires_at) > 0) {
      setLinkOpen(true);
      return;
    }
    void generateLink();
  }, [link, generateLink]);

  if (phase === 'checking') {
    return (
      <div className="screen wb-boot">
        <span className="wb-boot__mark" aria-hidden="true">
          <Settings2 size={40} strokeWidth={2} />
        </span>
        <h1 className="wb-boot__title">老师工作台</h1>
        <p className="wb-boot__text">
          <Loader2 className="wb-spin" size={20} strokeWidth={2.2} aria-hidden="true" />
          正在打开…
        </p>
      </div>
    );
  }

  if (phase === 'locked') {
    return <PinGate onLogin={handleLogin} onBackHome={() => navigate('/')} />;
  }

  return (
    <div className="screen screen-workbench">
      <aside className="wb-sidebar">
        <div className="wb-brand">
          <span className="wb-brand__mark" aria-hidden="true">
            <Settings2 size={30} strokeWidth={2.1} />
          </span>
          <div className="wb-brand__copy">
            <p className="wb-brand__name">老师工作台</p>
            <p className="wb-brand__sub">Playtime 课间学习</p>
          </div>
        </div>

        <nav className="wb-nav" aria-label="工作台页面">
          {TABS.map((item) => {
            const Icon = item.icon;
            const active = tab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                className={'wb-nav__item' + (active ? ' wb-nav__item--active' : '')}
                aria-current={active ? 'page' : undefined}
                onClick={() => setTab(item.key)}
              >
                <span className="wb-nav__icon" aria-hidden="true">
                  <Icon size={26} strokeWidth={2.1} />
                </span>
                <span className="wb-nav__copy">
                  <span className="wb-nav__label">{item.label}</span>
                  <span className="wb-nav__hint">{item.hint}</span>
                </span>
              </button>
            );
          })}
        </nav>

        <div className="wb-sidebar__foot">
          <Button variant="ghost" size="lg" block icon={Home} onClick={() => navigate('/')}>
            回首页
          </Button>
          <p className="wb-sidebar__note">大屏右上角齿轮再次进入这里</p>
        </div>
      </aside>

      <div className="wb-main">
        <header className="wb-topbar">
          <div className="wb-topbar__heading">
            <p className="wb-topbar__eyebrow">老师工作台</p>
            <div className="wb-topbar__title-row">
              <h1 className="wb-topbar__title">{classInfo?.name || '我的班级'}</h1>
              <span className="wb-topbar__chip">
                <ShieldCheck size={18} strokeWidth={2.3} aria-hidden="true" />
                已登录 · 老师
              </span>
            </div>
            <p className="wb-topbar__sub">
              {classInfo
                ? [classInfo.school, gradeLabel(classInfo.grade)].filter((part) => part.trim().length > 0).join(' · ')
                : '还没有填写班级信息'}
            </p>
          </div>
          <div className="wb-topbar__actions">
            <Button variant="soft" size="lg" icon={Smartphone} onClick={showLink} disabled={linkBusy}>
              {linkBusy ? '正在生成…' : '手机版'}
            </Button>
            <Button variant="ghost" size="lg" icon={LogOut} onClick={() => void handleLogout()}>
              退出登录
            </Button>
          </div>
        </header>

        <main className="wb-content">
          {tab === 'notices' ? <NoticesPanel tick={noticeTick} /> : null}
          {tab === 'class' ? (
            <ClassPanel classTick={classTick} studentTick={studentTick} onClassSaved={handleClassSaved} />
          ) : null}
          {tab === 'rewards' ? <RewardsPanel tick={rewardTick} /> : null}
          {tab === 'plugins' ? <PluginsPanel tick={pluginTick} /> : null}
          {tab === 'data' ? (
            <DataPanel
              statsTick={statsTick}
              linkBusy={linkBusy}
              onShowLink={showLink}
              onRestored={handleRestored}
            />
          ) : null}
        </main>
      </div>

      <LinkSheet
        open={linkOpen}
        link={link}
        busy={linkBusy}
        error={linkError}
        onClose={() => setLinkOpen(false)}
        onRegenerate={() => {
          setLink(null);
          void generateLink();
        }}
      />
    </div>
  );
}
