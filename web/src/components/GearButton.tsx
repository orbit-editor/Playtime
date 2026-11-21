import { Settings } from 'lucide-react';

export interface GearButtonProps {
  onClick: () => void;
  highlight?: boolean;
  className?: string;
}

/** 右下角的小齿轮，是老师进工作台的入口，孩子一般不会误点。 */
export function GearButton({ onClick, highlight = false, className }: GearButtonProps) {
  return (
    <button
      type="button"
      className={'gear' + (highlight ? ' gear--highlight' : '') + (className ? ' ' + className : '')}
      onClick={onClick}
      aria-label="老师入口"
      title="老师入口"
    >
      <Settings size={24} strokeWidth={1.9} aria-hidden="true" />
    </button>
  );
}
