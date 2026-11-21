import { useState } from 'react';
import { Bell, Megaphone, Pencil, Pin, Plus, Trash2 } from 'lucide-react';
import { adminApi } from '../../../lib/adminApi';
import type { Notice } from '../../../lib/types';
import { Button } from '../../../components/Button';
import { Empty } from '../../../components/Empty';
import { Sheet } from '../../../components/Sheet';
import { useToast } from '../../../components/Toast';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ErrorState, LoadingState } from '../components/DataState';
import { Field } from '../components/Field';
import { PanelHeader } from '../components/PanelHeader';
import { SheetHead } from '../components/SheetHead';
import { Toggle } from '../components/Toggle';
import { errorText, excerpt, formatWhen } from '../format';
import { useLoad } from '../useLoad';

interface NoticeRow extends Notice {
  updated_at?: string;
}

interface EditorState {
  mode: 'create' | 'edit';
  notice: NoticeRow | null;
}

interface NoticeDraft {
  title: string;
  body: string;
  pinned: boolean;
}

const EMPTY_DRAFT: NoticeDraft = { title: '', body: '', pinned: false };

export function NoticesPanel({ tick }: { tick: number }) {
  const toast = useToast();
  const notices = useLoad(() => adminApi.notices(), [tick]);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [draft, setDraft] = useState<NoticeDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [pinBusy, setPinBusy] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<NoticeRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const rows = (notices.data?.notices ?? []) as NoticeRow[];

  const openCreate = () => {
    setDraft(EMPTY_DRAFT);
    setEditor({ mode: 'create', notice: null });
  };

  const openEdit = (notice: NoticeRow) => {
    setDraft({ title: notice.title, body: notice.body, pinned: notice.pinned });
    setEditor({ mode: 'edit', notice });
  };

  const closeEditor = () => {
    if (saving) return;
    setEditor(null);
  };

  const save = async () => {
    const title = draft.title.trim();
    if (title.length === 0) {
      toast.show('先写一个标题吧', 'error');
      return;
    }
    setSaving(true);
    try {
      const input = { title, body: draft.body.trim(), pinned: draft.pinned };
      if (editor?.mode === 'edit' && editor.notice) {
        await adminApi.updateNotice(editor.notice.id, input);
      } else {
        await adminApi.createNotice(input);
      }
      toast.show('通知已发布', 'success');
      setEditor(null);
      await notices.reload();
    } catch (err) {
      toast.show(errorText(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const togglePinned = async (notice: NoticeRow) => {
    if (pinBusy !== null) return;
    setPinBusy(notice.id);
    try {
      await adminApi.updateNotice(notice.id, {
        title: notice.title,
        body: notice.body,
        pinned: !notice.pinned,
      });
      toast.show(notice.pinned ? '已取消置顶' : '通知已置顶', 'success');
      await notices.reload();
    } catch (err) {
      toast.show(errorText(err), 'error');
    } finally {
      setPinBusy(null);
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await adminApi.deleteNotice(deleteTarget.id);
      toast.show('通知已删除', 'success');
      setDeleteTarget(null);
      await notices.reload();
    } catch (err) {
      toast.show(errorText(err), 'error');
    } finally {
      setDeleting(false);
    }
  };

  const header = (
    <PanelHeader
      title="通知"
      subtitle="发一条通知给全班看，置顶的通知会一直显示在首页最上面"
      actions={
        <Button icon={Plus} size="lg" onClick={openCreate}>
          新建通知
        </Button>
      }
    />
  );

  let body;
  if (!notices.data && notices.loading) {
    body = <LoadingState text="正在加载通知…" />;
  } else if (!notices.data && notices.error) {
    body = <ErrorState text={errorText(notices.error)} onRetry={() => void notices.reload()} />;
  } else if (rows.length === 0) {
    body = (
      <div className="wb-empty-card">
        <Empty
          icon={Megaphone}
          title="还没有通知"
          hint="发一条通知，首页会提醒全班同学"
          action={
            <Button icon={Plus} size="lg" onClick={openCreate}>
              新建通知
            </Button>
          }
        />
      </div>
    );
  } else {
    body = (
      <div className="wb-notice-list wb-scroll">
        {rows.map((notice) => (
          <article
            key={notice.id}
            className={'wb-notice' + (notice.pinned ? ' wb-notice--pinned' : '')}
          >
            <div className="wb-notice__main">
              <div className="wb-notice__title-row">
                {notice.pinned ? (
                  <span className="wb-badge wb-badge--pinned">
                    <Pin size={14} strokeWidth={2.4} aria-hidden="true" />
                    置顶
                  </span>
                ) : null}
                <h3 className="wb-notice__title">{notice.title}</h3>
              </div>
              <p className="wb-notice__body">
                {notice.body.trim().length > 0 ? excerpt(notice.body, 110) : '（没有正文）'}
              </p>
              <p className="wb-notice__time">
                更新于 {formatWhen(notice.updated_at ?? notice.created_at) || '刚刚'}
              </p>
            </div>
            <div className="wb-notice__actions">
              <span className="wb-pin-switch">
                <Toggle
                  checked={notice.pinned}
                  label={notice.pinned ? '取消置顶' : '置顶通知'}
                  disabled={pinBusy === notice.id}
                  onChange={() => void togglePinned(notice)}
                />
                <span>置顶</span>
              </span>
              <Button size="sm" variant="ghost" icon={Pencil} onClick={() => openEdit(notice)}>
                编辑
              </Button>
              <Button size="sm" variant="ghost" icon={Trash2} onClick={() => setDeleteTarget(notice)}>
                删除
              </Button>
            </div>
          </article>
        ))}
      </div>
    );
  }

  return (
    <section className="wb-panel">
      {header}
      <div className="wb-panel__body wb-panel__body--notices">{body}</div>

      <Sheet open={editor !== null} onClose={closeEditor} label="通知编辑" panelClassName="wb-sheet wb-sheet--form">
        <SheetHead
          icon={Bell}
          title={editor?.mode === 'edit' ? '编辑通知' : '新建通知'}
          hint="保存后会自动同步到首页的通知条"
          onClose={closeEditor}
        />
        <div className="wb-sheet__body">
          <Field label="标题" htmlFor="wb-notice-title" counter={draft.title.length + '/40'}>
            <input
              id="wb-notice-title"
              className="wb-input"
              value={draft.title}
              maxLength={40}
              placeholder="比如：周五下午大扫除"
              onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
            />
          </Field>
          <Field label="正文" htmlFor="wb-notice-body" counter={draft.body.length + '/500'}>
            <textarea
              id="wb-notice-body"
              className="wb-textarea"
              value={draft.body}
              maxLength={500}
              placeholder="写清楚时间、地点和要带的东西"
              onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))}
            />
          </Field>
          <div className="wb-inline-row">
            <div className="wb-inline-row__copy">
              <span className="wb-label">置顶这条通知</span>
              <p className="wb-field__hint">置顶后会一直显示在首页最上面，直到取消置顶</p>
            </div>
            <Toggle
              checked={draft.pinned}
              label="置顶这条通知"
              onChange={(next) => setDraft((current) => ({ ...current, pinned: next }))}
            />
          </div>
        </div>
        <div className="wb-sheet__foot">
          <Button variant="ghost" size="lg" onClick={closeEditor} disabled={saving}>
            取消
          </Button>
          <Button size="lg" icon={Bell} onClick={() => void save()} disabled={saving || draft.title.trim().length === 0}>
            {saving ? '正在保存…' : '保存通知'}
          </Button>
        </div>
      </Sheet>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="删除这条通知？"
        message={'「' + (deleteTarget?.title ?? '') + '」删除后就看不到了，确定要删除吗？'}
        confirmLabel="删除通知"
        busy={deleting}
        onConfirm={() => void remove()}
        onClose={() => {
          if (!deleting) setDeleteTarget(null);
        }}
      />
    </section>
  );
}
