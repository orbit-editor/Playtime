import { useEffect, useState } from 'react';
import { Clock, Loader2, RefreshCw, Smartphone, Wifi } from 'lucide-react';
import type { JoinLink } from '../../lib/adminApi';
import { Button } from '../../components/Button';
import { Sheet } from '../../components/Sheet';
import { SheetHead } from './components/SheetHead';
import { formatCountdown, remainingSeconds } from './format';

export interface LinkSheetProps {
  open: boolean;
  link: JoinLink | null;
  busy: boolean;
  error: string;
  onClose: () => void;
  onRegenerate: () => void;
}

export function LinkSheet({ open, link, busy, error, onClose, onRegenerate }: LinkSheetProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [qrUrl, setQrUrl] = useState('');
  const [qrFailed, setQrFailed] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNowMs(Date.now());
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [open]);

  const targetUrl = link?.url ?? '';

  useEffect(() => {
    if (!open || targetUrl.length === 0) return;
    let alive = true;
    setQrUrl('');
    setQrFailed(false);
    void import('qrcode')
      .then((mod) => mod.toDataURL(targetUrl, { margin: 1, width: 360 }))
      .then((url) => {
        if (alive) setQrUrl(url);
      })
      .catch(() => {
        if (alive) setQrFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [open, targetUrl]);

  const secondsLeft = link ? remainingSeconds(link.expires_at, nowMs) : 0;
  const expired = link !== null && secondsLeft <= 0;

  let qrBody;
  if (qrUrl.length > 0) {
    qrBody = <img className="wb-link__img" src={qrUrl} alt="手机版链接二维码" width={280} height={280} />;
  } else if (qrFailed) {
    qrBody = (
      <div className="wb-link__fallback">
        <p>二维码没画出来</p>
        <p className="wb-link__fallback-hint">可以直接把下面的网址发给自己</p>
      </div>
    );
  } else {
    qrBody = (
      <span className="wb-link__loading">
        <Loader2 className="wb-spin" size={34} strokeWidth={2.2} aria-hidden="true" />
        正在生成二维码…
      </span>
    );
  }

  return (
    <Sheet open={open} onClose={onClose} label="手机版链接" panelClassName="wb-sheet wb-link-sheet">
      <SheetHead
        icon={Smartphone}
        title="手机版"
        hint="手机和一体机连同一个 Wi-Fi，扫码就能改"
        onClose={onClose}
      />

      <div className="wb-link__body wb-scroll">
        <div className="wb-link__figure">
          <div className="wb-link__qr" aria-live="polite">
            {qrBody}
            {busy ? (
              <span className="wb-link__overlay">
                <Loader2 className="wb-spin" size={30} strokeWidth={2.2} aria-hidden="true" />
                正在重新生成…
              </span>
            ) : expired ? (
              <span className="wb-link__overlay">
                <Clock size={30} strokeWidth={2} aria-hidden="true" />
                链接已失效
              </span>
            ) : null}
          </div>

          {link ? (
            <p className={'wb-link__timer' + (expired ? ' wb-link__timer--expired' : '')}>
              <Clock size={18} strokeWidth={2.2} aria-hidden="true" />
              {expired ? '链接已失效，请重新生成' : '还有 ' + formatCountdown(secondsLeft) + ' 失效'}
            </p>
          ) : null}

          {error ? (
            <p className="wb-inline-error" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div className="wb-link__copy">
          <h3 className="wb-link__subtitle">在手机上打开这个网址</h3>
          {link ? (
            <>
              <p className="wb-link__url">{link.url}</p>
              <div className="wb-link__lan">
                <span className="wb-link__lan-label">
                  <Wifi size={18} strokeWidth={2.2} aria-hidden="true" />
                  局域网地址
                </span>
                {link.lan_urls.map((url) => (
                  <span className="wb-lan" key={url}>
                    {url}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <p className="wb-link__url">还没有生成链接。</p>
          )}
          <p className="wb-link__hint">
            手机和一体机连同一个 Wi-Fi，扫码就能改。链接有有效期，过期后点「重新生成」就好。
          </p>
        </div>
      </div>

      <div className="wb-sheet__foot">
        <span className="wb-link__foot-hint">老师用手机也能登录工作台</span>
        <div className="wb-sheet__foot-actions">
          <Button variant="ghost" size="lg" onClick={onClose}>
            关闭
          </Button>
          <Button size="lg" icon={RefreshCw} onClick={onRegenerate} disabled={busy}>
            {busy ? '正在生成…' : '重新生成'}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
