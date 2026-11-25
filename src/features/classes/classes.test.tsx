import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { listClasses, listStudents, wipeAll } from '@/db';
import { parseRosterText } from '@/domain/roster';
import { ClassesScreen } from '.';
import { canConfirm, editDraftStudent, previewClass, renameDraftClass } from './preview';

beforeEach(async () => {
  await wipeAll();
});

describe('roster preview helpers', () => {
  it('flags one-word and duplicate names, and fixes them when edited', () => {
    let r = parseRosterText('Lớp 3A\nNguyễn Văn An\nAn\nTrần Thị Bình\nTrần Thị Bình');
    const p = previewClass(r.classes[0]!);
    expect(p.studentIssues.get(1)).toEqual(['Chỉ có 1 chữ']);
    expect(p.studentIssues.get(2)).toEqual(['Tên bị trùng']);
    expect(p.classIssues.some((m) => m.includes('chỉ có 4 bạn'))).toBe(true);
    r = editDraftStudent(r, 0, 1, 'Lê Văn An');
    expect(previewClass(r.classes[0]!).studentIssues.has(1)).toBe(false);
    const [a, b] = previewClass(r.classes[0]!).shown;
    expect(a).not.toBe(b);
  });

  it('blocks confirmation until every class has a name with a grade', () => {
    let r = parseRosterText('Nguyễn Văn An\nTrần Thị Bình');
    expect(canConfirm(r)).toBe(false);
    r = renameDraftClass(r, 0, 'lớp 2b');
    expect(r.classes[0]).toMatchObject({ name: '2B', grade: 2 });
    expect(canConfirm(r)).toBe(true);
  });
});

describe('ClassesScreen', () => {
  it('pastes two classes, previews, edits a name and imports', async () => {
    render(<ClassesScreen />);
    fireEvent.change(screen.getByPlaceholderText(/Lớp 3A/), {
      target: { value: 'Lớp 3A\n1. Nguyễn Văn An\n2. Trần Thị Bình\n3A:\nLớp 4B\nLê Văn Cường\nPhạm Thị Dung' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Xem trước' }));

    expect(await screen.findByText('2 lớp · 4 học sinh')).toBeTruthy();
    expect(screen.getByDisplayValue('3A')).toBeTruthy();
    expect(screen.getByDisplayValue('4B')).toBeTruthy();
    expect(screen.getByText('→ An')).toBeTruthy();

    fireEvent.change(screen.getByDisplayValue('Phạm Thị Dung'), { target: { value: 'Phạm Thị Duyên' } });
    expect(screen.getByText('→ Duyên')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }));

    await waitFor(async () => expect((await listClasses()).map((c) => c.name)).toEqual(['3A', '4B']));
    const fourB = (await listClasses()).find((c) => c.name === '4B')!;
    expect((await listStudents(fourB.id)).map((s) => s.fullName)).toEqual(['Lê Văn Cường', 'Phạm Thị Duyên']);
    expect(await screen.findByText('Khối 4')).toBeTruthy();
  });
});
