import { useState } from 'react';
import {
  addStudent,
  deleteClass,
  renameClass,
  renameStudent,
  setStudentArchived,
  updateStudent,
  useClassesByGrade,
  useStudents,
  type ClassWithCount,
} from '@/db';
import { Button, cx, toast } from '@/ui';

const fail = (e: unknown) => toast(e instanceof Error ? e.message : 'Không lưu được');

/** Existing classes grouped by grade; pick one to edit it and its students. */
export function ClassManager() {
  const groups = useClassesByGrade();
  const [selected, setSelected] = useState<string | null>(null);
  const all = groups?.flatMap((g) => g.classes) ?? [];
  const current = all.find((c) => c.id === selected) ?? null;

  if (groups && all.length === 0) {
    return <p className="note">Chưa có lớp nào. Kéo file Excel vào hoặc dán danh sách ở trên.</p>;
  }

  return (
    <div className="admin-grid">
      <div className="panel">
        <span className="label">Các lớp năm học {all[0]?.schoolYear ?? ''}</span>
        {groups
          ?.filter((g) => g.classes.length > 0)
          .map((g) => (
            <div key={g.grade} className="field">
              <span className="label">Khối {g.grade}</span>
              <div className="admin-chips">
                {g.classes.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="btn"
                    aria-pressed={c.id === selected}
                    onClick={() => setSelected(c.id === selected ? null : c.id)}
                  >
                    {c.name} <small>· {c.studentCount}</small>
                  </button>
                ))}
              </div>
            </div>
          ))}
      </div>
      {current ? <ClassEditor key={current.id} cls={current} onDeleted={() => setSelected(null)} /> : null}
    </div>
  );
}

function ClassEditor({ cls, onDeleted }: { cls: ClassWithCount; onDeleted: () => void }) {
  const students = useStudents(cls.id, { includeArchived: true });
  const [name, setName] = useState(cls.name);
  const [newStudent, setNewStudent] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const saveName = async () => {
    if (!name.trim() || name.trim() === cls.name) return;
    try {
      const c = await renameClass(cls.id, name);
      setName(c.name);
      toast(`Đã đổi tên thành ${c.name}`);
    } catch (e) {
      fail(e);
    }
  };

  const add = async () => {
    if (!newStudent.trim()) return;
    try {
      await addStudent(cls.id, newStudent);
      setNewStudent('');
    } catch (e) {
      fail(e);
    }
  };

  const remove = async () => {
    if (!confirmDelete) return setConfirmDelete(true);
    await deleteClass(cls.id);
    toast(`Đã xoá lớp ${cls.name}`);
    onDeleted();
  };

  return (
    <div className="panel" aria-label={`Lớp ${cls.name}`}>
      <div className="admin-row" style={{ border: 0, padding: 0 }}>
        <label className="field grow">
          <span className="label">Tên lớp</span>
          <input
            className="text-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => void saveName()}
            onKeyDown={(e) => e.key === 'Enter' && void saveName()}
          />
        </label>
        <Button onClick={() => void remove()} onBlur={() => setConfirmDelete(false)}>
          {confirmDelete ? 'Bấm lần nữa để xoá lớp' : 'Xoá lớp'}
        </Button>
      </div>

      <div className="admin-row" style={{ border: 0, padding: 0 }}>
        <input
          className="text-input grow"
          placeholder="Họ tên học sinh mới"
          aria-label="Họ tên học sinh mới"
          value={newStudent}
          onChange={(e) => setNewStudent(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void add()}
        />
        <Button primary onClick={() => void add()}>
          Thêm
        </Button>
      </div>

      <p className="note">Sửa tên hiện trên màn hình ở ô bên trái. Bạn chuyển lớp / nghỉ học thì bấm "Lưu trữ" để giữ lịch sử.</p>
      <ol className="admin-list">
        {students?.map((s) => (
          <li key={s.id} className={cx('admin-row', s.archived && 'muted')}>
            <StudentField value={s.displayName} label={`Tên hiển thị của ${s.fullName}`} onSave={(v) => renameStudent(s.id, v)} />
            <StudentField value={s.fullName} label={`Họ tên của ${s.fullName}`} onSave={(v) => updateStudent(s.id, { fullName: v })} />
            <Button onClick={() => void setStudentArchived(s.id, !s.archived).catch(fail)}>{s.archived ? 'Bỏ lưu trữ' : 'Lưu trữ'}</Button>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Text input that saves on blur / Enter when changed. */
function StudentField({ value, label, onSave }: { value: string; label: string; onSave: (v: string) => Promise<unknown> }) {
  const [v, setV] = useState(value);
  const [prev, setPrev] = useState(value);
  if (value !== prev) {
    // value changed from the database (e.g. display names recomputed)
    setPrev(value);
    setV(value);
  }
  const save = () => {
    if (!v.trim() || v === value) return setV(value);
    onSave(v).catch((e: unknown) => {
      setV(value);
      fail(e);
    });
  };
  return (
    <input
      className="text-input grow"
      aria-label={label}
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => e.key === 'Enter' && save()}
    />
  );
}
