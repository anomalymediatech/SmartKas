import { useState, useEffect } from 'react';
import { Search, RotateCcw, AlertTriangle, Pencil, Upload, Download, Plus, Trash2, Edit } from 'lucide-react';
import { Button, Table, TablePagination, Badge, Input, Modal, Select } from '@/components/ui';
import { useInventoryStore } from '@/stores';
import { useAppStore } from '@/stores/useAppStore';
import { formatRupiah, parseRupiah } from '@/utils/currency';
import { StockAdjustmentModal } from '@/components/settings/StockAdjustmentModal';
import { SparepartEditModal } from '@/components/settings/SparepartEditModal';
import { ImportExcelModal } from '@/components/ImportExcelModal';
import { dbImportSpareparts, dbImportServices } from '@/hooks/useDatabase';
import { exportStockOpname } from '@/utils/excel';
import { useToast } from '@/hooks/useToast';
import { useAuth } from '@/context/AuthContext';
import type { Sparepart, Service } from '@/types';

export default function InventoryPage() {
  const { isLoading, loadSpareparts, getLowStockItems } = useInventoryStore();

  const { spareparts: allSpareparts, services: allServices, loadServices, addSparepart, addService, updateService, deleteService } = useAppStore();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { success, error } = useToast();

  const [searchValue, setSearchValue] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [selectedPart, setSelectedPart] = useState<Sparepart | null>(null);
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [editingPart, setEditingPart] = useState<Sparepart | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [activeTab, setActiveTab] = useState<'sparepart' | 'service'>('sparepart');
  
  // Sparepart add modal
  const [isAddSparepartOpen, setIsAddSparepartOpen] = useState(false);
  const [newSparepartData, setNewSparepartData] = useState({ name: '', buy_price: '', sell_price: '', stock: '' });
  
  // Service add/edit modal
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [serviceFormData, setServiceFormData] = useState({ name: '', price: '', service_type: 'biasa' as 'biasa' | 'upgrade' });

  useEffect(() => {
    loadSpareparts();
    loadServices();
  }, [loadSpareparts, loadServices]);

  const handleSearch = (value: string) => {
    setSearchValue(value);
  };

  const filteredParts = allSpareparts.filter((part) => {
    const matchesSearch = part.name.toLowerCase().includes(searchValue.toLowerCase());
    const matchesActive = showInactive || part.is_active === 1;
    return matchesSearch && matchesActive;
  });

  const filteredServices = allServices.filter((svc) => {
    const matchesSearch = svc.name.toLowerCase().includes(searchValue.toLowerCase());
    return matchesSearch;
  });

  const lowStockItems = getLowStockItems();

  const openAdjustmentModal = (part: Sparepart) => {
    setSelectedPart(part);
    setIsAdjustmentModalOpen(true);
  };

  const handleAdjustmentClose = () => {
    setIsAdjustmentModalOpen(false);
    setSelectedPart(null);
  };

  const handleExportOpname = () => {
    const activeParts = allSpareparts.filter((part) => part.is_active === 1);
    if (activeParts.length === 0) {
      error('Kosong', 'Tidak ada item aktif untuk diexport');
      return;
    }
    const date = new Date().toISOString().slice(0, 10);
    exportStockOpname(
      `stok-opname-${date}.xlsx`,
      activeParts.map((part) => ({
        name: part.name,
        stock: part.stock,
        sell_price: part.sell_price,
        ...(isAdmin ? { buy_price: part.buy_price } : {}),
      }))
    );
    success('Berhasil', `Export ${activeParts.length} item stok opname`);
  };

  // Sparepart add handlers
  const openAddSparepartModal = () => {
    setNewSparepartData({ name: '', buy_price: '', sell_price: '', stock: '' });
    setIsAddSparepartOpen(true);
  };

  const handleAddSparepartSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newStock = parseInt(newSparepartData.stock, 10) || 0;
    const newBuy = Number(newSparepartData.buy_price) || 0;
    const newSell = Number(newSparepartData.sell_price) || 0;
    if (!newSparepartData.name.trim()) {
      error('Gagal', 'Nama wajib diisi');
      return;
    }
    try {
      await addSparepart({
        name: newSparepartData.name.trim(),
        buy_price: newBuy,
        sell_price: newSell,
        stock: newStock,
        is_active: 1,
      });
      success('Berhasil', 'Sparepart ditambahkan');
      setIsAddSparepartOpen(false);
    } catch {
      error('Gagal', 'Gagal menambah sparepart');
    }
  };

  // Service modal handlers
  const openAddServiceModal = () => {
    setEditingService(null);
    setServiceFormData({ name: '', price: '', service_type: 'biasa' });
    setIsServiceModalOpen(true);
  };

  const openEditServiceModal = (service: Service) => {
    setEditingService(service);
    setServiceFormData({
      name: service.name,
      price: service.price.toString(),
      service_type: service.service_type ?? 'biasa',
    });
    setIsServiceModalOpen(true);
  };

  const handleServiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = {
        name: serviceFormData.name,
        price: parseRupiah(serviceFormData.price),
        service_type: serviceFormData.service_type,
      };
      
      if (editingService) {
        await updateService(editingService.id, data);
        success('Berhasil', 'Layanan diperbarui');
      } else {
        await addService(data);
        success('Berhasil', 'Layanan ditambahkan');
      }
      setIsServiceModalOpen(false);
    } catch {
      error('Gagal', editingService ? 'Gagal memperbarui layanan' : 'Gagal menambah layanan');
    }
  };

  const handleDeleteService = async (id: number) => {
    if (!window.confirm('Hapus layanan ini?')) return;
    try {
      await deleteService(id);
      success('Berhasil', 'Layanan dihapus');
    } catch {
      error('Gagal', 'Gagal menghapus layanan');
    }
  };

  const sparepartColumns = [
    { key: 'name', header: 'Nama Sparepart', render: (row: Sparepart) => <span className="font-medium">{row.name}</span> },
    ...(isAdmin ? [{ key: 'buy_price', header: 'Harga Beli', render: (row: Sparepart) => <span className="font-mono">{formatRupiah(row.buy_price)}</span> }] : []),
    { key: 'sell_price', header: 'Harga Jual', render: (row: Sparepart) => <span className="font-mono font-semibold">{formatRupiah(row.sell_price)}</span> },
    { 
      key: 'stock', 
      header: 'Stok', 
      render: (row: Sparepart) => (
        <Badge variant={row.stock <= 0 ? 'danger' : row.stock <= 5 ? 'warning' : 'success'} size="md">
          {row.stock} pcs
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
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => { setEditingPart(row); setIsEditOpen(true); }}
            className="px-3 py-1.5"
          >
            <Pencil className="h-4 w-4 mr-1" />
            Edit
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => openAdjustmentModal(row)}
            className="px-3 py-1.5"
          >
            <RotateCcw className="h-4 w-4 mr-1" />
            Stok
          </Button>
        </div>
      )
    },
  ];

  const serviceColumns = [
    { key: 'name', header: 'Nama Layanan', render: (row: Service) => <span className="font-medium">{row.name}</span> },
    { key: 'price', header: 'Harga', render: (row: Service) => <span className="font-mono font-semibold">{formatRupiah(row.price)}</span> },
    { key: 'service_type', header: 'Jenis', render: (row: Service) => <span className={`px-2 py-0.5 rounded text-xs ${row.service_type === 'upgrade' ? 'bg-purple-50 text-purple-700' : 'bg-emerald-50 text-emerald-700'}`}>{row.service_type === 'upgrade' ? 'Upgrade' : 'Biasa'}</span> },
    { 
      key: 'actions', 
      header: 'Aksi', 
      render: (row: Service) => (
        <div className="flex items-center gap-1">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => openEditServiceModal(row)}
            className="px-3 py-1.5"
          >
            <Edit className="h-4 w-4 mr-1" />
            Edit
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => handleDeleteService(row.id)}
            className="px-3 py-1.5 text-danger-600 hover:bg-danger-50"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Hapus
          </Button>
        </div>
      )
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header with Low Stock Alert */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-industrial-900">Manajemen Inventori</h1>
          <p className="text-industrial-500 mt-1">Kelola stok sparepart dan layanan, serta stock opname</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={handleExportOpname}>
            <Download className="h-4 w-4 mr-1" /> Export Stok Opname
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowImport(true)}>
            <Upload className="h-4 w-4 mr-1" /> Import Excel
          </Button>
          {lowStockItems.length > 0 && (
          <div className="bg-warning-50 border border-warning-200 rounded-lg p-3 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-warning-600 flex-shrink-0" />
            <div>
              <p className="font-medium text-warning-800">Peringatan Stok Rendah</p>
              <p className="text-sm text-warning-700">{lowStockItems.length} item memiliki stok ≤ 5</p>
            </div>
          </div>
        )}
        </div>
      </div>

      {/* Tab Toggle */}
      <div className="bg-white rounded-xl border border-industrial-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 bg-industrial-100 rounded-lg p-1" role="tablist" aria-label="Jenis inventori">
            <button
              role="tab"
              aria-selected={activeTab === 'sparepart'}
              onClick={() => setActiveTab('sparepart')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'sparepart' ? 'bg-white text-industrial-900 shadow-sm' : 'text-industrial-600 hover:text-industrial-900'}`}
            >
              Sparepart
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'service'}
              onClick={() => setActiveTab('service')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'service' ? 'bg-white text-industrial-900 shadow-sm' : 'text-industrial-600 hover:text-industrial-900'}`}
            >
              Layanan
            </button>
          </div>
          <div className="flex items-center gap-2">
            {activeTab === 'sparepart' && (
              <Button onClick={openAddSparepartModal} size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Tambah Sparepart
              </Button>
            )}
            {activeTab === 'service' && (
              <Button onClick={openAddServiceModal} size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Tambah Layanan
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="bg-white rounded-xl border border-industrial-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-industrial-400">
              <Search className="h-5 w-5" />
            </div>
            <input
              type="text"
              value={searchValue}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder={activeTab === 'sparepart' ? 'Cari nama sparepart...' : 'Cari nama layanan...'}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-industrial-300 focus:outline-none focus:ring-2 focus:ring-industrial-500 focus:border-industrial-500"
            />
          </div>
          {activeTab === 'sparepart' && (
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showInactive}
                  onChange={(e) => setShowInactive(e.target.checked)}
                  className="w-4 h-4 rounded border-industrial-300 text-accent-600 focus:ring-accent-500"
                />
                <span className="text-sm text-industrial-700">Tampilkan nonaktif</span>
              </label>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-industrial-200 overflow-hidden">
        {activeTab === 'sparepart' ? (
          <Table
            columns={sparepartColumns}
            data={filteredParts}
            keyExtractor={(row) => row.id}
            isLoading={isLoading}
            emptyMessage="Tidak ada sparepart ditemukan"
          />
        ) : (
          <Table
            columns={serviceColumns}
            data={filteredServices}
            keyExtractor={(row) => row.id}
            isLoading={isLoading}
            emptyMessage="Tidak ada layanan ditemukan"
          />
        )}
        
        <TablePagination
          currentPage={1}
          totalPages={1}
          totalItems={activeTab === 'sparepart' ? filteredParts.length : filteredServices.length}
          pageSize={activeTab === 'sparepart' ? filteredParts.length : filteredServices.length}
          onPageChange={() => {}}
          onPageSizeChange={() => {}}
        />
      </div>

      {/* Stock Adjustment Modal */}
      <StockAdjustmentModal
        isOpen={isAdjustmentModalOpen}
        onClose={handleAdjustmentClose}
        sparepart={selectedPart}
      />
      <SparepartEditModal
        isOpen={isEditOpen}
        onClose={() => { setIsEditOpen(false); setEditingPart(null); }}
        sparepart={editingPart}
      />
      
      {/* Add Sparepart Modal */}
      <Modal
        isOpen={isAddSparepartOpen}
        onClose={() => setIsAddSparepartOpen(false)}
        title="Tambah Sparepart Baru"
        size="sm"
      >
        <form onSubmit={handleAddSparepartSubmit} className="space-y-4">
          <Input label="Nama" value={newSparepartData.name} onChange={(e) => setNewSparepartData({ ...newSparepartData, name: e.target.value })} required autoFocus />
          <Input label="Harga Beli" type="number" value={newSparepartData.buy_price} onChange={(e) => setNewSparepartData({ ...newSparepartData, buy_price: e.target.value })} min="0" />
          <Input label="Harga Jual" type="number" value={newSparepartData.sell_price} onChange={(e) => setNewSparepartData({ ...newSparepartData, sell_price: e.target.value })} min="0" required />
          <Input label="Stok Awal" type="number" value={newSparepartData.stock} onChange={(e) => setNewSparepartData({ ...newSparepartData, stock: e.target.value })} min="0" required />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setIsAddSparepartOpen(false)}>Batal</Button>
            <Button type="submit">Tambah</Button>
          </div>
        </form>
      </Modal>

      {/* Service Add/Edit Modal */}
      <Modal
        isOpen={isServiceModalOpen}
        onClose={() => { setIsServiceModalOpen(false); setEditingService(null); }}
        title={editingService ? 'Edit Layanan' : 'Tambah Layanan'}
        size="sm"
      >
        <form onSubmit={handleServiceSubmit} className="space-y-4">
          <Input
            label="Nama Layanan"
            value={serviceFormData.name}
            onChange={(e) => setServiceFormData({ ...serviceFormData, name: e.target.value })}
            placeholder="Contoh: Ganti Oli Mesin"
            required
            autoFocus
          />
          <Input
            label="Harga"
            type="text"
            value={serviceFormData.price}
            onChange={(e) => setServiceFormData({ ...serviceFormData, price: e.target.value })}
            placeholder="0"
            inputMode="numeric"
            required
          />
          <div>
            <label className="block text-sm font-medium text-industrial-700 mb-1.5">Jenis Layanan</label>
            <Select
              value={serviceFormData.service_type}
              onChange={(e) => setServiceFormData({ ...serviceFormData, service_type: e.target.value as 'biasa' | 'upgrade' })}
              options={[
                { value: 'biasa', label: 'Service Biasa' },
                { value: 'upgrade', label: 'Service Upgrade' },
              ]}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => { setIsServiceModalOpen(false); setEditingService(null); }}>
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
        title={activeTab === 'sparepart' ? 'Import Sparepart dari Excel' : 'Import Layanan dari Excel'}
        templateFilename={activeTab === 'sparepart' ? 'template-sparepart.xlsx' : 'template-layanan.xlsx'}
        columns={activeTab === 'sparepart' ? [
          { key: 'name', label: 'Nama', candidates: ['name', 'nama', 'nama barang', 'barang'], required: true },
          { key: 'buy_price', label: 'Harga Beli', candidates: ['buy_price', 'harga beli', 'beli'] },
          { key: 'sell_price', label: 'Harga Jual', candidates: ['sell_price', 'harga jual', 'jual'] },
          { key: 'stock', label: 'Stok', candidates: ['stock', 'stok'] },
        ] : [
          { key: 'name', label: 'Nama', candidates: ['name', 'nama', 'nama layanan', 'layanan'], required: true },
          { key: 'price', label: 'Harga', candidates: ['price', 'harga'] },
        ]}
        exampleRow={activeTab === 'sparepart' ? ['Oli Mesin 1L', 35000, 55000, 20] : ['Ganti Oli Mesin', 50000]}
        onImport={async (rows) => {
          if (activeTab === 'sparepart') {
            const result = await dbImportSpareparts(rows as { name: string; buy_price: number | null; sell_price: number | null; stock: number | null }[]);
            await useAppStore.getState().loadSpareparts();
            await loadSpareparts();
            return result;
          } else {
            const result = await dbImportServices(rows as { name: string; price: number | null }[]);
            await loadServices();
            return result;
          }
        }}
      />
    </div>
  );
}