import type { RosterResult } from '@/domain/roster';
import { Button, Pill, cx } from '@/ui';
import { draftTotals, editDraftStudent, previewClass, removeDraftClass, removeDraftStudent, renameDraftClass, canConfirm } from './preview';

export interface RosterPreviewProps {
  draft: RosterResult;
  onChange: (next: RosterResult) => void;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}

/** "Màn xem trước": every class with its size, display names and suspicious rows, all editable. */
export function RosterPreview({ draft, onChange, onConfirm, onCancel, busy }: RosterPreviewProps) {
  const totals = draftTotals(draft);
  const ok = canConfirm(draft);
  return (
    <div className="panel" aria-label="Xem trước danh sách">
      <div className="screen-head">
        <div>
          <span className="label">Xem trước</span>
          <div className="admin-section-title">
            {totals.classes} lớp · {totals.students} học sinh
          </div>
        </div>
        <div className="head-actions">
          <Button onClick={onCancel}>Huỷ</Button>
          <Button primary big disabled={!ok || busy} onClick={onConfirm}>
            Xác nhận
          </Button>
        </div>
      </div>
      {!ok && <p className="admin-warn">Có lớp chưa có tên hoặc tên lớp không rõ khối (vd 3A). Sửa tên lớp rồi bấm Xác nhận.</p>}
      {draft.warnings.filter((w) => !w.startsWith('⚠')).map((w) => (
        <p key={w} className="note">
          {w}
        </p>
      ))}

      <div className="admin-grid">
        {draft.classes.map((c, ci) => {
          const p = previewClass(c);
          return (
            <section key={ci} className="panel" aria-label={`Lớp ${c.name || 'chưa có tên'}`}>
              <div className="admin-row" style={{ border: 0, padding: 0 }}>
                <label className="field grow">
                  <span className="label">Tên lớp</span>
                  <input
                    className="text-input"
                    value={c.name}
                    placeholder="vd 3A"
                    onChange={(e) => onChange(renameDraftClass(draft, ci, e.target.value))}
                  />
                </label>
                <Pill sun>{c.students.length} bạn</Pill>
                <Button onClick={() => onChange(removeDraftClass(draft, ci))}>Bỏ lớp này</Button>
              </div>
              {p.classIssues.map((m) => (
                <p key={m} className="admin-warn">
                  {m}
                </p>
              ))}
              <ol className="admin-list">
                {c.students.map((s, si) => {
                  const issues = p.studentIssues.get(si);
                  return (
                    <li key={si} className={cx('admin-row', issues && 'warn')}>
                      <input
                        className="text-input grow"
                        aria-label={`Họ tên học sinh ${si + 1}`}
                        value={s.fullName}
                        onChange={(e) => onChange(editDraftStudent(draft, ci, si, e.target.value))}
                      />
                      <small title="Tên hiện trên màn hình">→ {p.shown[si]}</small>
                      {issues && <small>⚠ {issues.join(', ')}</small>}
                      <Button aria-label={`Bỏ ${s.fullName}`} onClick={() => onChange(removeDraftStudent(draft, ci, si))}>
                        ✕
                      </Button>
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })}
      </div>
    </div>
  );
}
