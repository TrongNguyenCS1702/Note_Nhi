import { useState, type DragEvent } from 'react';
import { useAppStore } from '@/app/store';
import { importRoster, promoteSchoolYear, rosterFromSpreadsheet, useIsFirstRun } from '@/db';
import { parseRosterText, type RosterResult } from '@/domain/roster';
import { FileDrop } from '@/features/welcome/FileDrop';
import { Button, Card, Eyebrow, Overlay, cx, toast } from '@/ui';
import { ClassManager } from './ClassManager';
import { cleanedRoster } from './preview';
import { RosterPreview } from './RosterPreview';
import './admin.css';

const SHEET_ACCEPT = '.xlsx,.xls,.csv,.txt';
const isSheet = (f: File) => /\.(xlsx|xls|csv|txt)$/i.test(f.name);

/** Quản lý lớp & học sinh (SPEC 3.1). Mostly used by the supporter while preparing the package. */
export function ClassesScreen() {
  const go = useAppStore((s) => s.go);
  const firstRun = useIsFirstRun();
  const [draft, setDraft] = useState<RosterResult | null>(null);
  const [text, setText] = useState('');
  const [defaultClass, setDefaultClass] = useState('');
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [promoting, setPromoting] = useState(false);

  const showDraft = (r: RosterResult, source: string) => {
    if (r.classes.length === 0) {
      toast(`Không tìm thấy tên học sinh nào trong ${source}`);
      return;
    }
    setDraft(r);
  };

  const readFiles = async (files: File[]) => {
    const sheets = files.filter(isSheet);
    if (!sheets.length) {
      toast('Hãy thả file Excel (.xlsx, .xls) hoặc .csv');
      return;
    }
    setBusy(true);
    try {
      const results = await Promise.all(sheets.map((f) => rosterFromSpreadsheet(f, { fileName: f.name })));
      const merged: RosterResult = { classes: results.flatMap((r) => r.classes), warnings: results.flatMap((r) => r.warnings) };
      showDraft(merged, 'file');
    } catch {
      toast('Không đọc được file này. Thử lưu lại thành .xlsx hoặc dán danh sách vào ô bên dưới');
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!draft) return;
    setBusy(true);
    try {
      const res = await importRoster(cleanedRoster(draft));
      toast(`Đã lưu ${res.classCount} lớp · ${res.studentCount} học sinh`);
      setDraft(null);
      setText('');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Không lưu được');
    } finally {
      setBusy(false);
    }
  };

  const promote = async () => {
    setPromoting(false);
    try {
      const r = await promoteSchoolYear();
      toast(`Đã tạo ${r.created} lớp cho năm học ${r.toYear}${r.graduated ? ` · ${r.graduated} lớp 5 ra trường` : ''}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Không lên lớp được');
    }
  };

  const onDragOver = (e: DragEvent) => {
    if (![...e.dataTransfer.types].includes('Files')) return;
    e.preventDefault();
    setDragging(true);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void readFiles([...e.dataTransfer.files]);
  };

  return (
    <section
      className={cx('screen', dragging && 'dragging')}
      onDragOver={onDragOver}
      onDragLeave={(e) => e.currentTarget === e.target && setDragging(false)}
      onDrop={onDrop}
    >
      <div className="screen-head">
        <div>
          <Eyebrow>Quản lý lớp</Eyebrow>
          <h1>Danh sách lớp</h1>
        </div>
        <div className="head-actions">
          {firstRun === false && <Button onClick={() => setPromoting(true)}>Lên lớp năm mới</Button>}
          <Button kbd="Esc" onClick={() => go('home')}>
            Về trang chủ
          </Button>
        </div>
      </div>

      {draft ? (
        <RosterPreview draft={draft} onChange={setDraft} onConfirm={() => void confirm()} onCancel={() => setDraft(null)} busy={busy} />
      ) : (
        <div className="admin-grid">
          <FileDrop accept={SHEET_ACCEPT} multiple onFiles={(f) => void readFiles(f)} disabled={busy} className="admin-drop">
            <strong>{busy ? 'Đang đọc file…' : 'Kéo file Excel vào đây'}</strong>
            <span>hoặc bấm để chọn. Mỗi sheet 1 lớp, hoặc 1 sheet có cột "Lớp". Thả vào chỗ nào trên màn này cũng được.</span>
          </FileDrop>
          <div className="panel">
            <label className="field">
              <span className="label">Hoặc dán danh sách</span>
              <textarea
                className="text-input admin-textarea"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={'Lớp 3A\n1. Nguyễn Văn An\n2. Trần Thị Bình\nLớp 3B\n…'}
              />
            </label>
            <p className="note">Mỗi dòng 1 bạn. Dòng "Lớp 3A" hoặc "3A:" bắt đầu lớp mới, dán nhiều lớp một lần được.</p>
            <div className="admin-row" style={{ border: 0, padding: 0 }}>
              <input
                className="text-input grow"
                aria-label="Tên lớp nếu danh sách không có dòng Lớp"
                placeholder="Tên lớp nếu không có dòng “Lớp …” (vd 3A)"
                value={defaultClass}
                onChange={(e) => setDefaultClass(e.target.value)}
              />
              <Button primary disabled={!text.trim()} onClick={() => showDraft(parseRosterText(text, defaultClass), 'đoạn đã dán')}>
                Xem trước
              </Button>
            </div>
          </div>
        </div>
      )}

      {!draft && <ClassManager />}

      {promoting && (
        <Overlay label="Lên lớp năm mới">
          <Card>
            <h2 className="admin-section-title">Lên lớp năm mới?</h2>
            <p className="result-sub">Tạo các lớp năm học mới từ năm nay: 3A → 4A, giữ nguyên học sinh. Khối 5 ra trường. Lớp và lịch sử năm cũ vẫn giữ.</p>
            <div className="row">
              <Button primary big onClick={() => void promote()}>
                Lên lớp
              </Button>
              <Button big onClick={() => setPromoting(false)}>
                Huỷ
              </Button>
            </div>
          </Card>
        </Overlay>
      )}
    </section>
  );
}
