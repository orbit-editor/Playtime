import { Minus, Plus } from 'lucide-react';

export interface StepperProps {
  value: number;
  label: string;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  onChange: (next: number) => void;
}

/** 数字加减器，两侧按钮 56×56，适合触摸大屏。 */
export function Stepper({ value, label, min = 0, max = 9999, step = 1, suffix, onChange }: StepperProps) {
  const clamp = (next: number) => Math.min(max, Math.max(min, next));
  return (
    <div className="wb-stepper" role="group" aria-label={label}>
      <button
        type="button"
        className="wb-stepper__btn"
        aria-label={'减少' + label}
        disabled={value <= min}
        onClick={() => onChange(clamp(value - step))}
      >
        <Minus size={24} strokeWidth={2.4} aria-hidden="true" />
      </button>
      <span className="wb-stepper__value">
        {value}
        {suffix ? <span className="wb-stepper__suffix">{suffix}</span> : null}
      </span>
      <button
        type="button"
        className="wb-stepper__btn"
        aria-label={'增加' + label}
        disabled={value >= max}
        onClick={() => onChange(clamp(value + step))}
      >
        <Plus size={24} strokeWidth={2.4} aria-hidden="true" />
      </button>
    </div>
  );
}
