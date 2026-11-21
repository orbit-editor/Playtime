import { useState } from 'react';
import { Check, CheckCircle2, Gift, Pencil, Plus, Trash2, X } from 'lucide-react';
import { adminApi, type AdminRedeem, type AdminReward } from '../../../lib/adminApi';
import { Button } from '../../../components/Button';
import { Empty } from '../../../components/Empty';
import { Sheet } from '../../../components/Sheet';
import { useToast } from '../../../components/Toast';
import { FlowerMark } from '../../../components/FlowerMark';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ErrorState, LoadingState } from '../components/DataState';
import { Field } from '../components/Field';
import { PanelHeader } from '../components/PanelHeader';
import { SheetHead } from '../components/SheetHead';
import { Stepper } from '../components/Stepper';
import { Toggle } from '../components/Toggle';
import { errorText, formatWhen } from '../format';
import { useLoad } from '../useLoad';

interface RewardDraft {
  title: string;
  cost: number;
  weekly_limit: number;
  enabled: boolean;
}

const EMPTY_DRAFT: RewardDraft = { title: '', cost: 10, weekly_limit: 0, enabled: true };

interface EditorState {
  mode: 'create' | 'edit';
  reward: AdminReward | null;
}

export function RewardsPanel({ tick }: { tick: number }) {
  const toast = useToast();
  const state = useLoad(async () => {
    const [redeems, rewards] = await Promise.all([adminApi.redeems('pending'), adminApi.rewards()]);
    return { redeems: redeems.redeems, rewards: rewards.rewards };
  }, [tick]);

  const [editor, setEditor] = useState<EditorState | null>(null);
  const [draft, setDraft] = useState<RewardDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [decideBusy, setDecideBusy] = useState<number | null>(null);
  const [enabledBusy, setEnabledBusy] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminReward | null>(null);
  const [deleting, setDeleting] = useState(false);

  const redeems = state.data?.redeems ?? [];
  const rewards = state.data?.rewards ?? [];

  const openCreate = () => {
    setDraft(EMPTY_DRAFT);
    setEditor({ mode: 'create', reward: null });
  };

  const openEdit = (reward: AdminReward) => {
    setDraft({ title: reward.title, cost: reward.cost, weekly_limit: reward.weekly_limit, enabled: reward.enabled });
    setEditor({ mode: 'edit', reward });
  };

  const closeEditor = () => {
    if (saving) return;
    setEditor(null);
  };

  const decide = async (redeem: AdminRedeem, approve: boolean) => {
    if (decideBusy !== null) return;
    setDecideBusy(redeem.id);
    try {
      await adminApi.decideRedeem(redeem.id, approve);
      toast.show(
        approve ? '已通过 ' + redeem.student_name + ' 的兑换' : '已拒绝 ' + redeem.student_name + ' 的兑换',
        'success',
      );
      await state.reload();
    } catch (err) {
      toast.show(errorText(err), 'error');
      await state.reload();
    } finally {
      setDecideBusy(null);
    }
  };

  const save = async () => {
    const title = draft.title.trim();
    if (title.length === 0) {
      toast.show('先给奖励起个名字', 'error');
      return;
    }
    if (draft.cost < 1) {
      toast.show('所需小红花至少 1 朵', 'error');
      return;
    }
    setSaving(true);
    try {
      const input = {
        title,
        cost: draft.cost,
        weekly_limit: draft.weekly_limit,
        enabled: draft.enabled,
      };
      if (editor?.mode === 'edit' && editor.reward) {
        await adminApi.updateReward(editor.reward.id, input);
      } else {
        await adminApi.createReward(input);
      }
      toast.show('奖励已保存', 'success');
      setEditor(null);
      await state.reload();
    } catch (err) {
      toast.show(errorText(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (reward: AdminReward) => {
    if (enabledBusy !== null) return;
    setEnabledBusy(reward.id);
    try {
      await adminApi.updateReward(reward.id, {
        title: reward.title,
        cost: reward.cost,
        weekly_limit: reward.weekly_limit,
        enabled: !reward.enabled,
      });
      toast.show(reward.enabled ? '已停用「' + reward.title + '」' : '已启用「' + reward.title + '」', 'success');
      await state.reload();
    } catch (err) {
      toast.show(errorText(err), 'error');
    } finally {
      setEnabledBusy(null);
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await adminApi.deleteReward(deleteTarget.id);
      toast.show('奖励已删除', 'success');
      setDeleteTarget(null);
      await state.reload();
    } catch (err) {
      toast.show(errorText(err), 'error');
    } finally {
      setDeleting(false);
    }
  };

  let pendingBody;
  if (!state.data && state.loading) {
    pendingBody = <LoadingState text="正在加载兑换申请…" />;
  } else if (redeems.length === 0) {
    pendingBody = (
      <Empty
        icon={CheckCircle2}
        title="没有待审批的兑换"
        hint="学生用小红花兑换奖励后，会出现在这里等老师确认"
        compact
      />
    );
  } else {
    pendingBody = (
      <div className="wb-redeem-list wb-scroll">
        {redeems.map((redeem) => (
          <div className="wb-redeem" key={redeem.id}>
            <span className="wb-redeem__avatar" aria-hidden="true">
              {Array.from(redeem.student_name.trim())[0] ?? '同'}
            </span>
            <div className="wb-redeem__copy">
              <p className="wb-redeem__line">
                <span className="wb-redeem__student">{redeem.student_name}</span>
                <span className="wb-redeem__reward">兑换「{redeem.reward_title}」</span>
              </p>
              <p className="wb-redeem__meta">
                <span className="wb-redeem__cost">
                  <FlowerMark size={18} />
                  {redeem.cost} 朵
                </span>
                <span>{formatWhen(redeem.created_at)}</span>
              </p>
            </div>
            <div className="wb-redeem__actions">
              <Button
                size="sm"
                icon={Check}
                disabled={decideBusy === redeem.id}
                onClick={() => void decide(redeem, true)}
              >
                {decideBusy === redeem.id ? '正在处理…' : '通过'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                icon={X}
                disabled={decideBusy === redeem.id}
                onClick={() => void decide(redeem, false)}
              >
                不通过
              </Button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  let rewardsBody;
  if (!state.data && state.loading) {
    rewardsBody = <LoadingState text="正在加载奖励…" />;
  } else if (rewards.length === 0) {
    rewardsBody = (
      <Empty
        icon={Gift}
        title="还没有设置奖励"
        hint="设一些小红花能换的东西，孩子会更有劲"
        action={
          <Button icon={Plus} size="lg" onClick={openCreate}>
            新建奖励
          </Button>
        }
        compact
      />
    );
  } else {
    rewardsBody = (
      <div className="wb-reward-list wb-scroll">
        {rewards.map((reward) => (
          <div className={'wb-reward' + (reward.enabled ? '' : ' wb-reward--off')} key={reward.id}>
            <span className="wb-reward__mark" aria-hidden="true">
              <Gift size={22} strokeWidth={2.2} />
            </span>
            <div className="wb-reward__copy">
              <p className="wb-reward__line">
                <span className="wb-reward__title">{reward.title}</span>
                <span className="wb-badge wb-badge--soft">
                  {reward.weekly_limit === 0 ? '每周不限' : '每周最多 ' + reward.weekly_limit + ' 次'}
                </span>
              </p>
              <p className="wb-reward__cost">
                <FlowerMark size={18} />
                <b>{reward.cost}</b> 朵小红花
              </p>
            </div>
            <div className="wb-reward__actions">
              <span className="wb-inline-toggle">
                <Toggle
                  checked={reward.enabled}
                  label={(reward.enabled ? '停用' : '启用') + '奖励' + reward.title}
                  disabled={enabledBusy === reward.id}
                  onChange={() => void toggleEnabled(reward)}
                />
                <span>{reward.enabled ? '启用' : '停用'}</span>
              </span>
              <Button size="sm" variant="ghost" icon={Pencil} onClick={() => openEdit(reward)}>
                编辑
              </Button>
              <Button size="sm" variant="ghost" icon={Trash2} onClick={() => setDeleteTarget(reward)}>
                删除
              </Button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <section className="wb-panel">
      <PanelHeader
        title="奖励"
        subtitle="学生用小红花兑换奖励，先由老师审批，再更新奖励设置"
        actions={
          <Button icon={Plus} size="lg" onClick={openCreate}>
            新建奖励
          </Button>
        }
      />

      <div className="wb-panel__body wb-panel__body--rewards">
        <div className="wb-card wb-redeem-card">
          <div className="wb-card__head">
            <h3 className="wb-card__title">
              <CheckCircle2 size={22} strokeWidth={2.2} aria-hidden="true" />
              待审批兑换
            </h3>
            <span className="wb-card__hint">共 {redeems.length} 条待处理</span>
          </div>
          <div className="wb-card__body">
            {!state.data && state.error ? (
              <ErrorState text={errorText(state.error)} onRetry={() => void state.reload()} />
            ) : (
              pendingBody
            )}
          </div>
        </div>

        <div className="wb-card wb-reward-card">
          <div className="wb-card__head">
            <h3 className="wb-card__title">
              <Gift size={22} strokeWidth={2.2} aria-hidden="true" />
              奖励设置
            </h3>
            <span className="wb-card__hint">共 {rewards.length} 个奖励</span>
          </div>
          <div className="wb-card__body">{rewardsBody}</div>
        </div>
      </div>

      <Sheet open={editor !== null} onClose={closeEditor} label="奖励编辑" panelClassName="wb-sheet wb-sheet--form">
        <SheetHead
          icon={Gift}
          title={editor?.mode === 'edit' ? '编辑奖励' : '新建奖励'}
          hint="学生用小红花兑换，兑换时需要老师审批"
          onClose={closeEditor}
        />
        <div className="wb-sheet__body">
          <Field label="奖励名称" htmlFor="wb-reward-title" counter={draft.title.length + '/30'}>
            <input
              id="wb-reward-title"
              className="wb-input"
              value={draft.title}
              maxLength={30}
              placeholder="比如：换一次课间点歌"
              onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
            />
          </Field>
          <div className="wb-sheet__grid">
            <Field label="所需小红花">
              <Stepper
                value={draft.cost}
                label="所需小红花"
                min={1}
                max={999}
                suffix="朵"
                onChange={(next) => setDraft((current) => ({ ...current, cost: next }))}
              />
            </Field>
            <Field label="每周上限" hint="0 表示每周不限次数">
              <Stepper
                value={draft.weekly_limit}
                label="每周上限"
                min={0}
                max={99}
                suffix="次"
                onChange={(next) => setDraft((current) => ({ ...current, weekly_limit: next }))}
              />
            </Field>
          </div>
          <div className="wb-inline-row">
            <div className="wb-inline-row__copy">
              <span className="wb-label">启用这个奖励</span>
              <p className="wb-field__hint">停用后学生就看不到它了</p>
            </div>
            <Toggle
              checked={draft.enabled}
              label="启用这个奖励"
              onChange={(next) => setDraft((current) => ({ ...current, enabled: next }))}
            />
          </div>
        </div>
        <div className="wb-sheet__foot">
          <Button variant="ghost" size="lg" onClick={closeEditor} disabled={saving}>
            取消
          </Button>
          <Button size="lg" icon={Gift} onClick={() => void save()} disabled={saving || draft.title.trim().length === 0}>
            {saving ? '正在保存…' : '保存奖励'}
          </Button>
        </div>
      </Sheet>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="删除这个奖励？"
        message={'删除「' + (deleteTarget?.title ?? '') + '」后，学生就不能再兑换它了。已经兑换过的记录会保留。'}
        confirmLabel="删除奖励"
        busy={deleting}
        onConfirm={() => void remove()}
        onClose={() => {
          if (!deleting) setDeleteTarget(null);
        }}
      />
    </section>
  );
}
