import { useEffect, useRef, useState, type DragEvent } from 'react';
import { useAppStore } from '@/app/store';
import { audio } from '@/audio';
import { addTrack, deleteTrack, getTrackBlob, logError, renameTrack, setTrackMood, useTracks } from '@/db';
import type { TrackMetaRow, TrackMood } from '@/domain/schemas';
import { FileDrop } from '@/features/welcome/FileDrop';
import { Button, Eyebrow, Pill, toast } from '@/ui';
import '@/features/classes/admin.css';

const MOODS: readonly { mood: TrackMood; title: string; use: string }[] = [
  { mood: 'calm', title: 'Chậm, nhẹ', use: 'Màn hình chờ' },
  { mood: 'lively', title: 'Vui, nhanh', use: 'Ghế âm nhạc' },
];
const AUDIO_ACCEPT = '.mp3,.m4a,audio/mpeg,audio/mp4,audio/x-m4a';
const TRACK_MIME = 'application/x-lnv-track';
const isAudio = (f: File) => /\.(mp3|m4a)$/i.test(f.name) || f.type.startsWith('audio/');

let persistAsked = false;
/** Ask the browser to keep our storage (music is big). Once per app run. */
function askPersist() {
  if (persistAsked) return;
  persistAsked = true;
  void navigator.storage?.persist?.().catch(() => false);
}

/** Nhạc nền (SPEC 3.8): two big drop zones, one per mood; each track can be renamed, moved, previewed, deleted. */
export function MusicScreen() {
  const go = useAppStore((s) => s.go);
  const tracks = useTracks();
  const [busy, setBusy] = useState<TrackMood | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const player = useRef<{ el: HTMLAudioElement; url: string } | null>(null);

  const stopPreview = () => {
    const p = player.current;
    if (p) {
      p.el.pause();
      URL.revokeObjectURL(p.url);
    }
    player.current = null;
    setPlaying(null);
  };
  useEffect(() => () => stopPreview(), []);

  const preview = async (t: TrackMetaRow) => {
    const wasPlaying = playing === t.id;
    stopPreview();
    if (wasPlaying) return;
    const blob = await getTrackBlob(t.fileId);
    if (!blob) return toast('Không tìm thấy file nhạc này trên máy');
    const url = URL.createObjectURL(blob);
    const el = new Audio(url);
    el.volume = audio.isMuted() ? 0 : audio.getVolume();
    el.onended = stopPreview;
    player.current = { el, url };
    setPlaying(t.id);
    el.play().catch(() => stopPreview());
  };

  const addFiles = async (mood: TrackMood, files: File[]) => {
    const ok = files.filter(isAudio);
    if (!ok.length) return toast('Hãy chọn file nhạc .mp3 hoặc .m4a');
    askPersist();
    setBusy(mood);
    let added = 0;
    for (const file of ok) {
      try {
        await addTrack({ blob: file, filename: file.name, mood, mimeType: file.type || undefined });
        added++;
      } catch (e) {
        void logError({ screen: 'music', message: String(e) });
      }
    }
    setBusy(null);
    const skipped = files.length - added;
    toast(skipped ? `Đã thêm ${added} bài. Bỏ qua ${skipped} file không đọc được` : `Đã thêm ${added} bài`);
  };

  const onColumnDrop = (mood: TrackMood) => (e: DragEvent) => {
    const id = e.dataTransfer.getData(TRACK_MIME);
    if (!id) return;
    e.preventDefault();
    void setTrackMood(id, mood);
  };

  return (
    <section className="screen">
      <div className="screen-head">
        <div>
          <Eyebrow>Nhạc nền</Eyebrow>
          <h1>Nhạc cho tiết học</h1>
        </div>
        <div className="head-actions">
          <Button kbd="Esc" onClick={() => go('home')}>
            Về trang chủ
          </Button>
        </div>
      </div>
      <p className="note">
        Kéo cả loạt file .mp3 / .m4a không lời vào ô của nhóm. Chưa có bài nào thì app tự chơi giai điệu ngũ cung có sẵn.
      </p>

      <div className="admin-grid">
        {MOODS.map(({ mood, title, use }) => {
          const list = tracks?.filter((t) => t.mood === mood) ?? [];
          const other = MOODS.find((m) => m.mood !== mood)!;
          return (
            <div
              key={mood}
              className="field"
              onDragOver={(e) => e.dataTransfer.types.includes(TRACK_MIME) && e.preventDefault()}
              onDrop={onColumnDrop(mood)}
            >
              <FileDrop accept={AUDIO_ACCEPT} multiple onFiles={(f) => void addFiles(mood, f)} disabled={busy !== null} className="admin-drop" aria-label={`Thêm nhạc ${title}`}>
                <strong>{busy === mood ? 'Đang lưu…' : title}</strong>
                <span>
                  {use} · thả file vào đây hoặc bấm để chọn
                </span>
              </FileDrop>
              <div className="admin-row" style={{ border: 0, padding: 0 }}>
                <Pill sun>{list.length} bài</Pill>
                {list.length === 0 && <small className="note">Đang dùng giai điệu có sẵn</small>}
              </div>
              <ul className="admin-list">
                {list.map((t) => (
                  <li
                    key={t.id}
                    className="admin-row"
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData(TRACK_MIME, t.id)}
                  >
                    <Button aria-label={playing === t.id ? `Dừng ${t.title}` : `Nghe thử ${t.title}`} onClick={() => void preview(t)}>
                      {playing === t.id ? '■' : '▶'}
                    </Button>
                    <TitleField track={t} />
                    <Button onClick={() => void setTrackMood(t.id, other.mood)}>→ {other.title}</Button>
                    <DeleteButton
                      label={t.title}
                      onDelete={() => {
                        if (playing === t.id) stopPreview();
                        void deleteTrack(t.id);
                      }}
                    />
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TitleField({ track }: { track: TrackMetaRow }) {
  const [v, setV] = useState(track.title);
  const [prev, setPrev] = useState(track.title);
  if (prev !== track.title) {
    setPrev(track.title);
    setV(track.title);
  }
  const save = () => {
    if (!v.trim() || v === track.title) return setV(track.title);
    void renameTrack(track.id, v).catch(() => setV(track.title));
  };
  return (
    <input
      className="text-input grow"
      aria-label={`Tên bài ${track.title}`}
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => e.key === 'Enter' && save()}
    />
  );
}

function DeleteButton({ label, onDelete }: { label: string; onDelete: () => void }) {
  const [armed, setArmed] = useState(false);
  return (
    <Button aria-label={`Xoá ${label}`} onBlur={() => setArmed(false)} onClick={() => (armed ? onDelete() : setArmed(true))}>
      {armed ? 'Xoá thật?' : '✕'}
    </Button>
  );
}
