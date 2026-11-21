import { fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IdentifySheet } from './IdentifySheet';
import { useClaim } from '../lib/claim';
import type { Student } from '../lib/types';

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as Response;
}

function student(overrides: Partial<Student> & Pick<Student, 'id' | 'name'>): Student {
  return {
    sid: '007',
    pinyin: 'wxm',
    flowers_today: 0,
    flowers_total: 0,
    duplicate_name: false,
    ...overrides,
  };
}

function stubIdentify(students: Student[]): void {
  const fetchMock = vi.fn();
  fetchMock.mockResolvedValue(jsonResponse({ students }));
  vi.stubGlobal('fetch', fetchMock);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('IdentifySheet', () => {
  it('TestAutoConfirmSingleCandidate', async () => {
    stubIdentify([student({ id: 3, name: '王小明', flowers_today: 2, flowers_total: 15 })]);
    const onPicked = vi.fn();
    const onClose = vi.fn();

    render(<IdentifySheet open onPicked={onPicked} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: '0' }));

    await waitFor(() => expect(onPicked).toHaveBeenCalledTimes(1), { timeout: 2000 });
    expect(onPicked.mock.calls[0][0]).toMatchObject({ id: 3, name: '王小明' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('TestNoAutoConfirmOnDuplicateName', async () => {
    stubIdentify([
      student({ id: 7, name: '王小明', duplicate_name: true }),
      student({ id: 8, name: '王小明', sid: '021', duplicate_name: true }),
    ]);
    const onPicked = vi.fn();

    render(<IdentifySheet open onPicked={onPicked} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '0' }));

    await waitFor(
      () => expect(document.querySelectorAll('.candidate')).toHaveLength(2),
      { timeout: 2000 },
    );
    await new Promise((resolve) => setTimeout(resolve, 550));
    expect(onPicked).not.toHaveBeenCalled();

    const second = document.querySelector('[data-student-id="8"]');
    expect(second).not.toBeNull();
    if (second instanceof HTMLElement) fireEvent.click(second);

    await waitFor(() => expect(onPicked).toHaveBeenCalledTimes(1));
    expect(onPicked.mock.calls[0][0]).toMatchObject({ id: 8 });
  });

  it('TestKeepsRecentClaim', () => {
    const expiresAt = Date.now() + 60_000;
    window.sessionStorage.setItem(
      'playtime.student',
      JSON.stringify({ id: 3, name: '王小明', sid: '007', expiresAt }),
    );

    const { result } = renderHook(() => useClaim());

    expect(result.current.claim).toMatchObject({ id: 3, name: '王小明', sid: '007' });
  });
});
