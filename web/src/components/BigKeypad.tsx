import { Check, Delete as DeleteIcon } from 'lucide-react';

export interface BigKeypadProps {
  onKey: (key: string) => void;
  onBackspace: () => void;
  onClear: () => void;
  onConfirm: () => void;
}

type Key =
  | { kind: 'char'; value: string }
  | { kind: 'backspace' }
  | { kind: 'clear' }
  | { kind: 'confirm' };

const ROWS: Key[][] = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map((value) => ({ kind: 'char', value })),
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'].map((value) => ({ kind: 'char', value })),
  [
    ...['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'].map((value) => ({ kind: 'char', value })),
    { kind: 'backspace' },
  ],
  [
    ...['Z', 'X', 'C', 'V', 'B', 'N', 'M'].map((value) => ({ kind: 'char', value })),
    { kind: 'clear' },
    { kind: 'confirm' },
  ],
];

/** 4 行 × 10 列的大键盘，每个键都够一根手指按。 */
export function BigKeypad({ onKey, onBackspace, onClear, onConfirm }: BigKeypadProps) {
  return (
    <div className="keypad" role="group" aria-label="输入学号或拼音">
      {ROWS.flat().map((key, index) => {
        if (key.kind === 'char') {
          return (
            <button
              type="button"
              key={key.value}
              className="keypad__key"
              data-key={key.value}
              onClick={() => onKey(key.value)}
            >
              {key.value}
            </button>
          );
        }
        if (key.kind === 'backspace') {
          return (
            <button
              type="button"
              key="backspace"
              className="keypad__key keypad__key--quiet"
              aria-label="删掉一个字"
              onClick={onBackspace}
            >
              <DeleteIcon size={26} strokeWidth={2} aria-hidden="true" />
            </button>
          );
        }
        if (key.kind === 'clear') {
          return (
            <button
              type="button"
              key="clear"
              className="keypad__key keypad__key--quiet keypad__key--small-text"
              onClick={onClear}
            >
              清空
            </button>
          );
        }
        return (
          <button
            type="button"
            key={'confirm-' + String(index)}
            className="keypad__key keypad__key--confirm keypad__key--span2"
            onClick={onConfirm}
          >
            <Check size={24} strokeWidth={2.6} aria-hidden="true" />
            确定
          </button>
        );
      })}
    </div>
  );
}
