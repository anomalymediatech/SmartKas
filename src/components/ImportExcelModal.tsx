import { useState } from 'react';
import { X, Upload, Download } from 'lucide-react';
import { Button } from '@/components/ui';
import { parseSpreadsheet, downloadTemplate, getField, parseNumericCell, type ParsedRow } from '@/utils/excel';
import { useToast } from '@/hooks/useToast';

const NUMERIC_KEYS = ['buy_price', 'sell_price', 'price', 'stock'];

export interface ImportColumn {
  key: string; // canonical field name
  label: string; // display label
  candidates: string[]; // accepted header names
  required?: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  templateFilename: string;
  columns: ImportColumn[];
  exampleRow: (string | number)[];
  onImport: (rows: { name: string; [k: string]: string | number | null }[]) => Promise<[number, number]>;
}

export function ImportExcelModal({ open, onClose, title, templateFilename, columns, exampleRow, onImport }: Props) {
  const [rows, setRows] = useState<{ values: Record<string, string | number>; valid: boolean; errors: string[] }[]>([]);
  const [importing, setImporting] = useState(false);
  const { success, error } = useToast();

  if (!open) return null;

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = await parseSpreadsheet(file);
      const mapped = parsed.map((row: ParsedRow) => {
        const values: Record<string, string | number> = {};
        const errors: string[] = [];
        for (const col of columns) {
          const v = getField(row, col.candidates);
          values[col.key] = v;
          if (col.required && (v === '' || v === undefined)) errors.push(`${col.label} wajib diisi`);
          if (NUMERIC_KEYS.includes(col.key) && v !== '' && v !== undefined) {
            const n = parseNumericCell(v);
            if (n === null || Number.isNaN(n)) errors.push(`${col.label} harus angka`);
            else if (col.key === 'stock' && !Number.isInteger(n)) errors.push(`${col.label} harus bilangan bulat`);
          }
        }
        return { values, valid: errors.length === 0, errors };
      });
      setRows(mapped);
    } catch {
      error('Gagal', 'File tidak bisa dibaca. Pastikan format .xlsx atau .csv');
      setRows([]);
    }
  };

  const validRows = rows.filter((r) => r.valid);

  const handleImport = async () => {
    setImporting(true);
    try {
      const items = validRows.map((r) => {
        const obj: { name: string; [k: string]: string | number | null } = { name: String(r.values.name).trim() };
        for (const col of columns) {
          if (col.key === 'name') continue;
          if (NUMERIC_KEYS.includes(col.key)) {
            const n = parseNumericCell(r.values[col.key]);
            obj[col.key] = n === null || Number.isNaN(n) ? null : n;
          } else {
            obj[col.key] = String(r.values[col.key] ?? '');
          }
        }
        return obj;
      });
      const [inserted, updated] = await onImport(items);
      success('Berhasil', `${inserted} baru, ${updated} diperbarui`);
      setRows([]);
      onClose();
    } catch (e) {
      error('Gagal Import', e instanceof Error ? e.message : String(e));
    } finally {
      setImporting(false);
    }
  };

  const reset = () => {
    setRows([]);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 overflow-y-auto py-8" onClick={reset}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-industrial-900">{title}</h2>
          <button onClick={reset} className="p-1 text-industrial-400 hover:text-industrial-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <Button variant="outline" size="sm" onClick={() => downloadTemplate(templateFilename, columns.map((c) => c.label), exampleRow)}>
            <Download className="h-4 w-4" /> Template
          </Button>
          <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-industrial-300 text-sm cursor-pointer hover:bg-industrial-50">
            <Upload className="h-4 w-4" />
            Pilih File Excel/CSV
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
          </label>
        </div>

        {rows.length > 0 && (
          <div className="border border-industrial-200 rounded-lg max-h-64 overflow-y-auto mb-4">
            <table className="w-full text-xs">
              <thead className="bg-industrial-50">
                <tr>
                  {columns.map((c) => (
                    <th key={c.key} className="text-left px-3 py-2 font-medium text-industrial-700">{c.label}</th>
                  ))}
                  <th className="text-left px-3 py-2 font-medium text-industrial-700">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 100).map((r, i) => (
                  <tr key={i} className={r.valid ? '' : 'bg-danger-50'}>
                    {columns.map((c) => (
                      <td key={c.key} className="px-3 py-1.5">{String(r.values[c.key] ?? '')}</td>
                    ))}
                    <td className="px-3 py-1.5">{r.valid ? 'OK' : r.errors.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs text-industrial-500 mb-4">
          {rows.length} baris dibaca — {validRows.length} valid, {rows.length - validRows.length} bermasalah.
        </p>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={reset}>Batal</Button>
          <Button variant="success" loading={importing} disabled={validRows.length === 0} onClick={handleImport}>
            Import {validRows.length} Baris
          </Button>
        </div>
      </div>
    </div>
  );
}
