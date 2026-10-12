import { useState } from 'react';
import { Button, Input, Modal } from '@/components/ui';
import { useAppStore } from '@/stores';
import { useToast } from '@/hooks/useToast';
import type { Sparepart } from '@/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  sparepart: Sparepart | null;
}

export function SparepartEditModal({ isOpen, onClose, sparepart }: Props) {
  const { updateSparepart, adjustStock } = useAppStore();
  const { success, error } = useToast();
  const [name, setName] = useState('');
  const [buyPrice, setBuyPrice] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [stock, setStock] = useState('');
  const [syncedId, setSyncedId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (isOpen && sparepart && sparepart.id !== syncedId) {
    setSyncedId(sparepart.id);
    setName(sparepart.name);
    setBuyPrice(String(sparepart.buy_price));
    setSellPrice(String(sparepart.sell_price));
    setStock(String(sparepart.stock));
  }

  const reset = () => {
    setSyncedId(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sparepart) return;
    const newStock = parseInt(stock, 10);
    const newBuy = Number(buyPrice) || 0;
    const newSell = Number(sellPrice) || 0;
    if (!name.trim()) {
      error('Gagal', 'Nama wajib diisi');
      return;
    }
    if (isNaN(newStock)) {
      error('Gagal', 'Stok harus angka');
      return;
    }
    setSubmitting(true);
    try {
      await updateSparepart(sparepart.id, { name: name.trim(), buy_price: newBuy, sell_price: newSell });
      const delta = newStock - sparepart.stock;
      if (delta !== 0) {
        await adjustStock(sparepart.id, delta, 'Edit manual via inventori');
      }
      success('Berhasil', 'Data sparepart diperbarui');
      reset();
    } catch {
      error('Gagal', 'Gagal memperbarui sparepart');
    } finally {
      setSubmitting(false);
    }
  };

  if (!sparepart) return null;

  return (
    <Modal isOpen={isOpen} onClose={reset} title={`Edit: ${sparepart.name}`} size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Nama" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input label="Harga Beli" type="number" value={buyPrice} onChange={(e) => setBuyPrice(e.target.value)} min="0" />
        <Input label="Harga Jual" type="number" value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} min="0" />
        <Input label="Stok" type="number" value={stock} onChange={(e) => setStock(e.target.value)} min="0" required helperText="Selisih stok akan dicatat otomatis sebagai penyesuaian" />
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={reset} disabled={submitting}>Batal</Button>
          <Button type="submit" loading={submitting}>Simpan</Button>
        </div>
      </form>
    </Modal>
  );
}
