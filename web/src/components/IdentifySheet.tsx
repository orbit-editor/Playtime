import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Loader2,
  Search,
  X,
} from 'lucide-react';
import { Avatar } from './Avatar';
import { BigKeypad } from './BigKeypad';
import { Button } from './Button';
import { Empty } from './Empty';
import { FlowerMark } from './FlowerMark';
import { Sheet } from './Sheet';
import { apiCalls, toApiError, type ApiError } from '../lib/api';
import { friendlyError } from '../lib/format';
import type { Student } from '../lib/types';

export interface IdentifySheetProps {
  open: boolean;
  onPicked: (student: Student) => void;
  onClose: () => void;
  onRejected?: () => void;
  nextLabel?: string;
}

type Phase = 'input' | 'welcome';

const MAX_INPUT = 18;
const SEARCH_DELAY = 200;
const AUTO_CONFIRM_DELAY = 300;
const WELCOME_CLOSE_DELAY = 2600;

/** 大屏上的认领浮层：大键盘输入，找到自己，进入欢迎状态。 */
export function IdentifySheet({
  open,
  onPicked,
  onClose,
  onRejected,
  nextLabel = '开始玩',
}: IdentifySheetProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Student[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [selected, setSelected] = useState<Student | null>(null);
  const [phase, setPhase] = useState<Phase>('input');

  const onPickRef = useRef(onPicked);
  const onCloseRef = useRef(onClose);
  const onRejectRef = useRef(onRejected);
  const pickedRef = useRef(false);
  const autoBlockedRef = useRef(false);
  const sequenceRef = useRef(0);
  const debounceRef = useRef<number | null>(null);
  const finishTimerRef = useRef<number | null>(null);

  useEffect(() => {
    onPickRef.current = onPicked;
    onCloseRef.current = onClose;
    onRejectRef.current = onRejected;
  });

  const clearFinishTimer = useCallback(() => {
    if (finishTimerRef.current !== null) {
      window.clearTimeout(finishTimerRef.current);
      finishTimerRef.current = null;
    }
  }, []);

  const clearDebounceTimer = useCallback(() => {
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  }, []);

  useEffect(() => {
    clearFinishTimer();
    clearDebounceTimer();
    if (!open) return;
    sequenceRef.current += 1;
    setQuery('');
    setResults([]);
    setSearching(false);
    setError(null);
    setSelected(null);
    setPhase('input');
    pickedRef.current = false;
    autoBlockedRef.current = false;
  }, [open, clearDebounceTimer, clearFinishTimer]);

  useEffect(() => {
    return () => {
      if (finishTimerRef.current !== null) window.clearTimeout(finishTimerRef.current);
      if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
    };
  }, []);

  const search = useCallback(async (raw: string) => {
    const q = raw.trim();
    if (!q) return;
    const sequence = ++sequenceRef.current;
    setSearching(true);
    setError(null);
    try {
      const payload = await apiCalls.identify(q.toLowerCase());
      if (sequence !== sequenceRef.current) return;
      const list = Array.isArray(payload.students) ? payload.students.slice(0, 6) : [];
      setResults(list);
    } catch (reason: unknown) {
      if (sequence !== sequenceRef.current) return;
      setResults([]);
      setError(toApiError(reason));
    } finally {
      if (sequence === sequenceRef.current) setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (!open || phase !== 'input') return;
    sequenceRef.current += 1;
    clearDebounceTimer();
    const q = query.trim();
    if (!q) {
      setResults([]);
      setSearching(false);
      setError(null);
      return;
    }
    debounceRef.current = window.setTimeout(() => {
      debounceRef.current = null;
      void search(q);
    }, SEARCH_DELAY);
    return clearDebounceTimer;
  }, [open, phase, query, search, clearDebounceTimer]);

  const confirmPick = useCallback(
    (student: Student) => {
      if (pickedRef.current) return;
      pickedRef.current = true;
      setSelected(student);
      setPhase('welcome');
      onPickRef.current(student);
      clearFinishTimer();
      finishTimerRef.current = window.setTimeout(
        () => onCloseRef.current(),
        WELCOME_CLOSE_DELAY,
      );
    },
    [clearFinishTimer],
  );

  useEffect(() => {
    if (!open || phase !== 'input' || searching || selected) return;
    if (results.length !== 1) return;
    const only = results[0];
    if (!only || only.duplicate_name || autoBlockedRef.current) return;
    const timer = window.setTimeout(() => confirmPick(only), AUTO_CONFIRM_DELAY);
    return () => window.clearTimeout(timer);
  }, [open, phase, searching, results, selected, confirmPick]);

  const append = useCallback((key: string) => {
    autoBlockedRef.current = false;
    setQuery((current) => (current.length >= MAX_INPUT ? current : current + key.toLowerCase()));
  }, []);

  const backspace = useCallback(() => {
    autoBlockedRef.current = false;
    setQuery((current) => current.slice(0, -1));
  }, []);

  const clearQuery = useCallback(() => {
    autoBlockedRef.current = false;
    setQuery('');
  }, []);

  const flushSearch = useCallback(() => {
    clearDebounceTimer();
    if (query.trim()) void search(query);
  }, [clearDebounceTimer, query, search]);

  useEffect(() => {
    if (!open || phase !== 'input') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      const onButton = target instanceof HTMLElement && target.closest('button') !== null;
      if (event.key === 'Backspace') {
        event.preventDefault();
        backspace();
        return;
      }
      if (event.key === 'Enter') {
        if (onButton) return;
        event.preventDefault();
        flushSearch();
        return;
      }
      if (/^[a-zA-Z0-9]$/.test(event.key)) {
        event.preventDefault();
        append(event.key);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, phase, append, backspace, flushSearch]);

  const finish = useCallback(() => {
    clearFinishTimer();
    onCloseRef.current();
  }, [clearFinishTimer]);

  const reject = useCallback(() => {
    clearFinishTimer();
    pickedRef.current = false;
    autoBlockedRef.current = true;
    setSelected(null);
    setPhase('input');
    onRejectRef.current?.();
  }, [clearFinishTimer]);

  const close = useCallback(() => {
    clearFinishTimer();
    onCloseRef.current();
  }, [clearFinishTimer]);

  const hasDuplicate = results.some((student) => student.duplicate_name);
  const spacedQuery = Array.from(query.toUpperCase()).join(' ');

  return (
    <Sheet
      open={open}
      onClose={close}
      label="认领小红花"
      panelClassName={'identify-panel' + (phase === 'welcome' ? ' identify-panel--welcome' : '')}
    >
      {phase === 'welcome' && selected ? (
        <div className="identify-welcome">
          <button type="button" className="icon-button identify-close" onClick={close} aria-label="关上这页">
            <X size={28} strokeWidth={2.2} aria-hidden="true" />
          </button>
          <span className="identify-welcome__halo" aria-hidden="true">
            <FlowerMark size={104} />
          </span>
          <p className="identify-welcome__eyebrow">找到你啦</p>
          <h2 className="identify-welcome__name">欢迎你，{selected.name}</h2>
          <p className="identify-welcome__sid">学号 {selected.sid}</p>
          <div className="identify-welcome__stats">
            <div className="identify-welcome__stat">
              <span className="identify-welcome__stat-value">{selected.flowers_today}</span>
              <span className="identify-welcome__stat-label">今天</span>
            </div>
            <span className="identify-welcome__stat-divider" aria-hidden="true" />
            <div className="identify-welcome__stat">
              <span className="identify-welcome__stat-value">{selected.flowers_total}</span>
              <span className="identify-welcome__stat-label">一共</span>
            </div>
          </div>
          <Button
            size="lg"
            icon={<ArrowRight size={24} strokeWidth={2.4} />}
            onClick={finish}
            className="identify-welcome__go"
          >
            {nextLabel}
          </Button>
          <button type="button" className="text-button" onClick={reject}>
            不是我
          </button>
          <p className="identify-welcome__note">认领后 5 分钟内，玩游戏不用再输学号</p>
        </div>
      ) : (
        <div className="identify">
          <div className="identify__head">
            <div>
              <p className="identify__eyebrow">小红花认领</p>
              <h2 className="identify__title">你是哪一位同学呀？</h2>
            </div>
            <button type="button" className="icon-button" onClick={close} aria-label="关上这页">
              <X size={28} strokeWidth={2.2} aria-hidden="true" />
            </button>
          </div>

          <div className="identify__input" aria-live="polite">
            {query ? (
              <span className="identify__input-text">{spacedQuery}</span>
            ) : (
              <span className="identify__input-placeholder">输入学号或拼音开头</span>
            )}
            <span className="identify__caret" aria-hidden="true" />
          </div>
          <p className="identify__sub">比如学号 007，或者名字拼音开头的 wxm</p>

          <div className={'identify__results' + (results.length > 0 ? ' identify__results--filled' : '')}>
            {searching ? (
              <div className="identify__status">
                <Loader2 className="spin" size={26} strokeWidth={2.2} aria-hidden="true" />
                正在找，稍等一下
              </div>
            ) : error ? (
              <div className="identify__status identify__status--error">
                <span>{friendlyError(error)}</span>
                <Button variant="ghost" size="sm" onClick={() => void search(query)}>
                  再试一次
                </Button>
              </div>
            ) : query.trim() === '' ? (
              <div className="identify__hint">
                <span className="identify__hint-icon" aria-hidden="true">
                  <Search size={24} strokeWidth={2} />
                </span>
                <p>按下边的字母或数字，输自己的学号，或者名字拼音的开头。</p>
              </div>
            ) : results.length === 0 ? (
              <Empty
                compact
                icon={Search}
                title="没有找到这位同学"
                hint="看看学号有没有输错，也可以问一问老师"
              />
            ) : (
              <>
                <p className="identify__results-hint">
                  {hasDuplicate
                    ? '有几位同学名字一样，看清学号再点哦'
                    : '找到啦，点一下你自己'}
                </p>
                <div className="candidate-grid">
                  {results.map((student) => (
                    <button
                      type="button"
                      key={student.id}
                      className="candidate"
                      data-student-id={student.id}
                      onClick={() => confirmPick(student)}
                    >
                      <Avatar name={student.name} size={50} />
                      <span className="candidate__copy">
                        <span className="candidate__name">
                          {student.name}
                          {student.duplicate_name ? (
                            <span className="candidate__same">同名</span>
                          ) : null}
                        </span>
                        <span className="candidate__sid">学号 {student.sid}</span>
                      </span>
                      <span className="candidate__flowers">
                        <span>
                          <FlowerMark size={14} />
                          今天 {student.flowers_today}
                        </span>
                        <span>一共 {student.flowers_total}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <BigKeypad
            onKey={append}
            onBackspace={backspace}
            onClear={clearQuery}
            onConfirm={flushSearch}
          />
        </div>
      )}
    </Sheet>
  );
}
