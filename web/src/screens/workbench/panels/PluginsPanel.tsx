import { useRef, useState, type ChangeEvent } from 'react';
import {
  Archive,
  BookOpen,
  Calculator,
  Check,
  Gamepad2,
  Music,
  PackageOpen,
  Palette,
  Puzzle,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
  WifiOff,
  type LucideIcon,
} from 'lucide-react';
import { adminApi, type AdminPlugin, type CatalogEntry } from '../../../lib/adminApi';
import { Button } from '../../../components/Button';
import { Empty } from '../../../components/Empty';
import { Sheet } from '../../../components/Sheet';
import { useToast } from '../../../components/Toast';
import { ErrorState, LoadingState } from '../components/DataState';
import { PanelHeader } from '../components/PanelHeader';
import { Toggle } from '../components/Toggle';
import { errorText } from '../format';
import { useLoad } from '../useLoad';

const PLUGIN_ICONS: Record<string, LucideIcon> = {
  calculator: Calculator,
  gamepad: Gamepad2,
  gamepad2: Gamepad2,
  music: Music,
  palette: Palette,
  book: BookOpen,
  bookopen: BookOpen,
  sparkles: Sparkles,
  puzzle: Puzzle,
  archive: Archive,
};

function pluginIcon(name?: string): LucideIcon {
  if (!name) return Puzzle;
  return PLUGIN_ICONS[name.toLowerCase()] ?? Puzzle;
}

export function PluginsPanel({ tick }: { tick: number }) {
  const toast = useToast();
  const plugins = useLoad(() => adminApi.plugins(), [tick]);
  const [catalogForce, setCatalogForce] = useState(0);
  const catalog = useLoad(() => adminApi.catalog(catalogForce > 0), [tick, catalogForce]);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [installing, setInstalling] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [uninstallTarget, setUninstallTarget] = useState<AdminPlugin | null>(null);
  const [uninstalling, setUninstalling] = useState(false);
  const [uploading, setUploading] = useState(false);

  const installed = plugins.data?.plugins ?? [];
  const catalogEntries = catalog.data?.plugins ?? [];
  const catalogError = catalog.data?.error;
  const catalogLoading = catalog.loading;

  const refreshCatalog = () => {
    setCatalogForce((current) => current + 1);
  };

  const refreshAll = async () => {
    await plugins.reload();
    setCatalogForce((current) => current + 1);
  };

  const install = async (entry: CatalogEntry) => {
    if (installing !== null) return;
    setInstalling(entry.id);
    try {
      const result = await adminApi.installPlugin(entry.id);
      toast.show(result.message && result.message.trim().length > 0 ? result.message : '已安装「' + entry.name + '」', 'success');
      await refreshAll();
    } catch (err) {
      toast.show(errorText(err), 'error');
    } finally {
      setInstalling(null);
    }
  };

  const togglePlugin = async (plugin: AdminPlugin) => {
    if (plugin.builtin) {
      toast.show('内置扩展不能停用', 'info');
      return;
    }
    if (toggling !== null) return;
    setToggling(plugin.id);
    try {
      await adminApi.togglePlugin(plugin.id, plugin.enabled === false);
      toast.show(plugin.enabled === false ? '已启用「' + plugin.name + '」' : '已停用「' + plugin.name + '」', 'success');
      await plugins.reload();
    } catch (err) {
      toast.show(errorText(err), 'error');
    } finally {
      setToggling(null);
    }
  };

  const requestUninstall = (plugin: AdminPlugin) => {
    if (plugin.builtin) {
      toast.show('内置扩展不能卸载', 'info');
      return;
    }
    setUninstallTarget(plugin);
  };

  const uninstall = async () => {
    if (!uninstallTarget) return;
    setUninstalling(true);
    try {
      await adminApi.uninstallPlugin(uninstallTarget.id);
      toast.show('已卸载「' + uninstallTarget.name + '」', 'success');
      setUninstallTarget(null);
      await refreshAll();
    } catch (err) {
      toast.show(errorText(err), 'error');
    } finally {
      setUninstalling(false);
    }
  };

  const pickFile = () => {
    fileRef.current?.click();
  };

  const uploadFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const result = await adminApi.uploadPlugin(file);
      toast.show(result.message && result.message.trim().length > 0 ? result.message : '扩展已安装', 'success');
      await refreshAll();
    } catch (err) {
      toast.show(errorText(err), 'error');
    } finally {
      setUploading(false);
    }
  };

  let installedBody;
  if (!plugins.data && plugins.loading) {
    installedBody = <LoadingState text="正在加载已安装扩展…" />;
  } else if (!plugins.data && plugins.error) {
    installedBody = <ErrorState text={errorText(plugins.error)} onRetry={() => void plugins.reload()} />;
  } else if (installed.length === 0) {
    installedBody = (
      <Empty
        icon={PackageOpen}
        title="还没有安装扩展"
        hint="从下面的在线清单或文件里安装一个课堂小游戏"
        compact
      />
    );
  } else {
    installedBody = (
      <div className="wb-plugin-list wb-scroll">
        {installed.map((plugin) => {
          const Icon = pluginIcon(plugin.icon ?? plugin.id);
          const enabled = plugin.enabled !== false;
          return (
            <div className={'wb-plugin-row' + (enabled ? '' : ' wb-plugin-row--off')} key={plugin.id}>
              <span className="wb-plugin-row__icon" aria-hidden="true">
                <Icon size={26} strokeWidth={2} />
              </span>
              <div className="wb-plugin-row__copy">
                <p className="wb-plugin-row__line">
                  <span className="wb-plugin-row__name">{plugin.name}</span>
                  <span className="wb-plugin-row__version">v{plugin.version}</span>
                  <span className={'wb-badge ' + (plugin.builtin ? 'wb-badge--soft' : 'wb-badge--ok')}>
                    {plugin.builtin ? '内置' : '安装'}
                  </span>
                </p>
                <p className="wb-plugin-row__desc">{plugin.description}</p>
              </div>
              <div className="wb-plugin-row__actions">
                <span className="wb-inline-toggle">
                  <Toggle
                    checked={enabled}
                    label={(enabled ? '停用' : '启用') + '扩展' + plugin.name}
                    disabled={toggling === plugin.id}
                    onChange={() => void togglePlugin(plugin)}
                  />
                  <span>{enabled ? '启用' : '停用'}</span>
                </span>
                <Button size="sm" variant="ghost" icon={Trash2} onClick={() => requestUninstall(plugin)}>
                  卸载
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  let catalogBody;
  if (!catalog.data && catalog.loading) {
    catalogBody = <LoadingState text="正在加载在线清单…" />;
  } else if (!catalog.data && catalog.error) {
    catalogBody = <ErrorState text={errorText(catalog.error)} onRetry={() => void catalog.reload()} />;
  } else if (catalogError) {
    catalogBody = (
      <div className="wb-offline">
        <span className="wb-offline__icon" aria-hidden="true">
          <WifiOff size={40} strokeWidth={1.8} />
        </span>
        <p className="wb-offline__text">现在连不上扩展清单，检查一下网络</p>
        <p className="wb-offline__hint">可以点上面的「刷新清单」再试一次，或者从文件安装</p>
        <Button variant="ghost" size="md" icon={RefreshCw} onClick={refreshCatalog} disabled={catalogLoading}>
          再试一次
        </Button>
      </div>
    );
  } else if (catalogEntries.length === 0) {
    catalogBody = <Empty icon={Puzzle} title="在线清单是空的" hint="等有新的课堂扩展上架后，再点「刷新清单」看看" compact />;
  } else {
    catalogBody = (
      <div className="wb-plugin-list wb-scroll">
        {catalogEntries.map((entry) => {
          const Icon = pluginIcon(entry.icon ?? entry.id);
          return (
            <div className="wb-plugin-row" key={entry.id}>
              <span className="wb-plugin-row__icon" aria-hidden="true">
                <Icon size={26} strokeWidth={2} />
              </span>
              <div className="wb-plugin-row__copy">
                <p className="wb-plugin-row__line">
                  <span className="wb-plugin-row__name">{entry.name}</span>
                  <span className="wb-plugin-row__source">作者 {entry.author || '未知'}</span>
                </p>
                <p className="wb-plugin-row__desc">{entry.description || '还没有简介'}</p>
              </div>
              <div className="wb-plugin-row__actions">
                {entry.installed ? (
                  <span className="wb-badge wb-badge--ok">
                    <Check size={14} strokeWidth={2.4} aria-hidden="true" />
                    已安装
                  </span>
                ) : (
                  <Button size="sm" icon={PackageOpen} disabled={installing === entry.id} onClick={() => void install(entry)}>
                    {installing === entry.id ? '正在安装…' : '安装'}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <section className="wb-panel">
      <PanelHeader
        title="扩展"
        subtitle="课堂小游戏和工具。装上以后，首页会出现新的卡片"
        actions={
          <>
            <Button variant="ghost" size="lg" icon={Upload} onClick={pickFile} disabled={uploading}>
              {uploading ? '正在安装…' : '从文件安装'}
            </Button>
            <input
              ref={fileRef}
              className="wb-file-input"
              type="file"
              accept=".zip,application/zip"
              aria-label="选择扩展文件"
              onChange={(event) => void uploadFile(event)}
            />
          </>
        }
      />

      <div className="wb-panel__body wb-panel__body--plugins">
        <div className="wb-card wb-installed-card">
          <div className="wb-card__head">
            <h3 className="wb-card__title">
              <PackageOpen size={22} strokeWidth={2.2} aria-hidden="true" />
              已安装
            </h3>
            <span className="wb-card__hint">共 {installed.length} 个</span>
          </div>
          <div className="wb-card__body">{installedBody}</div>
        </div>

        <div className="wb-card wb-catalog-card">
          <div className="wb-card__head">
            <h3 className="wb-card__title">
              <Puzzle size={22} strokeWidth={2.2} aria-hidden="true" />
              在线清单
            </h3>
            <Button variant="ghost" size="sm" icon={RefreshCw} onClick={refreshCatalog} disabled={catalogLoading}>
              {catalogLoading ? '正在刷新…' : '刷新清单'}
            </Button>
          </div>
          <div className="wb-card__body">{catalogBody}</div>
        </div>
      </div>

      <Sheet
        open={uninstallTarget !== null}
        onClose={() => {
          if (!uninstalling) setUninstallTarget(null);
        }}
        label="卸载扩展"
        panelClassName="wb-sheet wb-sheet--confirm"
      >
        <div className="wb-confirm">
          <span className="wb-confirm__icon wb-confirm__icon--danger" aria-hidden="true">
            <Trash2 size={34} strokeWidth={2} />
          </span>
          <h2 className="wb-confirm__title">卸载「{uninstallTarget?.name ?? ''}」？</h2>
          <p className="wb-confirm__text">卸载后首页的卡片会消失，学生就看不到这个扩展了。以后还可以重新安装。</p>
          <div className="wb-confirm__actions">
            <Button variant="ghost" size="lg" onClick={() => setUninstallTarget(null)} disabled={uninstalling}>
              取消
            </Button>
            <Button variant="danger" size="lg" icon={Trash2} onClick={() => void uninstall()} disabled={uninstalling}>
              {uninstalling ? '正在卸载…' : '卸载扩展'}
            </Button>
          </div>
        </div>
      </Sheet>
    </section>
  );
}
