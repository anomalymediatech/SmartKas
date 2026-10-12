import { useEffect, useState } from 'react';
import { X, Printer } from 'lucide-react';
import { Button } from '@/components/ui';
import { dbGetDailyClose, dbPrintDailyClose, type DailyCloseReport } from '@/hooks/useDatabase';
import { formatRupiah } from '@/utils/currency';
import { useToast } from '@/hooks/useToast';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function TutupKasirModal({ open, onClose }: Props) {
  const [report, setReport] = useState<DailyCloseReport | null>(null);
  const [printing, setPrinting] = useState(false);
  const { success, error } = useToast();

  useEffect(() => {
    if (open) {
      dbGetDailyClose().then(setReport).catch(() => setReport(null));
    }
  }, [open]);

  if (!open) return null;

  const rowFor = (method: string) => report?.rows.find((r) => r.payment_method === method);
  const cash = rowFor('Cash');
  const transfer = rowFor('Transfer');
  const qris = rowFor('QRIS');

  const handlePrint = async () => {
    setPrinting(true);
    try {
      await dbPrintDailyClose(undefined);
      success('Berhasil', 'Laporan harian dikirim ke printer');
    } catch (e) {
      error('Gagal Cetak', e instanceof Error ? e.message : 'Gagal mencetak laporan');
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-industrial-900">Tutup Hari Ini</h2>
          <button onClick={onClose} className="p-1 text-industrial-400 hover:text-industrial-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3">
          <Row label="Total Cash" value={cash ? formatRupiah(cash.total) : formatRupiah(0)} />
          <Row label="Total Transfer" value={transfer ? formatRupiah(transfer.total) : formatRupiah(0)} />
          <Row label="Total QRIS" value={qris ? formatRupiah(qris.total) : formatRupiah(0)} />
          <Row label="Jumlah Transaksi" value={String(report?.total_count ?? 0)} />
          <div className="border-t border-industrial-200 pt-3">
            <Row label="Total Omzet" value={formatRupiah(report?.total_amount ?? 0)} bold />
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>Tutup</Button>
          <Button variant="success" className="flex-1" loading={printing} onClick={handlePrint}>
            <Printer className="h-4 w-4" />
            Cetak Laporan Harian
          </Button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-industrial-600">{label}</span>
      <span className={`font-mono ${bold ? 'font-bold text-lg text-industrial-900' : 'font-medium'}`}>{value}</span>
    </div>
  );
}
