import { useState } from 'react';
import { Plus, Minus } from 'lucide-react';
import { Button, Input, Textarea, Modal, Badge } from '@/components/ui';
import { useAppStore } from '@/stores';
import { useToast } from '@/hooks/useToast';
import type { Sparepart } from '@/types';

interface StockAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  sparepart: Sparepart | null;
}

export function StockAdjustmentModal({ isOpen, onClose, sparepart }: StockAdjustmentModalProps) {
  const { adjustStock, isLoading: storeLoading } = useAppStore();
  const { success, error } = useToast();
  
  const [adjustmentType, setAdjustmentType] = useState<'in' | 'out'>('in');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [syncedKey, setSyncedKey] = useState<string | null>(null);

  const resetKey = isOpen && sparepart ? `${sparepart.id}:${sparepart.stock}` : null;
  if (resetKey !== syncedKey) {
    setSyncedKey(resetKey);
    setQuantity('');
    setReason('');
    setAdjustmentType('in');
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sparepart) return;
    
    const qty = parseInt(quantity, 10);
    if (!qty || qty <= 0) {
      error('Gagal', 'Jumlah harus lebih dari 0');
      return;
    }
    if (!reason.trim()) {
      error('Gagal', 'Alasan wajib diisi');
      return;
    }
    if (adjustmentType === 'out' && qty > sparepart.stock) {
      error('Gagal', `Stok tidak mencukupi (tersedia: ${sparepart.stock})`);
      return;
    }

    setIsSubmitting(true);
    try {
      const delta = adjustmentType === 'in' ? qty : -qty;
      await adjustStock(sparepart.id, delta, reason.trim());
      success('Berhasil', `Stok ${adjustmentType === 'in' ? 'ditambah' : 'dikurangi'} ${qty}`);
      onClose();
    } catch {
      error('Gagal', 'Gagal menyesuaikan stok');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!sparepart) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Penyesuaian Stok (Stock Opname)"
      size="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-industrial-50 rounded-lg p-4 border border-industrial-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-industrial-600">Sparepart</span>
            <span className="font-medium text-industrial-900">{sparepart.name}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-industrial-600">Stok Saat Ini</span>
            <Badge variant={sparepart.stock <= 0 ? 'danger' : sparepart.stock <= 5 ? 'warning' : 'success'}>
              {sparepart.stock} pcs
            </Badge>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-industrial-700 mb-2">Jenis Penyesuaian</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setAdjustmentType('in')}
              className={`px-4 py-3 rounded-lg border-2 text-center font-medium transition-all ${
                adjustmentType === 'in'
                  ? 'bg-success-50 border-success-500 text-success-700'
                  : 'border-industrial-200 text-industrial-600 hover:border-industrial-300'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Plus className="h-5 w-5" />
                <span>Tambah Stok (IN)</span>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setAdjustmentType('out')}
              className={`px-4 py-3 rounded-lg border-2 text-center font-medium transition-all ${
                adjustmentType === 'out'
                  ? 'bg-danger-50 border-danger-500 text-danger-700'
                  : 'border-industrial-200 text-industrial-600 hover:border-industrial-300'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Minus className="h-5 w-5" />
                <span>Kurangi Stok (OUT)</span>
              </div>
            </button>
          </div>
        </div>

        <Input
          label={`Jumlah ${adjustmentType === 'in' ? 'Ditambah' : 'Dikurangi'}`}
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder="Contoh: 5"
          min="1"
          max={adjustmentType === 'out' ? sparepart.stock : undefined}
          required
          helperText={adjustmentType === 'out' ? `Maksimal: ${sparepart.stock}` : undefined}
        />

        <Textarea
          label="Alasan *"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Contoh: Barang rusak, Selisih hitung, Restok barang, Barang kadaluarsa"
          rows={3}
          required
        />

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Batal
          </Button>
          <Button type="submit" loading={isSubmitting || storeLoading}>
            {adjustmentType === 'in' ? 'Tambah Stok' : 'Kurangi Stok'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
