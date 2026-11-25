import { expect, test, type Page } from '@playwright/test';

// Seeds IndexedDB directly (the app's Dexie DB "note-nhi") with 21 classes × 40 students,
// marks the TV check as done, then reloads so the app starts on the home screen.
async function seed(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Note Nhí' })).toBeVisible();
  await page.evaluate(async () => {
    const open = () =>
      new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open('note-nhi');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    let idb = await open();
    for (let i = 0; i < 50 && !idb.objectStoreNames.contains('classes'); i++) {
      idb.close();
      await new Promise((r) => setTimeout(r, 100));
      idb = await open();
    }
    const now = Date.now();
    const d = new Date(now);
    const y = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1;
    const owner = crypto.randomUUID();
    const base = () => ({ id: crypto.randomUUID(), ownerId: owner, createdAt: now, updatedAt: now });
    const given = ['An', 'Bảo', 'Chi', 'Châu', 'Duy', 'Dung', 'Dũng', 'Giang', 'Hân', 'Hiếu'];
    const middle = ['Minh', 'Gia', 'Quỳnh', 'Khánh'];
    const tx = idb.transaction(['classes', 'students', 'meta'], 'readwrite');
    const grades: Array<[number, string[]]> = [
      [1, ['A', 'B', 'C', 'D']],
      [2, ['A', 'B', 'C', 'D']],
      [3, ['A', 'B', 'C', 'D']],
      [4, ['A', 'B', 'C', 'D']],
      [5, ['A', 'B', 'C', 'D', 'E']],
    ];
    for (const [g, letters] of grades) {
      for (const l of letters) {
        const cls = { ...base(), name: `${g}${l}`, grade: g, schoolYear: `${y}-${y + 1}`, lastUsedAt: null };
        tx.objectStore('classes').put(cls);
        for (let i = 0; i < 40; i++) {
          const dn = `${middle[i % 4]} ${given[Math.floor(i / 4)]}`;
          tx.objectStore('students').put({
            ...base(),
            classId: cls.id,
            order: i + 1,
            fullName: `Nguyễn ${dn}`,
            displayName: dn,
            archived: false,
          });
        }
      }
    }
    tx.objectStore('meta').put({ key: 'tvCheckDoneAt', value: now });
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    idb.close();
  });
  await page.reload();
}

test('home → attendance (40 names, no scroll) → launcher → game; re-open skips attendance', async ({ page }) => {
  await seed(page);
  await expect(page.getByRole('heading', { name: /vào lớp nào nhỉ/ })).toBeVisible();
  for (const g of [1, 2, 3, 4, 5]) await expect(page.getByText(`Khối ${g}`)).toBeVisible();

  await page.keyboard.type('3a');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Bạn nào vắng hôm nay?' })).toBeVisible();
  const cells = page.locator('#prep-grid .name');
  await expect(cells).toHaveCount(40);
  await expect(page.getByText('Có mặt 40/40')).toBeVisible();
  const noScroll = await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1);
  expect(noScroll).toBe(true);

  await cells.first().click();
  await expect(page.getByText('Có mặt 39/40')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Chơi gì đây ta?' })).toBeVisible();
  await expect(page.getByText(/Có mặt 39\/40/)).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: /vào lớp nào nhỉ/ })).toBeVisible();
  // today's lesson now feeds the history suggestion; Enter with an empty typebox opens it
  await expect(page.getByRole('button', { name: 'Vào lớp gợi ý 3A' })).toBeVisible();
  await expect(page.getByText('Lớp vừa dạy')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Chơi gì đây ta?' })).toBeVisible();
  await expect(page.getByText(/Đã điểm danh lúc \d\d:\d\d · bấm D để sửa/)).toBeVisible();

  await page.keyboard.press('1');
  await expect(page.getByRole('heading', { name: 'Chơi gì đây ta?' })).toBeHidden();
});
