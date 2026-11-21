import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../lib/api';
import { PinGate } from './PinGate';

const press = (label: string) => {
  fireEvent.click(screen.getByRole('button', { name: label }));
};

const pressDigits = (digits: string) => {
  for (const digit of digits) press(digit);
};

const dotTexts = () =>
  screen.getAllByTestId('pin-dot').map((dot) => dot.textContent ?? '');

describe('PinGate', () => {
  it('TestSubmitsAutomaticallyAfterFourDigits', async () => {
    const onLogin = vi.fn().mockResolvedValue(undefined);
    render(<PinGate onLogin={onLogin} onBackHome={vi.fn()} />);

    pressDigits('1234');

    await waitFor(() => expect(onLogin).toHaveBeenCalledWith('1234'));
  });

  it('TestShowsWrongPinAndClearsDots', async () => {
    const onLogin = vi.fn().mockRejectedValue(new ApiError(401, 'bad_pin', '密码不对'));
    render(<PinGate onLogin={onLogin} onBackHome={vi.fn()} />);

    pressDigits('0000');

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('密码不对'));
    await waitFor(() => expect(dotTexts().filter((text) => text !== '')).toHaveLength(0));
  });

  it('TestLocksKeyboardAfterTooManyAttempts', async () => {
    const onLogin = vi.fn().mockRejectedValue(new ApiError(429, 'locked', '错太多次了，一分钟后再试'));
    render(<PinGate onLogin={onLogin} onBackHome={vi.fn()} />);

    pressDigits('1111');

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('错太多次了'));
    expect(screen.getByText('60 秒')).toBeTruthy();
    const oneKey = screen.getByRole('button', { name: '1' }) as HTMLButtonElement;
    expect(oneKey.disabled).toBe(true);
  });

  it('TestAsksForFourDigitsBeforeConfirming', () => {
    const onLogin = vi.fn();
    render(<PinGate onLogin={onLogin} onBackHome={vi.fn()} />);

    press('2');
    press('确定');

    expect(screen.getByRole('alert').textContent).toContain('请输入 4 位数字');
    expect(onLogin).not.toHaveBeenCalled();
  });

  it('TestBackspaceRemovesLastDigit', () => {
    render(<PinGate onLogin={vi.fn()} onBackHome={vi.fn()} />);

    press('3');
    press('4');
    expect(dotTexts()).toEqual(['3', '4', '', '']);

    press('退格');
    expect(dotTexts()).toEqual(['3', '', '', '']);
  });

  it('TestBackHomeButtonCallsHandler', () => {
    const onBackHome = vi.fn();
    render(<PinGate onLogin={vi.fn()} onBackHome={onBackHome} />);

    press('回首页');

    expect(onBackHome).toHaveBeenCalledTimes(1);
  });
});
