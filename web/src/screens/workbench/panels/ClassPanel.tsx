import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Download,
  Layers,
  School,
  Upload,
  UserCheck,
  UserX,
  Users,
} from 'lucide-react';
import { adminApi, type AdminStudent } from '../../../lib/adminApi';
import { Button } from '../../../components/Button';
import { Empty } from '../../../components/Empty';
import { Sheet } from '../../../components/Sheet';
import { useToast } from '../../../components/Toast';
import { gradeLabel } from '../../../lib/format';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ErrorState, LoadingState } from '../components/DataState';
import { Field } from '../components/Field';
import { PanelHeader } from '../components/PanelHeader';
import { SheetHead } from '../components/SheetHead';
import { downloadBlob, errorText } from '../format';
import { useLoad } from '../useLoad';

const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9];

interface ClassForm {
  name: string;
  grade: number;
  school: string;
}

const EMPTY_FORM: ClassForm = { name: '', grade: 0, school: '' };

export interface ClassPanelProps {
  classTick: number;
  studentTick: number;
  onClassSaved: () => void;
}

export function ClassPanel({ classTick, studentTick, onClassSaved }: ClassPanelProps) {
  const toast = useToast();
  const classInfo = useLoad(() => adminApi.classInfo(), [classTick]);
  const roster = useLoad(() => adminApi.students(), [studentTick]);

  const [form, setForm] = useState<ClassForm>(EMPTY_FORM);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [studentBusy, setStudentBusy] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);

  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [importBusy, setImportBusy] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(false);

  const students = roster.data?.students ?? [];
  const enabledCount = students.filter((student) => student.enabled).length;

  // SSE 刷新时只同步没在编辑的表单，避免把老师正在改的内容冲掉。
  useEffect(() => {
    if (!classInfo.data || dirty) return;
    const current = classInfo.data.class;
    const grade = current.grade >= 1 && current.grade <= 9 ? current.grade : 0;
    setForm({ name: current.name ?? '', grade, school: current.school ?? '' });
  }, [classInfo.data, dirty]);

  const updateField = <K extends keyof ClassForm>(key: K, value: ClassForm[K]) => {
    setDirty(true);
    setForm((current) => ({ ...current, [key]: value }));
  };

  const saveClassInfo = async () => {
    const name = form.name.trim();
    if (name.length === 0) {
      toast.show('先填写班级名称', 'error');
      return;
    }
    if (form.grade < 1 || form.grade > 9) {
      toast.show('先选一下年级', 'error');
      return;
    }
    setSaving(true);
    try {
      await adminApi.saveClass({ name, grade: form.grade, school: form.school.trim() });
      toast.show('班级信息已保存', 'success');
      setDirty(false);
      onClassSaved();
    } catch (err) {
      toast.show(errorText(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleStudent = async (student: AdminStudent) => {
    if (studentBusy !== null) return;
    setStudentBusy(student.id);
    try {
      await adminApi.setStudentEnabled(student.id, !student.enabled);
      toast.show(student.enabled ? '已停用 ' + student.name : '已启用 ' + student.name, 'success');
      await roster.reload();
    } catch (err) {
      toast.show(errorText(err), 'error');
    } finally {
      setStudentBusy(null);
    }
  };

  const exportRoster = async () => {
    setExporting(true);
    try {
      const blob = await adminApi.exportStudentsCSV();
      downloadBlob(blob, '花名册.csv');
      toast.show('花名册已导出', 'success');
    } catch (err) {
      toast.show(errorText(err), 'error');
    } finally {
      setExporting(false);
    }
  };

  const closeImport = () => {
    if (importBusy) return;
    setImportOpen(false);
    setConfirmReplace(false);
  };

  const openImport = () => {
    setImportText('');
    setImportMode('merge');
    setImportOpen(true);
  };

  const runImport = async () => {
    if (importText.trim().length === 0) {
      toast.show('先把名单粘贴进来', 'error');
      return;
    }
    setImportBusy(true);
    try {
      const result = await adminApi.importStudents(importText, importMode);
      toast.show(
        '新增 ' + result.added + ' 人，更新 ' + result.updated + ' 人，跳过 ' + result.skipped + ' 人',
        'success',
      );
      setImportOpen(false);
      setConfirmReplace(false);
      setImportText('');
      setImportMode('merge');
      await roster.reload();
    } catch (err) {
      toast.show(errorText(err), 'error');
      setConfirmReplace(false);
    } finally {
      setImportBusy(false);
    }
  };

  const requestImport = () => {
    if (importMode === 'replace') {
      setConfirmReplace(true);
      return;
    }
    void runImport();
  };

  let classCardBody;
  if (!classInfo.data && classInfo.loading) {
    classCardBody = <LoadingState text="正在加载班级信息…" />;
  } else if (!classInfo.data && classInfo.error) {
    classCardBody = <ErrorState text={errorText(classInfo.error)} onRetry={() => void classInfo.reload()} />;
  } else {
    classCardBody = (
      <>
        <Field label="班级名称" htmlFor="wb-class-name" hint="显示在首页和手机版上">
          <input
            id="wb-class-name"
            className="wb-input"
            value={form.name}
            maxLength={20}
            placeholder="比如：三年级二班"
            onChange={(event) => updateField('name', event.target.value)}
          />
        </Field>
        <Field label="年级" htmlFor="wb-class-grade">
          <select
            id="wb-class-grade"
            className="wb-select"
            value={form.grade}
            onChange={(event) => updateField('grade', Number(event.target.value))}
          >
            {form.grade === 0 ? (
              <option value={0} disabled>
                请选择年级
              </option>
            ) : null}
            {GRADES.map((grade) => (
              <option key={grade} value={grade}>
                {gradeLabel(grade)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="学校名称" htmlFor="wb-class-school" hint="可以留空">
          <input
            id="wb-class-school"
            className="wb-input"
            value={form.school}
            maxLength={30}
            placeholder="比如：阳光小学"
            onChange={(event) => updateField('school', event.target.value)}
          />
        </Field>
        <div className="wb-class-card__foot">
          <Button size="lg" onClick={() => void saveClassInfo()} disabled={saving}>
            {saving ? '正在保存…' : '保存班级信息'}
          </Button>
        </div>
      </>
    );
  }

  let rosterBody;
  if (!roster.data && roster.loading) {
    rosterBody = <LoadingState text="正在加载花名册…" />;
  } else if (!roster.data && roster.error) {
    rosterBody = <ErrorState text={errorText(roster.error)} onRetry={() => void roster.reload()} />;
  } else if (students.length === 0) {
    rosterBody = (
      <Empty
        icon={Users}
        title="还没有学生"
        hint="点右上角的「导入名单」，把全班同学的名单粘进来"
        action={
          <Button size="lg" icon={Upload} onClick={openImport}>
            导入名单
          </Button>
        }
      />
    );
  } else {
    rosterBody = (
      <div className="wb-table-wrap wb-scroll">
        <table className="wb-table">
          <thead>
            <tr>
              <th>学号</th>
              <th>姓名</th>
              <th>拼音</th>
              <th>今天</th>
              <th>现有</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => (
              <tr key={student.id} className={student.enabled ? undefined : 'wb-table__row--off'}>
                <td className="wb-table__sid">{student.sid}</td>
                <td>
                  <span className="wb-student">
                    <span className="wb-student__avatar" aria-hidden="true">
                      {Array.from(student.name.trim())[0] ?? '同'}
                    </span>
                    <span className="wb-student__name">{student.name}</span>
                  </span>
                </td>
                <td className="wb-table__muted">{student.pinyin || '—'}</td>
                <td className="wb-table__num">{student.today}</td>
                <td className="wb-table__num">{student.balance}</td>
                <td>
                  <span className={'wb-status' + (student.enabled ? ' wb-status--on' : ' wb-status--off')}>
                    {student.enabled ? '在用' : '已停用'}
                  </span>
                </td>
                <td>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={student.enabled ? UserX : UserCheck}
                    disabled={studentBusy === student.id}
                    onClick={() => void toggleStudent(student)}
                  >
                    {student.enabled ? '停用' : '启用'}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <section className="wb-panel">
      <PanelHeader
        title="班级"
        subtitle="班级信息和花名册会同步到首页和手机版"
        actions={
          <>
            <Button variant="ghost" size="lg" icon={Download} disabled={exporting} onClick={() => void exportRoster()}>
              {exporting ? '正在导出…' : '导出花名册'}
            </Button>
            <Button size="lg" icon={Upload} onClick={openImport}>
              导入名单
            </Button>
          </>
        }
      />

      <div className="wb-panel__body wb-panel__body--class">
        <div className="wb-card wb-class-card">
          <div className="wb-card__head">
            <h3 className="wb-card__title">
              <School size={22} strokeWidth={2.2} aria-hidden="true" />
              班级信息
            </h3>
          </div>
          <div className="wb-card__body wb-class-card__form">{classCardBody}</div>
        </div>

        <div className="wb-card wb-roster-card">
          <div className="wb-card__head">
            <h3 className="wb-card__title">
              <Users size={22} strokeWidth={2.2} aria-hidden="true" />
              花名册
            </h3>
            <span className="wb-card__hint">
              共 {students.length} 人 · 启用 {enabledCount} 人
            </span>
          </div>
          <div className="wb-card__body">{rosterBody}</div>
        </div>
      </div>

      <Sheet open={importOpen} onClose={closeImport} label="导入名单" panelClassName="wb-sheet wb-sheet--form">
        <SheetHead
          icon={Upload}
          title="导入名单"
          hint="一行一位学生，支持学号加姓名，也支持只写姓名"
          onClose={closeImport}
        />
        <div className="wb-sheet__body">
          <Field
            label="名单内容"
            htmlFor="wb-import-text"
            hint="支持「01 张小明」「张小明」；一行里用逗号分开也可以"
          >
            <textarea
              id="wb-import-text"
              className="wb-textarea wb-textarea--list"
              value={importText}
              placeholder={'01 张小明\n02 李小红\n03 王大力'}
              onChange={(event) => setImportText(event.target.value)}
            />
          </Field>
          <div className="wb-field">
            <span className="wb-label">导入方式</span>
            <div className="wb-segment" role="group" aria-label="导入方式">
              <button
                type="button"
                className={'wb-segment__item' + (importMode === 'merge' ? ' wb-segment__item--active' : '')}
                onClick={() => setImportMode('merge')}
              >
                合并到现有名单
              </button>
              <button
                type="button"
                className={'wb-segment__item' + (importMode === 'replace' ? ' wb-segment__item--active' : '')}
                onClick={() => setImportMode('replace')}
              >
                替换全部名单
              </button>
            </div>
            {importMode === 'replace' ? (
              <p className="wb-warn">
                <AlertTriangle size={18} strokeWidth={2.2} aria-hidden="true" />
                替换会先清空现在的 {students.length} 位学生，再导入新名单
              </p>
            ) : (
              <p className="wb-field__hint">合并会按学号或姓名自动更新，不会清空原来的名单</p>
            )}
          </div>
        </div>
        <div className="wb-sheet__foot">
          <Button variant="ghost" size="lg" onClick={closeImport} disabled={importBusy}>
            取消
          </Button>
          <Button
            size="lg"
            icon={Layers}
            onClick={requestImport}
            disabled={importBusy || importText.trim().length === 0}
          >
            {importBusy ? '正在导入…' : '开始导入'}
          </Button>
        </div>
      </Sheet>

      <ConfirmDialog
        open={confirmReplace}
        title="替换全部名单？"
        message={'现在的 ' + students.length + ' 位学生会被清空，换成新的名单。这个操作不能撤销。'}
        confirmLabel="替换全部名单"
        busy={importBusy}
        onConfirm={() => void runImport()}
        onClose={() => {
          if (!importBusy) setConfirmReplace(false);
        }}
      />
    </section>
  );
}
