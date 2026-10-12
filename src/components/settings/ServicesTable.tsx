import { useState } from 'react';
import { Plus, Edit, Trash2, Wrench, Upload } from 'lucide-react';
import { ImportExcelModal } from '@/components/ImportExcelModal';
import { dbImportServices } from '@/hooks/useDatabase';
import { useAppStore } from '@/stores';
import { Button, Input, Modal, Table, TablePagination } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { formatRupiah, parseRupiah } from '@/utils/currency';
import type { Service } from '@/types';

export function ServicesTable() {
  const { services, addService, updateService, deleteService, isLoading, loadServices } = useAppStore();
  const { success, error } = useToast();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    service_type: 'biasa' as 'biasa' | 'upgrade',
  });
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const openAddModal = () => {
    setEditingService(null);
    setFormData({ name: '', price: '', service_type: 'biasa' });
    setIsModalOpen(true);
  };

  const openEditModal = (service: Service) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      price: service.price.toString(),
      service_type: service.service_type ?? 'biasa',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = {
        name: formData.name,
        price: parseRupiah(formData.price),
        service_type: formData.service_type,
      };
      
      if (editingService) {
        await updateService(editingService.id, data);
        success('Berhasil', 'Layanan diperbarui');
      } else {
        await addService(data);
        success('Berhasil', 'Layanan ditambahkan');
      }
      setIsModalOpen(false);
    } catch {
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
    } catch {
      error('Gagal', 'Gagal menghapus layanan');
    }
  };

  const columns = [
    { key: 'name', header: 'Nama Layanan', render: (row: Service) => <span className="font-medium">{row.name}</span> },
    { key: 'price', header: 'Harga', render: (row: Service) => <span className="font-mono font-semibold">{formatRupiah(row.price)}</span> },
    { key: 'service_type', header: 'Jenis', render: (row: Service) => <span className={`px-2 py-0.5 rounded text-xs ${row.service_type === 'upgrade' ? 'bg-purple-50 text-purple-700' : 'bg-emerald-50 text-emerald-700'}`}>{row.service_type === 'upgrade' ? 'Upgrade' : 'Biasa'}</span> },
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
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowImport(true)}>
            <Upload className="h-4 w-4" />
            Import
          </Button>
          <Button onClick={openAddModal} size="sm">
            <Plus className="h-4 w-4" />
            Tambah
          </Button>
        </div>
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
          <div>
            <label className="block text-sm font-medium text-industrial-700 mb-1.5">Jenis Layanan</label>
            <select
              value={formData.service_type}
              onChange={(e) => setFormData({ ...formData, service_type: e.target.value as 'biasa' | 'upgrade' })}
              className="w-full px-3 py-2 rounded-lg border border-industrial-300 focus:outline-none focus:ring-2 focus:ring-industrial-500"
            >
              <option value="biasa">Service Biasa</option>
              <option value="upgrade">Service Upgrade</option>
            </select>
          </div>
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

      <ImportExcelModal
        open={showImport}
        onClose={() => setShowImport(false)}
        title="Import Layanan dari Excel"
        templateFilename="template-layanan.xlsx"
        columns={[
          { key: 'name', label: 'Nama', candidates: ['name', 'nama', 'nama layanan', 'layanan'], required: true },
          { key: 'price', label: 'Harga', candidates: ['price', 'harga'] },
        ]}
        exampleRow={['Ganti Oli Mesin', 50000]}
        onImport={async (rows) => {
          const result = await dbImportServices(rows as { name: string; price: number | null }[]);
          await loadServices();
          return result;
        }}
      />
    </div>
  );
}
