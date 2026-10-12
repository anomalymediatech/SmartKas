import * as XLSX from 'xlsx';

export interface ParsedRow {
  [key: string]: string | number;
}

/** Parse .xlsx/.csv file into an array of row objects keyed by the first sheet's headers. */
export async function parseSpreadsheet(file: File): Promise<ParsedRow[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json<Record<string, string | number>>(sheet, { defval: '' });
  return json;
}

/** Download a template .xlsx with the given headers and one example row. */
export function downloadTemplate(filename: string, headers: string[], example: (string | number)[]) {
  const data = [headers, example];
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Template');
  XLSX.writeFile(wb, filename);
}

/** Export laporan stok opname: Nama | (Harga Beli) | Harga Jual | Stok Sistem | Stok Fisik (diisi manual) | Selisih (formula Excel). */
export function exportStockOpname(
  filename: string,
  items: { name: string; stock: number; sell_price: number; buy_price?: number }[]
) {
  const includeBuy = items.some((it) => it.buy_price !== undefined);
  const header = includeBuy
    ? ['Nama', 'Harga Beli', 'Harga Jual', 'Stok Sistem', 'Stok Fisik', 'Selisih']
    : ['Nama', 'Harga Jual', 'Stok Sistem', 'Stok Fisik', 'Selisih'];
  const rows = items.map((it) =>
    includeBuy
      ? ([it.name, it.buy_price ?? '', it.sell_price, it.stock, '', ''] as (string | number)[])
      : ([it.name, it.sell_price, it.stock, '', ''] as (string | number)[])
  );
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  const selisihCol = includeBuy ? 'F' : 'E';
  const fisikCol = includeBuy ? 'E' : 'D';
  const sistemCol = includeBuy ? 'D' : 'C';
  items.forEach((_, i) => {
    const r = i + 2;
    ws[`${selisihCol}${r}`] = { t: 'n', f: `${fisikCol}${r}-${sistemCol}${r}`, v: 0 };
  });
  ws['!cols'] = includeBuy
    ? [{ wch: 42 }, { wch: 13 }, { wch: 13 }, { wch: 13 }, { wch: 13 }, { wch: 10 }]
    : [{ wch: 42 }, { wch: 13 }, { wch: 13 }, { wch: 13 }, { wch: 10 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Stok Opname');
  XLSX.writeFile(wb, filename);
}

/** Case-insensitive, tolerant header lookup (ignores spaces/underscore/dash). */
export function getField(row: ParsedRow, candidates: string[]): string | number {
  const norm = (s: string) => s.toLowerCase().replace(/[\s_\-.]+/g, '');
  for (const key of Object.keys(row)) {
    if (candidates.some((c) => norm(c) === norm(key))) return row[key];
  }
  return '';
}

/**
 * Parse sel angka dari spreadsheet.
 * - `null`  = sel kosong (artinya "jangan diubah")
 * - `NaN`   = tidak bisa dibaca sebagai angka (error validasi)
 * Toleran terhadap format Indonesia: "50.000" -> 50000, "1,5" -> 1.5.
 */
export function parseNumericCell(v: string | number | undefined): number | null {
  if (v === undefined) return null;
  if (typeof v === 'number') return Number.isNaN(v) ? NaN : v;
  const s = v.trim().replace(/\s/g, '');
  if (s === '') return null;
  if (/^-?\d+([.,]\d{3})+$/.test(s)) return Number(s.replace(/[.,]/g, ''));
  if (/^-?\d+,\d+$/.test(s)) return Number(s.replace(',', '.'));
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  return NaN;
}
