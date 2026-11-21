import { useCallback, useEffect, useState } from 'react';
import { Gift, Pencil, Plus, Trash2 } from 'lucide-react';
import { adminApi, type AdminRedeem, type AdminReward } from '../../lib/adminApi';
import { useToast } from '../../components/Toast';
import { Empty } from '../../components/Empty';
import {
  ConfirmDialog,
  ErrorBlock,
  Field,
  LoadingBlock,
  SectionTitle,
  SubpageHeader,
  Switch,
  TabHeader,
  formatTime,
  mobileError,
  type DoneHandler,
} from './mobileUi';

function weeklyText(limit: number): string {
  return limit > 0 ? '每周最多 ' + String(limit) + ' 次' : '每周不限次数';
}

export function MobileRewards({ onNew, onEdit }: { onNew: () => void; onEdit: (reward: AdminReward) => void }) {
  const toast = useToast();
  const [rewards, setRewards] = useState<AdminReward[]>([]);
  const [pending, setPending] = useState<AdminRedeem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rewardResult, redeemResult] = await Promise.all([
        adminApi.rewards(),
        adminApi.redeems('pending'),
      ]);
      setRewards(rewardResult.rewards);
      setPending(redeemResult.redeems);
    } catch (loadError) {
      setError(mobileError(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (redeem: AdminRedeem, approve: boolean) => {
    if (busyId !== null) return;
    setBusyId(redeem.id);
    try {
      await adminApi.decideRedeem(redeem.id, approve);
      setPending((current) => current.filter((item) => item.id !== redeem.id));
      toast.show(
        approve ? '已通过 ' + redeem.student_name + ' 的兑换' : '已拒绝 ' + redeem.student_name + ' 的兑换',
        approve ? 'success' : 'info',
      );
    } catch (decideError) {
      toast.show(mobileError(decideError), 'error');
      void load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="m-page">
      <TabHeader
        title="奖励"
        action={
          <button type="button" className="m-btn m-btn--primary" onClick={onNew}>
            <Plus size={18} strokeWidth={2.4} aria-hidden="true" />
            新建
          </button>
        }
      />

      {loading ? <LoadingBlock text="正在取奖励" /> : null}
      {!loading && error ? <ErrorBlock message={error} onRetry={() => void load()} /> : null}

      {!loading && !error ? (
        <>
          <section className="m-section">
            <SectionTitle title="待审批兑换" count={pending.length} />
            {pending.length === 0 ? (
              <p className="m-hintcard">现在没有等着审批的兑换。学生兑换后会出现在这里。</p>
            ) : (
              <ul className="m-list">
                {pending.map((redeem) => (
                  <li key={redeem.id} className="m-card m-redeem">
                    <span className="m-redeem__line">
                      <strong>{redeem.student_name}</strong>
                      <span>想换</span>
                      <strong>{redeem.reward_title}</strong>
                    </span>
                    <span className="m-redeem__meta">
                      {redeem.cost} 朵小红花 · {formatTime(redeem.created_at)}
                    </span>
                    <span className="m-redeem__actions">
                      <button
                        type="button"
                        className="m-btn m-btn--primary"
                        onClick={() => void decide(redeem, true)}
                        disabled={busyId !== null}
                      >
                        通过
                      </button>
                      <button
                        type="button"
                        className="m-btn m-btn--ghost"
                        onClick={() => void decide(redeem, false)}
                        disabled={busyId !== null}
                      >
                        不通过
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="m-section">
            <SectionTitle title="奖励设置" count={rewards.length} />
            {rewards.length === 0 ? (
              <Empty icon={Gift} title="还没有奖励" hint="点右上角「新建」，设置学生可以用小红花换的东西。" compact />
            ) : (
              <ul className="m-list">
                {rewards.map((reward) => (
                  <li key={reward.id}>
                    <button type="button" className="m-card m-reward" onClick={() => onEdit(reward)}>
                      <span className="m-reward__body">
                        <span className="m-reward__title">
                          {reward.title}
                          {reward.enabled ? null : <span className="m-tag m-tag--off">已停用</span>}
                        </span>
                        <span className="m-reward__meta">
                          {reward.cost} 朵小红花 · {weeklyText(reward.weekly_limit)}
                        </span>
                      </span>
                      <Pencil className="m-reward__chev" size={18} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </section>
  );
}

export function RewardEditor({
  reward,
  onClose,
  onDone,
}: {
  reward: AdminReward | null;
  onClose: () => void;
  onDone: DoneHandler;
}) {
  const [title, setTitle] = useState(reward?.title ?? '');
  const [cost, setCost] = useState(reward ? String(reward.cost) : '');
  const [weeklyLimit, setWeeklyLimit] = useState(reward ? String(reward.weekly_limit) : '0');
  const [enabled, setEnabled] = useState(reward?.enabled ?? true);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = async () => {
    const nextTitle = title.trim();
    if (!nextTitle) {
      setFormError('先给奖励写一个名字');
      return;
    }
    const costValue = Number(cost);
    if (!Number.isInteger(costValue) || costValue < 1 || costValue > 9999) {
      setFormError('所需小红花请填 1 到 9999 之间的整数');
      return;
    }
    const limitValue = weeklyLimit.trim() === '' ? 0 : Number(weeklyLimit);
    if (!Number.isInteger(limitValue) || limitValue < 0) {
      setFormError('每周上限请填 0 或正整数');
      return;
    }

    setBusy(true);
    setFormError(null);
    try {
      const input = { title: nextTitle, cost: costValue, weekly_limit: limitValue, enabled };
      if (reward) {
        await adminApi.updateReward(reward.id, input);
        onDone('奖励已保存');
      } else {
        await adminApi.createReward(input);
        onDone('奖励已添加');
      }
    } catch (saveError) {
      setFormError(mobileError(saveError));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!reward) return;
    setBusy(true);
    setFormError(null);
    try {
      await adminApi.deleteReward(reward.id);
      onDone('奖励已删除');
    } catch (removeError) {
      setConfirmDelete(false);
      setFormError(mobileError(removeError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="m-subpage">
      <SubpageHeader title={reward ? '编辑奖励' : '新建奖励'} onBack={onClose} />
      <main className="m-subpage__main">
        <Field label="奖励名称" counter={title.length + '/20'}>
          <input
            className="m-input"
            value={title}
            maxLength={20}
            placeholder="比如：换一次课间点歌"
            aria-label="奖励名称"
            onChange={(event) => setTitle(event.target.value)}
          />
        </Field>

        <Field label="所需小红花">
          <input
            className="m-input"
            type="number"
            inputMode="numeric"
            min={1}
            max={9999}
            value={cost}
            placeholder="10"
            aria-label="所需小红花"
            onChange={(event) => setCost(event.target.value)}
          />
        </Field>

        <Field label="每周上限" hint="填 0 表示每周不限次数">
          <input
            className="m-input"
            type="number"
            inputMode="numeric"
            min={0}
            value={weeklyLimit}
            aria-label="每周上限"
            onChange={(event) => setWeeklyLimit(event.target.value)}
          />
        </Field>

        <div className="m-card m-card--pad">
          <Switch checked={enabled} onChange={setEnabled} label="启用这个奖励" hint="停用后学生就换不到了" />
        </div>

        {formError ? (
          <p className="m-form-error" role="alert">
            {formError}
          </p>
        ) : null}

        <button type="button" className="m-btn m-btn--primary m-btn--block" onClick={() => void save()} disabled={busy}>
          {busy ? '正在保存' : '保存奖励'}
        </button>

        {reward ? (
          <button
            type="button"
            className="m-btn m-btn--danger-soft m-btn--block"
            onClick={() => setConfirmDelete(true)}
            disabled={busy}
          >
            <Trash2 size={18} aria-hidden="true" />
            删除这个奖励
          </button>
        ) : null}
      </main>

      <ConfirmDialog
        open={confirmDelete}
        title="删除这个奖励？"
        description="删除后学生就看不到这个奖励了，不能恢复。"
        confirmLabel="删除"
        busy={busy}
        onConfirm={() => void remove()}
        onCancel={() => setConfirmDelete(false)}
      />
    </section>
  );
}
