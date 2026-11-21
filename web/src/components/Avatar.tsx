import { avatarTone } from '../lib/format';

export interface AvatarProps {
  name: string;
  size?: number;
  className?: string;
}

/** 用姓名生成稳定的色块头像，不依赖外部图片。 */
export function Avatar({ name, size = 48, className }: AvatarProps) {
  const tone = avatarTone(name);
  const initial = Array.from(name.trim())[0] ?? '同';
  return (
    <span
      className={'avatar' + (className ? ' ' + className : '')}
      style={{
        width: size,
        height: size,
        background: tone.background,
        color: tone.foreground,
        fontSize: Math.round(size * 0.42),
        borderRadius: Math.round(size * 0.32),
      }}
      aria-hidden="true"
    >
      {initial}
    </span>
  );
}
