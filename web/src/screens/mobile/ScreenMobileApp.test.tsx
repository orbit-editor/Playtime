import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../../components/Toast';
import type { AdminRedeem, AdminReward, AdminStudent } from '../../lib/adminApi';
import type { Notice } from '../../lib/types';
import { ScreenMobileApp } from './ScreenMobileApp';

vi.mock('../../lib/adminApi', () => ({
  adminApi: {
    me: vi.fn(),
    logout: vi.fn(),
    changePIN: vi.fn(),
    classInfo: vi.fn(),
    saveClass: vi.fn(),
    notices: vi.fn(),
    createNotice: vi.fn(),
    updateNotice: vi.fn(),
    deleteNotice: vi.fn(),
    students: vi.fn(),
    importStudents: vi.fn(),
    setStudentEnabled: vi.fn(),
    exportStudentsCSV: vi.fn(),
    rewards: vi.fn(),
    createReward: vi.fn(),
    updateReward: vi.fn(),
    deleteReward: vi.fn(),
    redeems: vi.fn(),
    decideRedeem: vi.fn(),
  },
}));

import { adminApi } from '../../lib/adminApi';

const mocked = vi.mocked(adminApi);

const studentsFixture: AdminStudent[] = [
  { id: 1, sid: '01', name: '张小明', pinyin: 'zhangxiaoming', enabled: true, balance: 0, today: 0 },
  { id: 2, sid: '02', name: '李小红', pinyin: 'lixiaohong', enabled: true, balance: 0, today: 0 },
  { id: 3, sid: '03', name: '王大力', pinyin: 'wangdali', enabled: true, balance: 0, today: 0 },
  { id: 4, sid: '04', name: '赵欣然', pinyin: 'zhaoxinran', enabled: true, balance: 0, today: 0 },
  { id: 5, sid: '05', name: '陈思远', pinyin: 'chensiyuan', enabled: true, balance: 0, today: 0 },
  { id: 6, sid: '06', name: '周雨桐', pinyin: 'zhouyutong', enabled: true, balance: 0, today: 0 },
];

const rewardsFixture: AdminReward[] = [
  { id: 1, title: '换一次课间点歌', cost: 10, weekly_limit: 2, enabled: true },
  { id: 2, title: '当一天小组长', cost: 30, weekly_limit: 1, enabled: true },
];

const pendingRedeem: AdminRedeem = {
  id: 9,
  student_id: 1,
  student_name: '张小明',
  reward_id: 1,
  reward_title: '换一次课间点歌',
  cost: 10,
  status: 'pending',
  created_at: '2026-11-21T10:20:00+08:00',
};

const noticeFixtures: Notice[] = [
  {
    id: 1,
    title: '明天带跳绳',
    body: '第一节课后到操场集合。',
    pinned: false,
    created_at: '2026-11-21T09:00:00+08:00',
  },
  {
    id: 2,
    title: '周五下午大扫除',
    body: '带上抹布，分工见后墙的表格。',
    pinned: true,
    created_at: '2026-11-20T16:30:00+08:00',
  },
];

function mockReady(): void {
  mocked.me.mockResolvedValue({ authenticated: true, role: 'phone' });
  mocked.logout.mockResolvedValue({ ok: true });
  mocked.changePIN.mockResolvedValue({ ok: true });
  mocked.classInfo.mockResolvedValue({
    class: { name: '三年级二班', grade: 3, school: '阳光小学' },
    configured: true,
  });
  mocked.saveClass.mockResolvedValue({ ok: true });
  mocked.notices.mockResolvedValue({ notices: [] });
  mocked.createNotice.mockResolvedValue({ id: 99 });
  mocked.updateNotice.mockResolvedValue({ ok: true });
  mocked.deleteNotice.mockResolvedValue({ ok: true });
  mocked.students.mockResolvedValue({ students: studentsFixture });
  mocked.importStudents.mockResolvedValue({ added: 1, updated: 0, skipped: 0 });
  mocked.setStudentEnabled.mockResolvedValue({ ok: true });
  mocked.rewards.mockResolvedValue({ rewards: rewardsFixture });
  mocked.redeems.mockResolvedValue({ redeems: [] });
  mocked.decideRedeem.mockResolvedValue({ ok: true });
}

function renderApp() {
  return render(
    <ToastProvider>
      <ScreenMobileApp />
    </ToastProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  // jsdom 不支持滚动，换成空实现，避免控制台噪音。
  vi.stubGlobal('scrollTo', vi.fn());
  mockReady();
});

describe('老师手机版', () => {
  it('TestShowsExpiredPageWhenUnauthenticated', async () => {
    mocked.me.mockResolvedValue({ authenticated: false, role: 'phone' });
    renderApp();

    expect(await screen.findByText('这个链接已经用过或过期了')).toBeTruthy();
    expect(screen.getByText('请老师在教室大屏上重新生成二维码。')).toBeTruthy();
    expect(screen.getByRole('button', { name: '重试' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '退出' })).toBeNull();
  });

  it('TestRetryRecoversAfterExpiredLink', async () => {
    mocked.me
      .mockResolvedValueOnce({ authenticated: false, role: 'phone' })
      .mockResolvedValue({ authenticated: true, role: 'phone' });
    renderApp();

    fireEvent.click(await screen.findByRole('button', { name: '重试' }));

    expect(await screen.findByText('三年级二班')).toBeTruthy();
    expect(screen.getByText('老师')).toBeTruthy();
    expect(mocked.me).toHaveBeenCalledTimes(2);
  });

  it('TestShowsPinnedNoticeFirst', async () => {
    mocked.notices.mockResolvedValue({ notices: noticeFixtures });
    const { container } = renderApp();

    await screen.findByText('周五下午大扫除');
    const titles = Array.from(container.querySelectorAll('.m-notice__title')).map((node) => node.textContent);
    expect(titles).toEqual(['周五下午大扫除', '明天带跳绳']);
    expect(container.querySelectorAll('.m-tag--pin')).toHaveLength(1);
  });

  it('TestCreatesNotice', async () => {
    renderApp();
    await screen.findByText('三年级二班');

    fireEvent.click(screen.getByRole('button', { name: '发通知' }));
    fireEvent.change(await screen.findByLabelText('通知标题'), { target: { value: '明天带跳绳' } });
    fireEvent.change(screen.getByLabelText('通知正文'), { target: { value: '第一节课后到操场集合。' } });
    fireEvent.click(screen.getByRole('button', { name: '保存通知' }));

    await waitFor(() =>
      expect(mocked.createNotice).toHaveBeenCalledWith({
        title: '明天带跳绳',
        body: '第一节课后到操场集合。',
        pinned: false,
      }),
    );
    expect(await screen.findByText('通知已发布')).toBeTruthy();
    expect(await screen.findByRole('button', { name: '发通知' })).toBeTruthy();
  });

  it('TestLogoutReturnsToExpiredPage', async () => {
    renderApp();
    await screen.findByText('三年级二班');

    fireEvent.click(screen.getByRole('button', { name: '退出' }));

    await waitFor(() => expect(mocked.logout).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('这个链接已经用过或过期了')).toBeTruthy();
  });

  it('TestStudentsTabShowsRoster', async () => {
    const { container } = renderApp();
    await screen.findByText('三年级二班');

    fireEvent.click(screen.getByRole('button', { name: '名单' }));

    expect(await screen.findByText('张小明')).toBeTruthy();
    expect(container.querySelectorAll('.m-student')).toHaveLength(6);
    expect(screen.getAllByRole('button', { name: '停用' })).toHaveLength(6);
    expect(container.querySelector('.m-statbar__count')?.textContent).toContain('6');
    expect(screen.getByRole('button', { name: '导出 CSV' })).toBeTruthy();
  });

  it('TestRewardsTabApprovesPendingRedeem', async () => {
    mocked.redeems.mockResolvedValue({ redeems: [pendingRedeem] });
    renderApp();
    await screen.findByText('三年级二班');

    fireEvent.click(screen.getByRole('button', { name: '奖励' }));

    expect(await screen.findByText('待审批兑换')).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: '通过' }));

    await waitFor(() => expect(mocked.decideRedeem).toHaveBeenCalledWith(9, true));
    await waitFor(() => expect(screen.queryByRole('button', { name: '通过' })).toBeNull());
    expect(screen.getByText('现在没有等着审批的兑换。学生兑换后会出现在这里。')).toBeTruthy();
    expect(screen.getByText('当一天小组长')).toBeTruthy();
  });

  it('TestReplaceImportAsksForConfirmation', async () => {
    renderApp();
    await screen.findByText('三年级二班');

    fireEvent.click(screen.getByRole('button', { name: '名单' }));
    fireEvent.click(await screen.findByRole('button', { name: '导入' }));
    fireEvent.change(await screen.findByLabelText('学生名单'), {
      target: { value: '01 张小明\n02 李小红' },
    });
    fireEvent.click(screen.getByRole('button', { name: '替换全部' }));
    fireEvent.click(screen.getByRole('button', { name: '导入名单' }));

    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(screen.getByText('替换整份名单？')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '替换并导入' }));

    await waitFor(() => expect(mocked.importStudents).toHaveBeenCalledWith('01 张小明\n02 李小红', 'replace'));
  });

  it('TestChangePinWithoutOldPassword', async () => {
    renderApp();
    await screen.findByText('三年级二班');

    fireEvent.click(screen.getByRole('button', { name: '更多' }));
    fireEvent.click(await screen.findByRole('button', { name: /修改密码/ }));

    fireEvent.change(await screen.findByLabelText('新密码'), { target: { value: '4321' } });
    fireEvent.change(screen.getByLabelText('确认新密码'), { target: { value: '4321' } });
    fireEvent.click(screen.getByRole('button', { name: '保存新密码' }));

    await waitFor(() => expect(mocked.changePIN).toHaveBeenCalledWith('4321'));
    expect(await screen.findByText('密码改好了，请记牢')).toBeTruthy();
  });
});
