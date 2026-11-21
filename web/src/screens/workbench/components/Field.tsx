import type { ReactNode } from 'react';

export interface FieldProps {
  label: string;
  htmlFor?: string;
  counter?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}

export function Field({ label, htmlFor, counter, hint, children, className }: FieldProps) {
  return (
    <div className={'wb-field' + (className ? ' ' + className : '')}>
      <div className="wb-field__top">
        <label className="wb-label" htmlFor={htmlFor}>
          {label}
        </label>
        {counter ? <span className="wb-counter">{counter}</span> : null}
      </div>
      {children}
      {hint ? <p className="wb-field__hint">{hint}</p> : null}
    </div>
  );
}
