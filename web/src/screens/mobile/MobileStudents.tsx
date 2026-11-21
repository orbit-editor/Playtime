import { useCallback, useEffect, useState } from 'react';
import { Download, Upload, Users } from 'lucide-react';
import { adminApi, type AdminStudent } from '../../lib/adminApi';
import { useToast } from '../../components/Toast';
import { Empty } from '../../components/Empty';
import {
  ConfirmDialog,
  ErrorBlock,
  Field,
  LoadingBlock,
  SubpageHeader,
  TabHeader,
  mobileError,
  type DoneHandler,
} from './mobileUi';

export function MobileStudents({ onImport }: { onImport: () => void }) {
  const toast = useToast();
  const [students, setStudents] = useState<AdminStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await adminApi.students();
      setStudents(result.students);
    } catch (loadError) {
      setError(mobileError(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async (student: AdminStudent) => {
    if (busyId !== null) return;
    setBusyId(student.id);
    try {
      await adminApi.setStudentEnabled(student.id, !student.enabled);
      setStudents((current) =>
        current.map((item) => (item.id === student.id ? { ...item, enabled: !item.enabled } : item)),
      );
      toast.show(student.enabled ? student.name + ' 已停用' : student.name + ' 已启用', 'success');
    } catch (toggleError) {
      toast.show(mobileError(toggleError), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const downloadCsv = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const blob = await adminApi.exportStudentsCSV();
      if (typeof URL.createObjectURL !== 'function') {
        toast.show('当前浏览器不能直接下载，请换个浏览器试试', 'error');
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = '学生名单.csv';
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.show('名单已导出', 'success');
    } catch (downloadError) {
      toast.show(mobileError(downloadError), 'error');
    } finally {
      setExporting(false);
    }
  };

  const enabledCount = students.filter((student) => student.enabled).length;

  return (
    <section className="m-page">
      <TabHeader
        title="名单"
        action={
          <button type="button" className="m-btn m-btn--primary" onClick={onImport}>
            <Upload size={18} strokeWidth={2.4} aria-hidden="true" />
            导入
          </button>
        }
      />

      {loading ? <LoadingBlock text="正在取名单" /> : null}
      {!loading && error ? <ErrorBlock message={error} onRetry={() => void load()} /> : null}

      {!loading && !error ? (
        <>
          <div className="m-statbar">
            <p className="m-statbar__count">
              共 <strong>{students.length}</strong> 人 · 启用 <strong>{enabledCount}</strong> 人
            </p>
            <button type="button" className="m-btn m-btn--soft m-btn--sm" onClick={() => void downloadCsv()} disabled={exporting}>
              <Download size={16} aria-hidden="true" />
              {exporting ? '导出中' : '导出 CSV'}
            </button>
          </div>

          {students.length === 0 ? (
            <Empty icon={Users} title="名单还是空的" hint="点右上角「导入」，把学生名单粘进来。" compact />
          ) : (
            <ul className="m-list">
              {students.map((student) => (
                <li
                  key={student.id}
                  className={student.enabled ? 'm-card m-student' : 'm-card m-student m-student--off'}
                >
                  <span className="m-student__sid" aria-hidden="true">
                    {student.sid || '--'}
                  </span>
                  <span className="m-student__body">
                    <span className="m-student__name">
                      {student.name}
                      {student.enabled ? null : <span className="m-tag m-tag--off">已停用</span>}
                    </span>
                    <span className="m-student__meta">
                      今天 {student.today} 朵 · 现有 {student.balance} 朵
                    </span>
                  </span>
                  <span className="m-student__action">
                    <button
                      type="button"
                      className={'m-btn m-btn--sm ' + (student.enabled ? 'm-btn--ghost' : 'm-btn--soft')}
                      onClick={() => void toggle(student)}
                      disabled={busyId !== null}
                    >
                      {student.enabled ? '停用' : '启用'}
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </section>
  );
}

export function StudentImport({ onClose, onDone }: { onClose: () => void; onDone: DoneHandler }) {
  const [text, setText] = useState('');
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);

  const runImport = async (chosen: 'merge' | 'replace') => {
    if (!text.trim()) {
      setFormError('先把学生名单粘贴进来');
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      const result = await adminApi.importStudents(text, chosen);
      const parts = ['新增 ' + String(result.added) + ' 人'];
      if (result.updated > 0) parts.push('更新 ' + String(result.updated) + ' 人');
      if (result.skipped > 0) parts.push('跳过 ' + String(result.skipped) + ' 人');
      onDone('名单已导入：' + parts.join('，'));
    } catch (importError) {
      setFormError(mobileError(importError));
    } finally {
      setBusy(false);
    }
  };

  const submit = () => {
    if (!text.trim()) {
      setFormError('先把学生名单粘贴进来');
      return;
    }
    if (mode === 'replace') {
      setConfirmReplace(true);
      return;
    }
    void runImport('merge');
  };

  return (
    <section className="m-subpage">
      <SubpageHeader title="导入名单" onBack={onClose} />
      <main className="m-subpage__main">
        <div className="m-hintcard">
          一行一位学生。支持「01 张小明」这种带学号的写法，也可以只写「张小明」；表头会自动跳过。
        </div>

        <Field label="粘贴名单" counter={text.length > 0 ? text.trim().split(/\r?\n/).filter(Boolean).length + ' 行' : undefined}>
          <textarea
            className="m-textarea m-import-text"
            value={text}
            placeholder={'01 张小明\n02 李小红\n王大力'}
            aria-label="学生名单"
            onChange={(event) => setText(event.target.value)}
          />
        </Field>

        <div className="m-field">
          <span className="m-field__label">导入方式</span>
          <div className="m-segment" role="group" aria-label="导入方式">
            <button
              type="button"
              className="m-segment__option"
              aria-pressed={mode === 'merge'}
              onClick={() => setMode('merge')}
            >
              合并
            </button>
            <button
              type="button"
              className="m-segment__option"
              aria-pressed={mode === 'replace'}
              onClick={() => setMode('replace')}
            >
              替换全部
            </button>
          </div>
          <p className="m-field__hint">
            {mode === 'merge'
              ? '保留现在名单，学号相同的学生会更新姓名。'
              : '先清空现在名单，只保留这次粘贴的学生，操作前会让你再确认。'}
          </p>
        </div>

        {formError ? (
          <p className="m-form-error" role="alert">
            {formError}
          </p>
        ) : null}

        <button type="button" className="m-btn m-btn--primary m-btn--block" onClick={submit} disabled={busy}>
          {busy ? '正在导入' : '导入名单'}
        </button>
        <p className="m-form-foot">名单变化会立刻同步到教室大屏。</p>
      </main>

      <ConfirmDialog
        open={confirmReplace}
        title="替换整份名单？"
        description="现在的学生名单会全部清空，只保留这次粘贴的学生，不能恢复。"
        confirmLabel="替换并导入"
        busy={busy}
        onConfirm={() => void runImport('replace')}
        onCancel={() => setConfirmReplace(false)}
      />
    </section>
  );
}
