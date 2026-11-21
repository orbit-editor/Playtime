import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, KeyRound, Monitor, School } from 'lucide-react';
import { adminApi } from '../../lib/adminApi';
import { gradeLabel } from '../../lib/format';
import type { SchoolClass } from '../../lib/types';
import {
  ErrorBlock,
  Field,
  LoadingBlock,
  SubpageHeader,
  TabHeader,
  mobileError,
  type DoneHandler,
} from './mobileUi';

export function MobileMore({
  classInfo,
  onOpenClassInfo,
  onOpenChangePin,
}: {
  classInfo: SchoolClass | null;
  onOpenClassInfo: () => void;
  onOpenChangePin: () => void;
}) {
  return (
    <section className="m-page">
      <TabHeader title="更多" />

      <section className="m-section">
        <h2 className="m-section__title">账号与班级</h2>
        <div className="m-card m-menu">
          <button type="button" className="m-menu__row" onClick={onOpenClassInfo}>
            <span className="m-menu__icon" aria-hidden="true">
              <School size={20} strokeWidth={2} />
            </span>
            <span className="m-menu__body">
              <span className="m-menu__label">班级信息</span>
              <span className="m-menu__hint">
                {classInfo ? classInfo.name + ' · ' + gradeLabel(classInfo.grade) : '名称、年级和学校'}
              </span>
            </span>
            <ChevronRight className="m-menu__chev" size={20} aria-hidden="true" />
          </button>
          <button type="button" className="m-menu__row" onClick={onOpenChangePin}>
            <span className="m-menu__icon" aria-hidden="true">
              <KeyRound size={20} strokeWidth={2} />
            </span>
            <span className="m-menu__body">
              <span className="m-menu__label">修改密码</span>
              <span className="m-menu__hint">4 位数字，大屏和手机共用</span>
            </span>
            <ChevronRight className="m-menu__chev" size={20} aria-hidden="true" />
          </button>
        </div>
      </section>

      <section className="m-section">
        <h2 className="m-section__title">关于</h2>
        <div className="m-card m-desktop-tip">
          <span className="m-desktop-tip__icon" aria-hidden="true">
            <Monitor size={22} strokeWidth={2} />
          </span>
          <p>想用大屏工作台，请在教室电脑上打开。</p>
        </div>
        <p className="m-meta-line">课间玩一玩 · 老师手机版</p>
      </section>
    </section>
  );
}

export function ChangePinPage({ onClose, onDone }: { onClose: () => void; onDone: DoneHandler }) {
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const save = async () => {
    if (!/^\d{4}$/.test(pin)) {
      setFormError('新密码要是 4 位数字');
      return;
    }
    if (pin !== confirm) {
      setFormError('两次输入的密码不一样');
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      await adminApi.changePIN(pin);
      onDone('密码改好了，请记牢');
    } catch (saveError) {
      setFormError(mobileError(saveError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="m-subpage">
      <SubpageHeader title="修改密码" onBack={onClose} />
      <main className="m-subpage__main">
        <div className="m-hintcard">大屏工作台和手机版共用这个密码，改完两边都生效。</div>

        <Field label="新密码" hint="4 位数字">
          <input
            className="m-input"
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            maxLength={4}
            value={pin}
            placeholder="输入 4 位新密码"
            aria-label="新密码"
            onChange={(event) => setPin(event.target.value.replace(/\D/g, ''))}
          />
        </Field>

        <Field label="再输一次">
          <input
            className="m-input"
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            maxLength={4}
            value={confirm}
            placeholder="再输一次新密码"
            aria-label="确认新密码"
            onChange={(event) => setConfirm(event.target.value.replace(/\D/g, ''))}
          />
        </Field>

        {formError ? (
          <p className="m-form-error" role="alert">
            {formError}
          </p>
        ) : null}

        <button type="button" className="m-btn m-btn--primary m-btn--block" onClick={() => void save()} disabled={busy}>
          {busy ? '正在保存' : '保存新密码'}
        </button>
      </main>
    </section>
  );
}

export function ClassInfoPage({ onClose, onDone }: { onClose: () => void; onDone: DoneHandler }) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [grade, setGrade] = useState(3);
  const [school, setSchool] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await adminApi.classInfo();
      setName(result.class.name);
      setGrade(result.class.grade >= 1 && result.class.grade <= 9 ? result.class.grade : 3);
      setSchool(result.class.school);
    } catch (loadClassError) {
      setLoadError(mobileError(loadClassError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    const nextName = name.trim();
    if (!nextName) {
      setFormError('班级名称不能空着');
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      const nextSchool = school.trim();
      await adminApi.saveClass({ name: nextName, grade, school: nextSchool });
      onDone('班级信息已保存', { name: nextName, grade, school: nextSchool });
    } catch (saveError) {
      setFormError(mobileError(saveError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="m-subpage">
      <SubpageHeader title="班级信息" onBack={onClose} />
      <main className="m-subpage__main">
        {loading ? <LoadingBlock text="正在取班级信息" /> : null}
        {!loading && loadError ? <ErrorBlock message={loadError} onRetry={() => void load()} /> : null}

        {!loading && !loadError ? (
          <>
            <Field label="班级名称">
              <input
                className="m-input"
                value={name}
                maxLength={20}
                placeholder="比如：三年级二班"
                aria-label="班级名称"
                onChange={(event) => setName(event.target.value)}
              />
            </Field>

            <Field label="年级">
              <div className="m-select-wrap">
                <select
                  className="m-select"
                  value={grade}
                  aria-label="年级"
                  onChange={(event) => setGrade(Number(event.target.value))}
                >
                  {Array.from({ length: 9 }, (_, index) => index + 1).map((value) => (
                    <option key={value} value={value}>
                      {gradeLabel(value)}
                    </option>
                  ))}
                </select>
                <ChevronDown className="m-select__chev" size={18} aria-hidden="true" />
              </div>
            </Field>

            <Field label="学校" hint="可以不填">
              <input
                className="m-input"
                value={school}
                maxLength={30}
                placeholder="比如：阳光小学"
                aria-label="学校"
                onChange={(event) => setSchool(event.target.value)}
              />
            </Field>

            {formError ? (
              <p className="m-form-error" role="alert">
                {formError}
              </p>
            ) : null}

            <button
              type="button"
              className="m-btn m-btn--primary m-btn--block"
              onClick={() => void save()}
              disabled={busy}
            >
              {busy ? '正在保存' : '保存班级信息'}
            </button>
          </>
        ) : null}
      </main>
    </section>
  );
}
