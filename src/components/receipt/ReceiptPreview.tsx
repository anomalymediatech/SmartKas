import { useEffect, useState } from 'react';
import { X, Printer } from 'lucide-react';
import { Button } from '@/components/ui';
import { dbGetReceiptData, dbPrintReceipt, type ReceiptData } from '@/hooks/useDatabase';
import { useToast } from '@/hooks/useToast';

interface Props {
  transactionId: number | null;
  onClose: () => void;
}

function fmt(n: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n);
}

export function ReceiptPreview({ transactionId, onClose }: Props) {
  const [data, setData] = useState<ReceiptData | null>(null);
  const [printing, setPrinting] = useState(false);
  const { error } = useToast();

  useEffect(() => {
    if (transactionId != null) {
      dbGetReceiptData(transactionId).then(setData).catch(() => error('Gagal', 'Tidak dapat memuat data nota'));
    }
  }, [transactionId, error]);

  if (transactionId == null) return null;

  const handlePrint = async () => {
    setPrinting(true);
    try {
      await dbPrintReceipt(transactionId);
    } catch (e) {
      error('Gagal Cetak', e instanceof Error ? e.message : 'Gagal mencetak');
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 overflow-y-auto py-8" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-industrial-900">Preview Nota</h2>
          <button onClick={onClose} className="p-1 text-industrial-400 hover:text-industrial-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 58mm thermal strip */}
        <div className="w-[302px] bg-white border border-dashed border-industrial-300 px-3 py-4 font-mono text-[11px] leading-snug text-neutral-800">
          {data ? (
            <>
              <div className="text-center">
                <div className="font-bold uppercase">{data.shop_name}</div>
                <div>{data.shop_address}</div>
              </div>
              <Divider />
              <div>
                <Line label="No Nota" value={data.invoice_number} />
                <Line label="Antrian" value={String(data.queue_number)} />
                <Line label="Pelanggan" value={data.customer_name} />
                <Line label="Tanggal" value={data.transaction_date} />
                <Line label="Kasir" value={data.cashier_name} />
                <Line label="Mekanik" value={data.mechanic_name} />
              </div>
              <Divider />
              {data.layanan.length > 0 && (
                <>
                  <div className="text-center">LAYANAN</div>
                  {data.layanan.map((it, i) => (
                    <ItemBlock key={i} item={it} />
                  ))}
                  <Line label="Total" value={fmt(data.layanan_total)} />
                  <Divider />
                </>
              )}
              {data.sparepart.length > 0 && (
                <>
                  <div className="text-center">SPARE PART</div>
                  {data.sparepart.map((it, i) => (
                    <ItemBlock key={i} item={it} />
                  ))}
                  <Line label="Total" value={fmt(data.sparepart_total)} />
                  <Divider />
                </>
              )}
              <Line label="Status" value={data.status} />
              <Line label="Metode Bayar" value={data.payment_method} />
              <Line label="SubTotal" value={fmt(data.subtotal)} />
              <Line label="Diskon" value={fmt(data.discount)} />
              <Line label="Total" value={fmt(data.total_amount)} bold />
              <Line label="DiBayar" value={fmt(data.paid_amount)} />
              <Line label="Kembalian" value={fmt(data.change_amount)} />
              <Divider />
              <div className="whitespace-pre-line">{data.custom_message}</div>
              <div className="text-center mt-2">Terimakasih</div>
            </>
          ) : (
            <div className="text-center text-industrial-400">Memuat…</div>
          )}
        </div>

        <div className="mt-4 flex gap-3 justify-end">
          <Button variant="outline" onClick={onClose}>Tutup</Button>
          <Button variant="success" loading={printing} onClick={handlePrint}>
            <Printer className="h-4 w-4" />
            Cetak Nota
          </Button>
        </div>
      </div>
    </div>
  );
}

function Divider() {
  return <div className="border-t border-dashed border-neutral-400 my-1" />;
}

function Line({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? 'font-bold' : ''}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function ItemBlock({ item }: { item: { item_name: string; quantity: number; unit_price: number; total_price: number } }) {
  return (
    <div>
      <div className="truncate">{item.item_name}</div>
      <div className="flex justify-between pl-2">
        <span>
          {item.quantity} x {fmt(item.unit_price)}
        </span>
        <span>{fmt(item.total_price)}</span>
      </div>
    </div>
  );
}
