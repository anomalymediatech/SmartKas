import { useState } from 'react';
import useSWR from 'swr';
import { Modal } from '@/components/ui';
import { dbGetVehicleHistory, dbGetVehicleReminder } from '@/hooks/useDatabase';
import { formatRupiah } from '@/utils/currency';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  plate: string;
}

export function VehicleHistoryModal({ isOpen, onClose, plate }: Props) {
  const { data: visits, isLoading } = useSWR(
    isOpen && plate ? `vehicle:${plate}` : null,
    () => dbGetVehicleHistory(plate)
  );
  const { data: reminder } = useSWR(
    isOpen && plate ? `vehicle-rem:${plate}` : null,
    () => dbGetVehicleReminder(plate)
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Riwayat Servis — ${plate}`} size="lg">
      {reminder && (
        <div className="mb-4 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
          ⚠️ Sudah <span className="font-bold">{reminder.months_since_service} bulan</span> sejak {reminder.last_service_name} terakhir.
          Rekomendasi: <span className="font-semibold">{reminder.recommended_service}</span>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-industrial-400 py-8 text-center">Memuat riwayat…</p>
      ) : !visits || visits.length === 0 ? (
        <p className="text-sm text-industrial-400 py-8 text-center">Belum ada riwayat servis untuk plat ini</p>
      ) : (
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {visits.map((visit) => (
            <div key={visit.id} className="border border-industrial-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-semibold text-industrial-900">{visit.invoice_number}</p>
                  <p className="text-xs text-industrial-500">
                    {visit.transaction_date} · {visit.mechanic_name ?? '-'} · {visit.status}
                  </p>
                </div>
                <p className="font-mono font-bold text-industrial-900">{formatRupiah(visit.total_amount)}</p>
              </div>
              <ul className="text-sm text-industrial-600 divide-y divide-industrial-100">
                {visit.items.map((item, i) => (
                  <li key={i} className="py-1 flex justify-between">
                    <span>
                      <span className={`inline-block w-2 h-2 rounded-full mr-2 ${item.item_type === 'layanan' ? 'bg-accent-500' : 'bg-industrial-300'}`} />
                      {item.item_name} ×{item.quantity}
                    </span>
                    <span className="font-mono">{formatRupiah(item.total_price)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
