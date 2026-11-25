import { gradeFromClassName, normalizeClassName } from './classInfo';
import type { Grade } from './schemas/tables';
import { cleanText, fold, titleCaseIfAllCaps } from './text';

export interface RosterStudent {
  /** Ordinal from the source (sorting only, never shown). */
  order: number;
  fullName: string;
}

export interface RosterClass {
  /** Normalized class name, e.g. "3A". Empty when the paste had no class header. */
  name: string;
  grade: Grade | null;
  students: RosterStudent[];
}

export interface RosterResult {
  classes: RosterClass[];
  /** Human-readable (Vietnamese) warnings for the preview screen. */
  warnings: string[];
}

export type RosterIssue =
  | { kind: 'noName'; className: string }
  | { kind: 'noGrade'; className: string }
  | { kind: 'smallClass'; className: string; size: number }
  | { kind: 'largeClass'; className: string; size: number }
  | { kind: 'oneWord'; className: string; studentIndex: number; fullName: string }
  | { kind: 'duplicate'; className: string; studentIndexes: number[]; fullName: string };

export const MIN_CLASS_SIZE = 15;
export const MAX_CLASS_SIZE = 50;

// ---------------------------------------------------------------------------
// Line classification helpers
// ---------------------------------------------------------------------------

// Checked on lowercased NFC text, not folded: "Tống" is a real family name, "Tổng" is a total row.
const TOTAL_WORDS = /^(tổng|cộng|sĩ số|danh sách|ds|ghi chú|người lập|hiệu trưởng|giáo viên|stt|tt)(?=[\s:.]|$)/u;
const HEADER_WORDS = /^(stt|tt|so tt|ho va ten|ho ten|ho dem|ho va ten dem|ten|ten hoc sinh|lop|ngay sinh|gioi tinh|nam sinh)$/;
const GENDER = /^(nam|nu|trai|gai|m|f)$/;

/** Returns the class name if `line` is a class header ("Lớp 3A", "3A:", "LỚP 3A"). */
export function classHeaderOf(line: string): string | null {
  const s = cleanText(line);
  const f = fold(s);
  let m = /^lop\s*[:.-]?\s*([0-9][0-9a-z/.-]{0,5})\s*:?$/.exec(f);
  if (m) return normalizeClassName(m[1]!);
  m = /^([1-5][a-z][0-9a-z]{0,3})\s*:$/.exec(f);
  if (m) return normalizeClassName(m[1]!);
  m = /^danh sach\b.*\blop\s*([1-5][a-z0-9/.-]{0,5})\s*:?$/.exec(f);
  if (m) return normalizeClassName(m[1]!);
  return null;
}

/** A cell that plausibly is (part of) a person's name. */
function isNameLike(s: string): boolean {
  const f = fold(s);
  if (!f || /\d/.test(f)) return false;
  if (!/\p{L}/u.test(s)) return false;
  if (GENDER.test(f)) return false;
  return true;
}

function cleanName(s: string): string {
  const t = cleanText(s).replace(/^[-–•*·.,;:]+\s*/, '').replace(/[.,;:]+$/, '');
  return titleCaseIfAllCaps(cleanText(t));
}

/**
 * Parse one pasted student line. Handles "Nguyễn Văn An", "12. Nguyễn Văn An",
 * "12) …", "12<TAB>…" and tab-separated rows pasted from Excel (STT, Họ đệm, Tên, ngày sinh…).
 */
export function parseStudentLine(line: string): { order: number | null; fullName: string } | null {
  const raw = line.normalize('NFC');
  if (!cleanText(raw)) return null;

  let order: number | null = null;
  let name: string;

  if (raw.includes('\t')) {
    const cells = raw.split('\t').map(cleanText);
    const firstNonEmpty = cells.find((c) => c !== '');
    if (firstNonEmpty !== undefined && /^\d{1,4}[.)]?$/.test(firstNonEmpty)) order = parseInt(firstNonEmpty, 10);
    // join the first run of consecutive name-like cells (e.g. "Nguyễn Văn" + "An")
    const run: string[] = [];
    for (const c of cells) {
      if (c === '' && run.length === 0) continue;
      if (isNameLike(c)) run.push(c);
      else if (run.length) break;
    }
    name = run.join(' ');
  } else {
    const m = /^\s*(\d{1,4})\s*(?:[.)\]:/-]\s*|\s+)(.*)$/.exec(raw);
    if (m) {
      order = parseInt(m[1]!, 10);
      name = m[2]!;
    } else {
      name = raw;
    }
  }

  const fullName = cleanName(name);
  if (!fullName || !isNameLike(fullName)) return null;
  const f = fold(fullName);
  if (HEADER_WORDS.test(f) || TOTAL_WORDS.test(fullName.toLowerCase())) return null;
  return { order, fullName };
}

// ---------------------------------------------------------------------------
// Text paste
// ---------------------------------------------------------------------------

/**
 * Parse pasted text: one student per line; lines like "Lớp 3A" / "3A:" start a new class.
 * `defaultClassName` names the students that appear before any header.
 */
export function parseRosterText(text: string, defaultClassName = ''): RosterResult {
  const classes: RosterClass[] = [];
  let current: RosterClass | null = null;
  const ensure = (name: string) => {
    const found = classes.find((c) => c.name === name);
    if (found) return found;
    const c: RosterClass = { name, grade: name ? gradeFromClassName(name) : null, students: [] };
    classes.push(c);
    return c;
  };

  for (const line of text.split(/\r\n|\r|\n/)) {
    const header = classHeaderOf(line);
    if (header) {
      current = ensure(header);
      continue;
    }
    const st = parseStudentLine(line);
    if (!st) continue;
    current ??= ensure(defaultClassName ? normalizeClassName(defaultClassName) : '');
    current.students.push({ order: st.order ?? current.students.length + 1, fullName: st.fullName });
  }

  return finalize(classes);
}

// ---------------------------------------------------------------------------
// Spreadsheet rows
// ---------------------------------------------------------------------------

function cellText(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return '';
  if (typeof v === 'string') return cleanText(v);
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return '';
}

interface HeaderInfo {
  row: number;
  full?: number;
  middle?: number;
  given?: number;
  cls?: number;
  stt?: number;
}

function findHeader(rows: unknown[][]): HeaderInfo | null {
  const limit = Math.min(rows.length, 30);
  for (let r = 0; r < limit; r++) {
    const cells = (rows[r] ?? []).map((c) => fold(cellText(c)));
    const h: HeaderInfo = { row: r };
    cells.forEach((c, i) => {
      if (!c) return;
      if (/^ho (va )?ten( hoc sinh| hs)?$/.test(c) || c === 'ten hoc sinh') h.full ??= i;
      else if (/^ho (va )?(ten )?dem$/.test(c) || c === 'ho') h.middle ??= i;
      else if (c === 'ten') h.given ??= i;
      else if (/^lop( hoc)?$/.test(c)) h.cls ??= i;
      else if (/^(stt|tt|so tt|so thu tu)$/.test(c)) h.stt ??= i;
    });
    if (h.full !== undefined || (h.middle !== undefined && h.given !== undefined)) return h;
  }
  return null;
}

/**
 * Build classes from one sheet. Detects the header row ("Họ và tên" / "Họ tên",
 * or "Họ đệm" + "Tên") and an optional "Lớp" column that groups one sheet into
 * many classes. Without a "Lớp" column the sheet name is the class name.
 */
export function rosterFromRows(sheetName: string, rows: unknown[][]): RosterResult {
  const classes: RosterClass[] = [];
  const warnings: string[] = [];
  const sheetClass = normalizeClassName(sheetName);
  const ensure = (name: string) => {
    const found = classes.find((c) => c.name === name);
    if (found) return found;
    const c: RosterClass = { name, grade: name ? gradeFromClassName(name) : null, students: [] };
    classes.push(c);
    return c;
  };

  const header = findHeader(rows);
  if (!header) {
    // Fallback: no header; take the first name-like cell (≥ 2 words) of each row.
    for (const row of rows) {
      const texts = (row ?? []).map(cellText);
      const nameCell = texts.find((t) => isNameLike(t) && t.includes(' '));
      if (!nameCell) continue;
      const st = parseStudentLine(nameCell);
      if (!st) continue;
      const ordCell = texts.find((t) => /^\d{1,4}$/.test(t));
      const c = ensure(sheetClass);
      c.students.push({ order: ordCell ? Number(ordCell) : c.students.length + 1, fullName: st.fullName });
    }
    if (classes.length) warnings.push(`Sheet "${sheetName}": không thấy dòng tiêu đề "Họ và tên", đã đoán cột tên.`);
    const res = finalize(classes);
    return { classes: res.classes, warnings: [...warnings, ...res.warnings] };
  }

  for (let r = header.row + 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const at = (i: number | undefined) => (i === undefined ? '' : cellText(row[i]));
    const rawName = header.full !== undefined ? at(header.full) : `${at(header.middle)} ${at(header.given)}`;
    const st = parseStudentLine(rawName);
    if (!st) continue;
    const clsRaw = at(header.cls);
    const clsName = header.cls !== undefined ? normalizeClassName(clsRaw) : sheetClass;
    if (header.cls !== undefined && !clsName) {
      warnings.push(`Sheet "${sheetName}" dòng ${r + 1}: thiếu tên lớp, đã bỏ qua "${st.fullName}".`);
      continue;
    }
    const c = ensure(clsName);
    const stt = Number(at(header.stt));
    c.students.push({ order: Number.isInteger(stt) && stt > 0 ? stt : c.students.length + 1, fullName: st.fullName });
  }

  const res = finalize(classes);
  return { classes: res.classes, warnings: [...warnings, ...res.warnings] };
}

/** Merge several results (e.g. one per sheet); classes with the same name are concatenated. */
export function mergeRosters(results: readonly RosterResult[]): RosterResult {
  const classes: RosterClass[] = [];
  const extra: string[] = [];
  for (const r of results) {
    extra.push(...r.warnings.filter((w) => !isIssueWarning(w)));
    for (const c of r.classes) {
      const found = classes.find((x) => x.name === c.name);
      if (found) {
        const offset = Math.max(0, ...found.students.map((s) => s.order));
        found.students.push(...c.students.map((s) => ({ ...s, order: s.order + offset })));
      } else {
        classes.push({ ...c, students: c.students.slice() });
      }
    }
  }
  const res = finalize(classes);
  return { classes: res.classes, warnings: [...extra, ...res.warnings] };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** Suspicious items in one class (SPEC 3.1): one-word names, duplicates, odd class size, unknown grade. */
export function rosterIssues(cls: RosterClass): RosterIssue[] {
  const issues: RosterIssue[] = [];
  const className = cls.name;
  if (!cls.name) issues.push({ kind: 'noName', className });
  else if (cls.grade === null) issues.push({ kind: 'noGrade', className });
  const size = cls.students.length;
  if (size < MIN_CLASS_SIZE) issues.push({ kind: 'smallClass', className, size });
  if (size > MAX_CLASS_SIZE) issues.push({ kind: 'largeClass', className, size });
  const byName = new Map<string, number[]>();
  cls.students.forEach((s, i) => {
    if (!s.fullName.includes(' ')) issues.push({ kind: 'oneWord', className, studentIndex: i, fullName: s.fullName });
    const k = fold(s.fullName);
    byName.set(k, [...(byName.get(k) ?? []), i]);
  });
  for (const ix of byName.values()) {
    if (ix.length > 1) issues.push({ kind: 'duplicate', className, studentIndexes: ix, fullName: cls.students[ix[0]!]!.fullName });
  }
  return issues;
}

const ISSUE_PREFIX = '⚠ ';
const isIssueWarning = (w: string) => w.startsWith(ISSUE_PREFIX);

/** Vietnamese message for an issue (for the preview screen). */
export function describeIssue(i: RosterIssue): string {
  const cls = i.className ? `Lớp ${i.className}` : 'Lớp chưa có tên';
  switch (i.kind) {
    case 'noName':
      return `${ISSUE_PREFIX}${cls}: hãy đặt tên lớp (vd 3A).`;
    case 'noGrade':
      return `${ISSUE_PREFIX}${cls}: không suy ra được khối từ tên lớp.`;
    case 'smallClass':
      return `${ISSUE_PREFIX}${cls}: chỉ có ${i.size} bạn (dưới ${MIN_CLASS_SIZE}).`;
    case 'largeClass':
      return `${ISSUE_PREFIX}${cls}: có ${i.size} bạn (trên ${MAX_CLASS_SIZE}).`;
    case 'oneWord':
      return `${ISSUE_PREFIX}${cls}: "${i.fullName}" chỉ có 1 chữ.`;
    case 'duplicate':
      return `${ISSUE_PREFIX}${cls}: tên "${i.fullName}" bị trùng ${i.studentIndexes.length} lần.`;
  }
}

function finalize(classes: RosterClass[]): RosterResult {
  const kept = classes.filter((c) => c.students.length > 0);
  for (const c of kept) c.students.sort((a, b) => a.order - b.order);
  return { classes: kept, warnings: kept.flatMap((c) => rosterIssues(c).map(describeIssue)) };
}
