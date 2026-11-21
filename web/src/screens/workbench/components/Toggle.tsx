export interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
  className?: string;
}

/** 触摸用的开关，整块 84×48，不需要悬停。 */
export function Toggle({ checked, onChange, label, disabled = false, className }: ToggleProps) {
  const classes = [
    'wb-switch',
    checked ? 'wb-switch--on' : '',
    disabled ? 'wb-switch--disabled' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={classes}
      onClick={() => onChange(!checked)}
    >
      <span className="wb-switch__thumb" aria-hidden="true" />
    </button>
  );
}
