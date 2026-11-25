import { useEffect, useState } from 'react';
import { useScreenKeys } from '@/app/keyboard';
import { useAppStore } from '@/app/store';
import { audio } from '@/audio';
import { chooseBackupFolder, isFolderBackupSupported } from '@/features/backup';
import { Button, Eyebrow, Mascot, cx, toast } from '@/ui';
import { FileDrop } from './FileDrop';
import { completeOnboarding, hasBackupFolder, importSetupFile } from './importFlow';
import { promptInstall, useInstallState } from './install';

const INSTALL_HELP = 'Mở menu ⋮ của Chrome/Edge → "Cài đặt Note Nhí" (hoặc bấm biểu tượng cài đặt ở cuối thanh địa chỉ).';

/** Chào mừng (SPEC 3.11): only on a device without data. The teacher drags in the setup package. */
export function WelcomeScreen() {
  const go = useAppStore((s) => s.go);
  const install = useInstallState();
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [folder, setFolder] = useState(false);
  const [installHelp, setInstallHelp] = useState(false);

  useEffect(() => {
    let alive = true;
    void hasBackupFolder().then((has) => alive && setFolder(has));
    return () => {
      alive = false;
    };
  }, []);

  const onFiles = async (files: File[]) => {
    const file = files[0];
    if (!file || busy) return;
    audio.ensure();
    setBusy(true);
    setError(null);
    const res = await importSetupFile(file);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      audio.sfx('boing');
      return;
    }
    setSummary(res.text);
    audio.sfx('tada');
    toast(`Đã nhập gói cài đặt: ${res.text}`);
  };

  const onInstall = async () => {
    const r = await promptInstall();
    if (r === 'unavailable') setInstallHelp(true);
    else if (r === 'accepted') toast('Đã cài app. Lần sau mở bằng biểu tượng trên màn hình nhé');
  };

  const onFolder = async () => {
    if (!isFolderBackupSupported()) {
      toast('Trình duyệt này chưa chọn được thư mục. Hãy dùng Chrome hoặc Edge trên máy tính');
      return;
    }
    const name = await chooseBackupFolder();
    if (name) {
      setFolder(true);
      toast(`App sẽ tự sao lưu vào thư mục "${name}" sau mỗi buổi dạy`);
    }
  };

  const done = async () => {
    if (!summary) return;
    await completeOnboarding();
    go('home');
  };

  useScreenKeys((k) => {
    if (k === 'Enter' && summary) {
      void done();
      return true;
    }
    return false;
  });

  return (
    <section className="screen">
      <div className="screen-head">
        <div className="hero">
          <Mascot mood="wave" size="clamp(110px,12vw,170px)" />
          <div>
            <Eyebrow>Lần đầu mở app</Eyebrow>
            <h1>
              Chào thầy/cô!
              <br />
              Chỉ 3 bước là xong
            </h1>
          </div>
        </div>
      </div>

      {!summary && (
        <FileDrop accept=".zip,application/zip" onFiles={(f) => void onFiles(f)} disabled={busy}>
          <strong>{busy ? 'Đang nhập gói…' : 'Kéo gói cài đặt vào đây'}</strong>
          <span>
            hoặc bấm để chọn file <b>note-nhi-….zip</b> mà người hỗ trợ đã gửi
          </span>
        </FileDrop>
      )}
      {error && (
        <p className="note" role="alert">
          ⚠ {error}
        </p>
      )}

      <div className="steps">
        <div className={cx('step stk', summary && 'done')}>
          <span className="k">1</span>
          <div>
            <strong>Nhập gói cài đặt</strong>
            <small>{summary ?? 'Danh sách lớp, nhạc, thời khoá biểu'}</small>
          </div>
        </div>
        <button type="button" className={cx('step stk', install.installed && 'done')} onClick={() => void onInstall()}>
          <span className="k">2</span>
          <div>
            <strong>Cài app ra màn hình</strong>
            <small>{installHelp && !install.installed ? INSTALL_HELP : 'Lần sau mở bằng biểu tượng trên desktop'}</small>
          </div>
        </button>
        <button type="button" className={cx('step stk', folder && 'done')} onClick={() => void onFolder()}>
          <span className="k">3</span>
          <div>
            <strong>Chọn thư mục sao lưu</strong>
            <small>{folder ? 'Đã chọn. App tự sao lưu sau mỗi buổi dạy' : 'Nên chọn thư mục Google Drive / OneDrive'}</small>
          </div>
        </button>
      </div>

      <div className="row" style={{ justifyContent: 'flex-start' }}>
        <Button primary big kbd="Enter" disabled={!summary} onClick={() => void done()}>
          Xong, vào app
        </Button>
        <Button onClick={() => go('classes')}>Chưa có gói? Tự nhập danh sách</Button>
      </div>
    </section>
  );
}
