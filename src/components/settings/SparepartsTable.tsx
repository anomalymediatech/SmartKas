import { useState } from 'react';
import { Plus, Edit, Trash2, Package } from 'lucide-react';
import { Button, Input, Modal, Table, TablePagination, Badge } from '@/components/ui';
import { useAppStore } from '@/stores';
import { useToast } from '@/hooks/useToast';
import { formatRupiah, parseRupiah } from '@/utils/currency';
import type { Sparepart } from '@/types';

export function SparepartsTable() {
  const { spareparts, addSparepart, updateSparepart, deleteSparepart, isLoading } = useAppStore();
  const { success, error } = useToast();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPart, setEditingPart] = useState<Sparepart | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    buy_price: '',
    sell_price: '',
    stock: '',
    is_active: 1,
  });
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const openAddModal = () => {
    setEditingPart(null);
    setFormData({ name: '', buy_price: '', sell_price: '', stock: '', is_active: 1 });
    setIsModalOpen(true);
  };

  const openEditModal = (part: Sparepart) => {
    setEditingPart(part);
    setFormData({
      name: part.name,
      buy_price: part.buy_price.toString(),
      sell_price: part.sell_price.toString(),
      stock: part.stock.toString(),
      is_active: part.is_active,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = {
        name: formData.name,
        buy_price: parseRupiah(formData.buy_price),
        sell_price: parseRupiah(formData.sell_price),
        stock: parseInt(formData.stock, 10) || 0,
        is_active: formData.is_active,
      };
      
      if (editingPart) {
        await updateSparepart(editingPart.id, data);
        success('Berhasil', 'Sparepart diperbarui');
      } else {
        await addSparepart(data);
        success('Berhasil', 'Sparepart ditambahkan');
      }
      setIsModalOpen(false);
    } catch {
      error('Gagal', editingPart ? 'Gagal memperbarui sparepart' : 'Gagal menambah sparepart');
    }
  };

  const handleDelete = async (id: number) => {
    if (deleteConfirmId !== id) {
      setDeleteConfirmId(id);
      return;
    }
    try {
      await deleteSparepart(id);
      success('Berhasil', 'Sparepart dihapus');
      setDeleteConfirmId(null);
    } catch {
      error('Gagal', 'Gagal menghapus sparepart');
    }
  };

  const columns = [
    { key: 'name', header: 'Nama', render: (row: Sparepart) => <span className="font-medium">{row.name}</span> },
    { key: 'buy_price', header: 'Harga Beli', render: (row: Sparepart) => <span className="font-mono">{formatRupiah(row.buy_price)}</span> },
    { key: 'sell_price', header: 'Harga Jual', render: (row: Sparepart) => <span className="font-mono font-semibold">{formatRupiah(row.sell_price)}</span> },
    { 
      key: 'stock', 
      header: 'Stok', 
      render: (row: Sparepart) => (
        <Badge variant={row.stock <= 0 ? 'danger' : row.stock <= 5 ? 'warning' : 'success'} size="sm">
          {row.stock}
        </Badge>
      ) 
    },
    { 
      key: 'is_active', 
      header: 'Status', 
      render: (row: Sparepart) => (
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${row.is_active === 1 ? 'bg-success-100 text-success-700' : 'bg-industrial-100 text-industrial-700'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${row.is_active === 1 ? 'bg-success-500' : 'bg-industrial-400'}`} />
          {row.is_active === 1 ? 'Aktif' : 'Nonaktif'}
        </span>
      )
    },
    { 
      key: 'actions', 
      header: 'Aksi', 
      render: (row: Sparepart) => (
        <div className="flex items-center gap-1">
          <button onClick={() => openEditModal(row)} className="p-1.5 text-industrial-500 hover:text-industrial-700 hover:bg-industrial-100 rounded" title="Edit">
            <Edit className="h-4 w-4" />
          </button>
          <button onClick={() => handleDelete(row.id)} className="p-1.5 text-industrial-500 hover:text-danger-600 hover:bg-danger-50 rounded" title="Hapus">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-industrial-900 flex items-center gap-2">
          <span className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
            <Package className="h-5 w-5 text-blue-600" />
          </span>
          Daftar Sparepart
        </h3>
        <Button onClick={openAddModal} size="sm">
          <Plus className="h-4 w-4" />
          Tambah
        </Button>
      </div>

      <Table
        columns={columns}
        data={spareparts}
        keyExtractor={(row) => row.id}
        isLoading={isLoading}
        emptyMessage="Belum ada data sparepart"
      />

      <TablePagination
        currentPage={1}
        totalPages={1}
        totalItems={spareparts.length}
        pageSize={spareparts.length}
        onPageChange={() => {}}
        onPageSizeChange={() => {}}
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingPart(null); }}
        title={editingPart ? 'Edit Sparepart' : 'Tambah Sparepart'}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Nama Sparepart"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Nama sparepart"
              required
              autoFocus
            />
            <Input
              label="Harga Beli"
              type="text"
              value={formData.buy_price}
              onChange={(e) => setFormData({ ...formData, buy_price: e.target.value })}
              placeholder="0"
              inputMode="numeric"
            />
            <Input
              label="Harga Jual"
              type="text"
              value={formData.sell_price}
              onChange={(e) => setFormData({ ...formData, sell_price: e.target.value })}
              placeholder="0"
              inputMode="numeric"
              required
            />
            <Input
              label="Stok Awal"
              type="number"
              value={formData.stock}
              onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
              placeholder="0"
              min="0"
            />
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_active === 1}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked ? 1 : 0 })}
                className="w-4 h-4 rounded border-industrial-300 text-accent-600 focus:ring-accent-500"
              />
              <span className="text-sm text-industrial-700">Aktif</span>
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => { setIsModalOpen(false); setEditingPart(null); }}>
              Batal
            </Button>
            <Button type="submit" loading={isLoading}>
              {editingPart ? 'Simpan' : 'Tambah'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
