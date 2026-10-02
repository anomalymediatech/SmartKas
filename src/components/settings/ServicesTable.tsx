import { useState } from 'react';
import { Plus, Edit, Trash2, Wrench } from 'lucide-react';
import { Button, Input, Modal, Table, TablePagination } from '@/components/ui';
import { useAppStore } from '@/stores';
import { useToast } from '@/hooks/useToast';
import { formatRupiah, parseRupiah } from '@/utils/currency';
import type { Service } from '@/types';

export function ServicesTable() {
  const { services, loadServices, addService, updateService, deleteService, isLoading } = useAppStore();
  const { success, error } = useToast();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    price: '',
  });
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const openAddModal = () => {
    setEditingService(null);
    setFormData({ name: '', price: '' });
    setIsModalOpen(true);
  };

  const openEditModal = (service: Service) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      price: service.price.toString(),
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = {
        name: formData.name,
        price: parseRupiah(formData.price),
      };
      
      if (editingService) {
        await updateService(editingService.id, data);
        success('Berhasil', 'Layanan diperbarui');
      } else {
        await addService(data);
        success('Berhasil', 'Layanan ditambahkan');
      }
      setIsModalOpen(false);
    } catch (err) {
      error('Gagal', editingService ? 'Gagal memperbarui layanan' : 'Gagal menambah layanan');
    }
  };

  const handleDelete = async (id: number) => {
    if (deleteConfirmId !== id) {
      setDeleteConfirmId(id);
      return;
    }
    try {
      await deleteService(id);
      success('Berhasil', 'Layanan dihapus');
      setDeleteConfirmId(null);
    } catch (err) {
      error('Gagal', 'Gagal menghapus layanan');
    }
  };

  const columns = [
    { key: 'name', header: 'Nama Layanan', render: (row: Service) => <span className="font-medium">{row.name}</span> },
    { key: 'price', header: 'Harga', render: (row: Service) => <span className="font-mono font-semibold">{formatRupiah(row.price)}</span> },
    { 
      key: 'actions', 
      header: 'Aksi', 
      render: (row: Service) => (
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
          <span className="w-8 h-8 bg-accent-100 rounded-lg flex items-center justify-center">
            <Wrench className="h-5 w-5 text-accent-600" />
          </span>
          Daftar Layanan Standar
        </h3>
        <Button onClick={openAddModal} size="sm">
          <Plus className="h-4 w-4" />
          Tambah
        </Button>
      </div>

      <Table
        columns={columns}
        data={services}
        keyExtractor={(row) => row.id}
        isLoading={isLoading}
        emptyMessage="Belum ada data layanan standar"
      />

      <TablePagination
        currentPage={1}
        totalPages={1}
        totalItems={services.length}
        pageSize={services.length}
        onPageChange={() => {}}
        onPageSizeChange={() => {}}
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingService(null); }}
        title={editingService ? 'Edit Layanan' : 'Tambah Layanan'}
        size="sm"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nama Layanan"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Contoh: Ganti Oli Mesin"
            required
            autoFocus
          />
          <Input
            label="Harga"
            type="text"
            value={formData.price}
            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
            placeholder="0"
            inputMode="numeric"
            required
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => { setIsModalOpen(false); setEditingService(null); }}>
              Batal
            </Button>
            <Button type="submit" loading={isLoading}>
              {editingService ? 'Simpan' : 'Tambah'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}