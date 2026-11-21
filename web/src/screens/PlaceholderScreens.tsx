import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Compass, Lock, QrCode, Smartphone, Wrench } from 'lucide-react';
import { Button } from '../components/Button';
import { FlowerMark } from '../components/FlowerMark';
import type { LucideIcon } from 'lucide-react';

type PlaceholderProps = {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  hint: string;
  note: string;
};

function Placeholder({ icon: Icon, eyebrow, title, hint, note }: PlaceholderProps) {
  const navigate = useNavigate();
  return (
    <div className="screen screen-placeholder">
      <header className="sub-header">
        <button type="button" className="icon-button" onClick={() => navigate('/')} aria-label="回首页">
          <ArrowLeft size={28} strokeWidth={2.2} aria-hidden="true" />
        </button>
        <div className="sub-header__copy">
          <p className="sub-header__eyebrow">{eyebrow}</p>
          <h1 className="sub-header__title">{title}</h1>
        </div>
        <FlowerMark size={40} />
      </header>
      <main className="placeholder-main">
        <div className="placeholder-card">
          <span className="placeholder-card__icon" aria-hidden="true">
            <Icon size={64} strokeWidth={1.6} />
          </span>
          <h2>{hint}</h2>
          <p>{note}</p>
          <Button variant="ghost" size="lg" onClick={() => navigate('/')}>
            回首页
          </Button>
        </div>
      </main>
    </div>
  );
}

export function ScreenAdmin() {
  return (
    <Placeholder
      icon={Lock}
      eyebrow="老师入口"
      title="老师工作台"
      hint="这里是老师的秘密小屋"
      note="名单、通知和小红花记录，很快就会搬到这里。现在先请回首页吧。"
    />
  );
}

export function ScreenMobile() {
  return (
    <Placeholder
      icon={Smartphone}
      eyebrow="手机版"
      title="手机上的小红花"
      hint="手机上也能看小红花啦"
      note="手机版还在准备中，马上就能在课间用手机查看了。"
    />
  );
}

export function ScreenJoin() {
  return (
    <Placeholder
      icon={QrCode}
      eyebrow="扫码认领"
      title="扫一扫，认领小红花"
      hint="用手机扫一下，就能认领"
      note="扫码认领正在准备中，先在手机上打开这个地址也可以。"
    />
  );
}

export function ScreenSetup() {
  return (
    <Placeholder
      icon={Wrench}
      eyebrow="第一次使用"
      title="先来布置教室"
      hint="第一次用，要先把教室布置好"
      note="设置班级、导入名单和通知都由老师来做。布置好了，孩子们就能开始玩。"
    />
  );
}

export function ScreenNotFound() {
  return (
    <Placeholder
      icon={Compass}
      eyebrow="找不到啦"
      title="这页找不到了"
      hint="咦，这页好像走丢了"
      note="别着急，回到首页看看，那里有小游戏和小红花在等你。"
    />
  );
}
