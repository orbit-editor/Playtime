import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GameWall } from './GameWall';
import { NoticeBar } from './NoticeBar';
import type { Plugin } from '../lib/types';

const plugins: Plugin[] = [
  {
    id: 'math-sprint',
    name: '口算闯关',
    version: '1.0.0',
    description: '一分钟口算，看看你能闯过几关。',
    grades: [3, 4],
    enabled: true,
  },
  {
    id: 'word-puzzle',
    name: '词语拼一拼',
    version: '1.0.0',
    description: '把词语拼完整。',
    grades: [3],
    enabled: true,
  },
  {
    id: 'old-game',
    name: '停用的小游戏',
    version: '0.9.0',
    description: '这个已经停用了。',
    grades: [3],
    enabled: false,
  },
];

describe('GameWall', () => {
  it('TestHidesDisabledPlugins', () => {
    const { container } = render(<GameWall games={plugins} onPlay={vi.fn()} />);
    expect(container.querySelectorAll('[data-testid="game-card"]')).toHaveLength(2);
  });
});

describe('NoticeBar', () => {
  it('TestNoticeBarCollapses', () => {
    const { container } = render(<NoticeBar notice={null} count={0} />);
    const bar = container.firstElementChild;
    expect(bar).not.toBeNull();
    expect(bar?.className).toContain('collapsed');
    expect(bar?.getAttribute('aria-hidden')).toBe('true');
  });
});
