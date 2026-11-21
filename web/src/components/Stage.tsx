import { useEffect, useState, type ReactNode } from 'react';

const STAGE_WIDTH = 1920;
const STAGE_HEIGHT = 1080;

function stageScale(): number {
  if (typeof window === 'undefined') return 1;
  return Math.min(window.innerWidth / STAGE_WIDTH, window.innerHeight / STAGE_HEIGHT);
}

/**
 * 把 1920×1080 的逻辑画面等比缩放后居中。
 * 页面本身永远不出现滚动条，2K / 4K 一体机也能整体放大。
 */
export function Stage({ children }: { children: ReactNode }) {
  const [scale, setScale] = useState<number>(() => stageScale());
  const [quiet, setQuiet] = useState(false);

  useEffect(() => {
    const update = () => setScale(stageScale());
    update();
    setQuiet(window.devicePixelRatio >= 2);
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    return () => {
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
    };
  }, []);

  return (
    <div className={'stage-viewport' + (quiet ? ' stage-viewport--quiet' : '')}>
      <div className="stage-canvas" style={{ transform: 'scale(' + String(scale) + ')' }}>
        <div className="stage-decor" aria-hidden="true">
          <span className="stage-decor__dot stage-decor__dot--one" />
          <span className="stage-decor__dot stage-decor__dot--two" />
          <span className="stage-decor__dot stage-decor__dot--three" />
          <span className="stage-decor__ring" />
        </div>
        <div className="stage-content">{children}</div>
      </div>
    </div>
  );
}
