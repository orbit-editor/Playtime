import { useRef, useState, type ChangeEvent } from 'react';
import {
  BarChart3,
  CheckCircle2,
  Database,
  Download,
  KeyRound,
  Power,
  QrCode,
  Smartphone,
  Upload,
  Users,
  Wifi,
} from 'lucide-react';
import { adminApi } from '../../../lib/adminApi';
import { Button } from '../../../components/Button';
import { FlowerMark } from '../../../components/FlowerMark';
import { useToast } from '../../../components/Toast';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ErrorState, LoadingState } from '../components/DataState';
import { Field } from '../components/Field';
import { PanelHeader } from '../components/PanelHeader';
import { downloadBlob, errorText, formatBackupFileName, formatDatabaseSize, formatWhen } from '../format';
import { useLoad } from '../useLoad';

export interface DataPanelProps {
  statsTick: number;
  linkBusy: boolean;
  onShowLink: () => void;
  onRestored: () => void;
}

export function DataPanel({ statsTick, linkBusy, onShowLink, onRestored }: DataPanelProps) {
  const toast = useToast();
  const stats = useLoad(() => adminApi.stats(), [statsTick]);
  const data = stats.data;

  const restoreInputRef = useRef<HTMLInputElement | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<File | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [repeatPin, setRepeatPin] = useState('');
  const [pinBusy, setPinBusy] = useState(false);
  const [pinError, setPinError] = useState('');
  const [quitOpen, setQuitOpen] = useState(false);
  const [quitting, setQuitting] = useState(false);
  const [quitDone, setQuitDone] = useState(false);

  const backup = async () => {
    if (backupBusy) return;
    setBackupBusy(true);
    try {
      const blob = await adminApi.backup();
      downloadBlob(blob, formatBackupFileName(new Date()));
      toast.show('备份已保存到电脑', 'success');
      await stats.reload();
    } catch (err) {
      toast.show(errorText(err), 'error');
    } finally {
      setBackupBusy(false);
    }
  };

  const pickRestoreFile = () => {
    restoreInputRef.current?.click();
  };

  const chooseRestoreFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setRestoreTarget(file);
  };

  const restore = async () => {
    if (!restoreTarget || restoring) return;
    setRestoring(true);
    try {
      await adminApi.restore(restoreTarget);
      toast.show('数据已恢复', 'success');
      setRestoreTarget(null);
      await stats.reload();
      onRestored();
    } catch (err) {
      toast.show(errorText(err), 'error');
      setRestoreTarget(null);
    } finally {
      setRestoring(false);
    }
  };

  const savePin = async () => {
    setPinError('');
    if (!/^\d{4}$/.test(newPin)) {
      setPinError('新密码要是 4 位数字');
      return;
    }
    if (newPin !== repeatPin) {
      setPinError('两次输入的新密码不一样');
      return;
    }
    if (pinBusy) return;
    setPinBusy(true);
    try {
      await adminApi.changePIN(newPin);
      toast.show('密码已修改，请记住新密码', 'success');
      setNewPin('');
      setRepeatPin('');
    } catch (err) {
      setPinError(errorText(err));
    } finally {
      setPinBusy(false);
    }
  };

  const quit = async () => {
    if (quitting) return;
    setQuitting(true);
    try {
      await adminApi.quit();
      setQuitOpen(false);
      setQuitDone(true);
      toast.show('可以关掉窗口了', 'success');
    } catch (err) {
      toast.show(errorText(err), 'error');
      setQuitOpen(false);
    } finally {
      setQuitting(false);
    }
  };

  if (quitDone) {
    return (
      <section className="wb-panel wb-panel--quit">
        <div className="wb-quit-done">
          <span className="wb-quit-done__icon" aria-hidden="true">
            <CheckCircle2 size={72} strokeWidth={1.6} />
          </span>
          <h2 className="wb-quit-done__title">可以关掉窗口了</h2>
          <p className="wb-quit-done__text">Playtime 已经安全退出，下次打开时数据都还在。</p>
        </div>
      </section>
    );
  }

  return (
    <section className="wb-panel">
      <PanelHeader title="数据" subtitle="看看运行情况，备份数据，或者生成手机版链接" />

      <div className="wb-panel__body wb-panel__body--data">
        <div className="wb-data-col wb-scroll">
          <div className="wb-card wb-overview-card">
            <div className="wb-card__head">
              <h3 className="wb-card__title">
                <BarChart3 size={22} strokeWidth={2.2} aria-hidden="true" />
                概况
              </h3>
            </div>
            <div className="wb-card__body">
              {!data && stats.loading ? (
                <LoadingState text="正在读取数据…" />
              ) : !data && stats.error ? (
                <ErrorState text={errorText(stats.error)} onRetry={() => void stats.reload()} />
              ) : data ? (
                <>
                  <div className="wb-stat-grid">
                    <div className="wb-stat">
                      <span className="wb-stat__label">
                        <Users size={18} strokeWidth={2.2} aria-hidden="true" />
                        学生数
                      </span>
                      <span className="wb-stat__value">
                        {data.students}
                        <span className="wb-stat__unit">人</span>
                      </span>
                    </div>
                    <div className="wb-stat wb-stat--flower">
                      <span className="wb-stat__label">
                        <FlowerMark size={18} />
                        本周小红花
                      </span>
                      <span className="wb-stat__value">
                        {data.flowers_week}
                        <span className="wb-stat__unit">朵</span>
                      </span>
                    </div>
                    <div className="wb-stat">
                      <span className="wb-stat__label">扩展数</span>
                      <span className="wb-stat__value">
                        {data.plugins}
                        <span className="wb-stat__unit">个</span>
                      </span>
                    </div>
                    <div className="wb-stat">
                      <span className="wb-stat__label">
                        <Database size={18} strokeWidth={2.2} aria-hidden="true" />
                        数据库大小
                      </span>
                      <span className="wb-stat__value">{formatDatabaseSize(data.db_bytes)}</span>
                    </div>
                  </div>
                  <div className="wb-info-row">
                    <span className="wb-info-row__item">
                      版本 <b>v{data.version}</b>
                    </span>
                    <span className="wb-info-row__item">
                      端口 <b>{data.port}</b>
                    </span>
                    <span className="wb-info-row__item">
                      上次备份 <b>{data.backup_at ? formatWhen(data.backup_at) : '还没有备份'}</b>
                    </span>
                  </div>
                  <div className="wb-info-row">
                    <span className="wb-info-row__label">
                      <Wifi size={16} strokeWidth={2.2} aria-hidden="true" />
                      局域网地址
                    </span>
                    {data.lan_urls.length === 0 ? (
                      <span className="wb-info-row__muted">还没有</span>
                    ) : (
                      data.lan_urls.map((url) => (
                        <span className="wb-lan" key={url}>
                          {url}
                        </span>
                      ))
                    )}
                  </div>
                </>
              ) : null}
            </div>
          </div>

          <div className="wb-card wb-backup-card">
            <div className="wb-card__head">
              <h3 className="wb-card__title">
                <Database size={22} strokeWidth={2.2} aria-hidden="true" />
                备份与恢复
              </h3>
            </div>
            <div className="wb-card__body">
              <div className="wb-action-row">
                <span className="wb-action-row__icon" aria-hidden="true">
                  <Download size={24} strokeWidth={2} />
                </span>
                <div className="wb-action-row__copy">
                  <p className="wb-action-row__title">备份数据</p>
                  <p className="wb-action-row__hint">把班级、名单和小红书打包成一个 zip 文件存到电脑上</p>
                </div>
                <Button size="md" icon={Download} onClick={() => void backup()} disabled={backupBusy}>
                  {backupBusy ? '正在备份…' : '备份数据'}
                </Button>
              </div>
              <div className="wb-action-row">
                <span className="wb-action-row__icon" aria-hidden="true">
                  <Upload size={24} strokeWidth={2} />
                </span>
                <div className="wb-action-row__copy">
                  <p className="wb-action-row__title">恢复数据</p>
                  <p className="wb-action-row__hint">用备份文件覆盖现在全部数据</p>
                </div>
                <Button size="md" variant="ghost" icon={Upload} onClick={pickRestoreFile}>
                  选择备份文件
                </Button>
              </div>
              <input
                ref={restoreInputRef}
                className="wb-file-input"
                type="file"
                accept=".zip,application/zip"
                aria-label="选择备份文件"
                onChange={chooseRestoreFile}
              />
              <p className="wb-card__footnote">
                {data?.backup_at ? '上次备份：' + formatWhen(data.backup_at) : '还没有备份过，建议每周备份一次'}
              </p>
            </div>
          </div>

          <div className="wb-card wb-pin-card">
            <div className="wb-card__head">
              <h3 className="wb-card__title">
                <KeyRound size={22} strokeWidth={2.2} aria-hidden="true" />
                修改密码
              </h3>
            </div>
            <div className="wb-card__body">
              <p className="wb-card__footnote">修改后请记住新密码。忘记密码时可以看这台电脑上的说明。</p>
              <div className="wb-pin-grid">
                <Field label="新密码" htmlFor="wb-pin-new">
                  <input
                    id="wb-pin-new"
                    className="wb-input"
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    autoComplete="new-password"
                    placeholder="4 位数字"
                    value={newPin}
                    onChange={(event) => setNewPin(event.target.value.replace(/\D/g, '').slice(0, 4))}
                  />
                </Field>
                <Field label="再输一次" htmlFor="wb-pin-repeat">
                  <input
                    id="wb-pin-repeat"
                    className="wb-input"
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    autoComplete="new-password"
                    placeholder="再输一次新密码"
                    value={repeatPin}
                    onChange={(event) => setRepeatPin(event.target.value.replace(/\D/g, '').slice(0, 4))}
                  />
                </Field>
              </div>
              {pinError ? (
                <p className="wb-inline-error" role="alert">
                  {pinError}
                </p>
              ) : null}
              <Button size="md" icon={KeyRound} onClick={() => void savePin()} disabled={pinBusy}>
                {pinBusy ? '正在修改…' : '修改密码'}
              </Button>
            </div>
          </div>
        </div>

        <div className="wb-data-col">
          <div className="wb-mobile-card">
            <span className="wb-mobile-card__icon" aria-hidden="true">
              <Smartphone size={40} strokeWidth={1.8} />
            </span>
            <h3 className="wb-mobile-card__title">手机版</h3>
            <p className="wb-mobile-card__text">手机和一体机连同一个 Wi-Fi，扫一下二维码就能用手机改名单、发小红花。</p>
            <Button size="lg" icon={QrCode} block onClick={onShowLink} disabled={linkBusy}>
              {linkBusy ? '正在生成链接…' : '生成手机版链接'}
            </Button>
            {data && data.lan_urls.length > 0 ? (
              <div className="wb-mobile-card__lan">
                <span className="wb-mobile-card__lan-label">局域网地址</span>
                {data.lan_urls.map((url) => (
                  <span className="wb-lan" key={url}>
                    {url}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          <div className="wb-card wb-quit-card">
            <div className="wb-card__head">
              <h3 className="wb-card__title">
                <Power size={22} strokeWidth={2.2} aria-hidden="true" />
                退出程序
              </h3>
            </div>
            <div className="wb-card__body">
              <p className="wb-card__footnote">退出后这台电脑上的 Playtime 就停了，可以关掉窗口或安全关机。数据会保留。</p>
              <Button variant="danger" size="md" icon={Power} onClick={() => setQuitOpen(true)}>
                退出程序
              </Button>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={restoreTarget !== null}
        title="恢复数据？"
        message={
          '会用备份里的数据覆盖现在全部数据，现在的班级、名单和小红花记录都会被替换。' +
          (restoreTarget ? '（文件：' + restoreTarget.name + '）' : '')
        }
        confirmLabel="恢复数据"
        busy={restoring}
        onConfirm={() => void restore()}
        onClose={() => {
          if (!restoring) setRestoreTarget(null);
        }}
      />

      <ConfirmDialog
        open={quitOpen}
        title="退出 Playtime？"
        message="退出后这台电脑上的 Playtime 就停了，下次要重新打开。确定现在退出吗？"
        confirmLabel="退出程序"
        busy={quitting}
        onConfirm={() => void quit()}
        onClose={() => {
          if (!quitting) setQuitOpen(false);
        }}
      />
    </section>
  );
}
