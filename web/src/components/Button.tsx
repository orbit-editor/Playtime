import { isValidElement, type ButtonHTMLAttributes, type ComponentType, type ReactNode } from 'react';
import type { LucideProps } from 'lucide-react';

export type ButtonVariant = 'primary' | 'ghost' | 'danger' | 'soft';
export type ButtonSize = 'md' | 'lg' | 'sm';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  icon?: ReactNode | ComponentType<LucideProps>;
}

function IconFromComponent({ icon: Icon }: { icon: ComponentType<LucideProps> }) {
  return <Icon size={20} strokeWidth={2.2} aria-hidden="true" />;
}

export function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  icon,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  const classes = [
    'btn',
    'btn--' + variant,
    'btn--' + size,
    block ? 'btn--block' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  // lucide 图标是 forwardRef 对象，不是函数；只有传进来真实元素时才直接渲染。
  const iconNode =
    icon === undefined || icon === null || isValidElement(icon) ? (
      icon
    ) : (
      <IconFromComponent icon={icon as ComponentType<LucideProps>} />
    );

  return (
    <button type={type} className={classes} {...rest}>
      {iconNode ? (
        <span className="btn__icon" aria-hidden="true">
          {iconNode}
        </span>
      ) : null}
      <span className="btn__label">{children}</span>
    </button>
  );
}
