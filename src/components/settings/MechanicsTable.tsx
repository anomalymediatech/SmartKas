import { useState } from 'react';
import { Plus, Edit, Trash2, UserCheck, UserX } from 'lucide-react';
import { Button, Input, Modal, Table, TablePagination } from '@/components/ui';
import { useAppStore } from '@/stores';
import { useToast } from '@/hooks/useToast';
import type { Mechanic } from '@/types';

export function MechanicsTable() {
  const { mechanics, loadMechanics, addMechanic, updateMechanic, deleteMechanic, toggleMechanicActive, isLoading } = useAppStore();
  const { success, error } = useToast();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMechanic, setEditingMechanic] = useState<Mechanic | null>(null);
  const [formName, setFormName] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const openAddModal = () => {
    setEditingMechanic(null);
    setFormName('');
    setIsModalOpen(true);
  };

  const openEditModal = (mechanic: Mechanic) => {
    setEditingMechanic(mechanic);
    setFormName(mechanic.name);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingMechanic) {
        await updateMechanic(editingMechanic.id, formName);
        success('Berhasil', 'Mekanik diperbarui');
      } else {
        await addMechanic(formName);
        success('Berhasil', 'Mekanik ditambahkan');
      }
      setIsModalOpen(false);
    } catch (err) {
      error('Gagal', editingMechanic ? 'Gagal memperbarui mekanik' : 'Gagal menambah mekanik');
    }
  };

  const handleDelete = async (id: number) => {
    if (deleteConfirmId !== id) {
      setDeleteConfirmId(id);
      return;
    }
    try {
      await deleteMechanic(id);
      success('Berhasil', 'Mekanik dihapus');
      setDeleteConfirmId(null);
    } catch (err) {
      error('Gagal', 'Gagal menghapus mekanik');
    }
  };

  const handleToggleActive = async (mechanic: Mechanic) => {
    try {
      await toggleMechanicActive(mechanic.id, mechanic.is_active === 1 ? 0 : 1);
      success('Berhasil', `Mekanik ${mechanic.is_active === 1 ? 'dinonaktifkan' : 'diaktifkan'}`);
    } catch (err) {
      error('Gagal', 'Gagal mengubah status');
    }
  };

  const columns = [
    { key: 'name', header: 'Nama', render: (row: Mechanic) => <span className="font-medium">{row.name}</span> },
    { 
      key: 'is_active', 
      header: 'Status', 
      render: (row: Mechanic) => (
        <button
          onClick={() => handleToggleActive(row)}
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${row.is_active === 1 ? 'bg-success-100 text-success-700' : 'bg-industrial-100 text-industrial-700'}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${row.is_active === 1 ? 'bg-success-500' : 'bg-industrial-400'}`} />
          {row.is_active === 1 ? 'Aktif' : 'Nonaktif'}
        </button>
      )
    },
    { 
      key: 'actions', 
      header: 'Aksi', 
      render: (row: Mechanic) => (
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
            <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
          </span>
          Daftar Mekanik
        </h3>
        <Button onClick={openAddModal} size="sm">
          <Plus className="h-4 w-4" />
          Tambah
        </Button>
      </div>

      <Table
        columns={columns}
        data={mechanics}
        keyExtractor={(row) => row.id}
        isLoading={isLoading}
        emptyMessage="Belum ada data mekanik"
      />

      <TablePagination
        currentPage={1}
        totalPages={1}
        totalItems={mechanics.length}
        pageSize={mechanics.length}
        onPageChange={() => {}}
        onPageSizeChange={() => {}}
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingMechanic(null); setFormName(''); }}
        title={editingMechanic ? 'Edit Mekanik' : 'Tambah Mekanik'}
        size="sm"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nama Mekanik"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="Nama mekanik"
            required
            autoFocus
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => { setIsModalOpen(false); setEditingMechanic(null); setFormName(''); }}>
              Batal
            </Button>
            <Button type="submit" loading={isLoading}>
              {editingMechanic ? 'Simpan' : 'Tambah'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}