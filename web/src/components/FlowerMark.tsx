import { useId } from 'react';
import { Flower2 } from 'lucide-react';

export interface FlowerMarkProps {
  size?: number;
  muted?: boolean;
  className?: string;
}

/** 小红花图标：lucide 的 Flower2，加一层暖红渐变。 */
export function FlowerMark({ size = 28, muted = false, className }: FlowerMarkProps) {
  const gradientId = 'flower-' + useId().replace(/[^a-zA-Z0-9_-]/g, '');

  return (
    <span
      className={'flower-mark' + (className ? ' ' + className : '')}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg width={0} height={0} className="flower-mark__defs">
        <defs>
          <linearGradient id={gradientId} x1="6" y1="4" x2="20" y2="22" gradientUnits="userSpaceOnUse">
            <stop stopColor={muted ? '#F4C9C3' : '#F49A8D'} />
            <stop offset="1" stopColor={muted ? '#EAD3CE' : '#E4574C'} />
          </linearGradient>
        </defs>
      </svg>
      <Flower2
        size={size}
        strokeWidth={1.8}
        stroke={muted ? 'var(--line-strong)' : 'var(--flower-deep)'}
        fill={'url(#' + gradientId + ')'}
      />
    </span>
  );
}
