import { useCallback, useEffect, useRef, useState } from 'react';
import { Inbox, Pin, Plus, Trash2 } from 'lucide-react';
import { adminApi } from '../../lib/adminApi';
import type { Notice } from '../../lib/types';
import { Empty } from '../../components/Empty';
import {
  ConfirmDialog,
  ErrorBlock,
  Field,
  LoadingBlock,
  SubpageHeader,
  Switch,
  TabHeader,
  formatTime,
  mobileError,
  type DoneHandler,
} from './mobileUi';

function sortNotices(list: Notice[]): Notice[] {
  return [...list].sort((left, right) => {
    if (left.pinned !== right.pinned) return left.pinned ? -1 : 1;
    const leftAt = left.created_at ? Date.parse(left.created_at) : 0;
    const rightAt = right.created_at ? Date.parse(right.created_at) : 0;
    return rightAt - leftAt;
  });
}

export function MobileNotices({ onNew, onEdit }: { onNew: () => void; onEdit: (notice: Notice) => void }) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await adminApi.notices();
      setNotices(sortNotices(result.notices));
    } catch (loadError) {
      setError(mobileError(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="m-page">
      <TabHeader
        title="通知"
        action={
          <button type="button" className="m-btn m-btn--primary" onClick={onNew}>
            <Plus size={18} strokeWidth={2.4} aria-hidden="true" />
            发通知
          </button>
        }
      />

      {loading ? <LoadingBlock text="正在取通知" /> : null}
      {!loading && error ? <ErrorBlock message={error} onRetry={() => void load()} /> : null}

      {!loading && !error && notices.length === 0 ? (
        <Empty icon={Inbox} title="还没有通知" hint="点右上角「发通知」，教室大屏马上就能看到。" compact />
      ) : null}

      {!loading && !error && notices.length > 0 ? (
        <ul className="m-list">
          {notices.map((notice) => (
            <li key={notice.id}>
              <button type="button" className="m-card m-notice" onClick={() => onEdit(notice)}>
                <span className="m-notice__meta">
                  {notice.pinned ? (
                    <span className="m-tag m-tag--pin">
                      <Pin size={12} strokeWidth={2.4} aria-hidden="true" />
                      置顶
                    </span>
                  ) : null}
                  {notice.created_at ? <span className="m-notice__time">{formatTime(notice.created_at)}</span> : null}
                </span>
                <span className="m-notice__title">{notice.title}</span>
                <span className={notice.body ? 'm-notice__body' : 'm-notice__body m-notice__body--empty'}>
                  {notice.body || '没有正文'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export function NoticeEditor({
  notice,
  onClose,
  onDone,
}: {
  notice: Notice | null;
  onClose: () => void;
  onDone: DoneHandler;
}) {
  const [title, setTitle] = useState(notice?.title ?? '');
  const [body, setBody] = useState(notice?.body ?? '');
  const [pinned, setPinned] = useState(notice?.pinned ?? false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);

  // 正文随内容长高，保持原生滚动，不出现固定高度的小滚动条。
  useEffect(() => {
    const node = bodyRef.current;
    if (!node) return;
    node.style.height = 'auto';
    node.style.height = String(Math.min(Math.max(node.scrollHeight, 168), 460)) + 'px';
  }, [body]);

  const save = async () => {
    const nextTitle = title.trim();
    if (!nextTitle) {
      setFormError('先给通知写一个标题');
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      const input = { title: nextTitle, body: body.trim(), pinned };
      if (notice) {
        await adminApi.updateNotice(notice.id, input);
        onDone('通知已保存');
      } else {
        await adminApi.createNotice(input);
        onDone('通知已发布');
      }
    } catch (saveError) {
      setFormError(mobileError(saveError));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!notice) return;
    setBusy(true);
    setFormError(null);
    try {
      await adminApi.deleteNotice(notice.id);
      onDone('通知已删除');
    } catch (removeError) {
      setConfirmDelete(false);
      setFormError(mobileError(removeError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="m-subpage">
      <SubpageHeader title={notice ? '编辑通知' : '新建通知'} onBack={onClose} />
      <main className="m-subpage__main">
        <Field label="标题" counter={title.length + '/40'}>
          <input
            className="m-input"
            value={title}
            maxLength={40}
            placeholder="比如：明天带跳绳"
            aria-label="通知标题"
            onChange={(event) => setTitle(event.target.value)}
          />
        </Field>

        <Field label="正文" counter={body.length + '/500'}>
          <textarea
            ref={bodyRef}
            className="m-textarea"
            value={body}
            maxLength={500}
            placeholder="写清楚时间、地点和要带的东西"
            aria-label="通知正文"
            onChange={(event) => setBody(event.target.value)}
          />
        </Field>

        <div className="m-card m-card--pad">
          <Switch
            checked={pinned}
            onChange={setPinned}
            label="置顶这条通知"
            hint="置顶后会一直显示在教室大屏最上面"
          />
        </div>

        {formError ? (
          <p className="m-form-error" role="alert">
            {formError}
          </p>
        ) : null}

        <button type="button" className="m-btn m-btn--primary m-btn--block" onClick={() => void save()} disabled={busy}>
          {busy ? '正在保存' : '保存通知'}
        </button>

        {notice ? (
          <button
            type="button"
            className="m-btn m-btn--danger-soft m-btn--block"
            onClick={() => setConfirmDelete(true)}
            disabled={busy}
          >
            <Trash2 size={18} aria-hidden="true" />
            删除这条通知
          </button>
        ) : null}

        <p className="m-form-foot">保存后会立刻同步到教室大屏。</p>
      </main>

      <ConfirmDialog
        open={confirmDelete}
        title="删除这条通知？"
        description="删除后教室大屏上就看不到了，不能恢复。"
        confirmLabel="删除"
        busy={busy}
        onConfirm={() => void remove()}
        onCancel={() => setConfirmDelete(false)}
      />
    </section>
  );
}
