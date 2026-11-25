import { mergeRosters, rosterFromRows, type RosterResult } from '@/domain/roster';

export interface SheetRows {
  name: string;
  rows: unknown[][];
}

type SpreadsheetInput = Blob | ArrayBuffer | Uint8Array;

const isCsvName = (name: string) => /\.(csv|txt)$/i.test(name);

/**
 * Read a spreadsheet (.xlsx / .xls / .csv) into rows per sheet. SheetJS is loaded
 * lazily (only when the user actually imports a file).
 */
export async function readSpreadsheet(input: SpreadsheetInput, opts: { fileName?: string } = {}): Promise<SheetRows[]> {
  const XLSX = await import('xlsx');
  const fileName = opts.fileName ?? (typeof File !== 'undefined' && input instanceof File ? input.name : '');
  const bytes = input instanceof Uint8Array ? input : input instanceof ArrayBuffer ? new Uint8Array(input) : new Uint8Array(await input.arrayBuffer());

  const wb = isCsvName(fileName)
    ? XLSX.read(new TextDecoder('utf-8').decode(bytes), { type: 'string', cellDates: true, raw: false })
    : XLSX.read(bytes, { type: 'array', cellDates: true });

  return wb.SheetNames.map((name) => {
    const ws = wb.Sheets[name];
    const rows = ws ? XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, raw: true, blankrows: false }) : [];
    return { name, rows };
  });
}

/**
 * Spreadsheet → roster preview (SPEC 3.1). Each sheet is a class (sheet name = class
 * name) unless it has a "Lớp" column; sheets without any recognizable students are skipped.
 */
export async function rosterFromSpreadsheet(input: SpreadsheetInput, opts: { fileName?: string } = {}): Promise<RosterResult> {
  const sheets = await readSpreadsheet(input, opts);
  const results = sheets.map((s) => rosterFromRows(s.name, s.rows)).filter((r) => r.classes.length > 0);
  // With several sheets, drop header-less sheets whose name is not a class (e.g. "Tổng hợp").
  const useful = results.length > 1 ? results.filter((r) => r.classes.every((c) => c.grade !== null) || r.classes.length > 1) : results;
  return mergeRosters(useful.length ? useful : results);
}
