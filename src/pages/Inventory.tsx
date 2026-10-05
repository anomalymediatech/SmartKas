import { useState, useEffect } from 'react';
import { Search, RotateCcw, AlertTriangle } from 'lucide-react';
import { Button, Table, TablePagination, Badge } from '@/components/ui';
import { useInventoryStore } from '@/stores';
import { useAppStore } from '@/stores/useAppStore';
import { formatRupiah } from '@/utils/currency';
import { StockAdjustmentModal } from '@/components/settings/StockAdjustmentModal';
import { useAuth } from '@/context/AuthContext';
import type { Sparepart } from '@/types';

export default function InventoryPage() {
  const { isLoading, loadSpareparts, getLowStockItems } = useInventoryStore();

  const { spareparts: allSpareparts } = useAppStore();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [searchValue, setSearchValue] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [selectedPart, setSelectedPart] = useState<Sparepart | null>(null);
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);

  useEffect(() => {
    loadSpareparts();
  }, [loadSpareparts]);

  const handleSearch = (value: string) => {
    setSearchValue(value);
    // Could debounce and call search API
  };

  const filteredParts = allSpareparts.filter((part) => {
    const matchesSearch = part.name.toLowerCase().includes(searchValue.toLowerCase());
    const matchesActive = showInactive || part.is_active === 1;
    return matchesSearch && matchesActive;
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

  const columns = [
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

  return (
    <div className="space-y-6">
      {/* Header with Low Stock Alert */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-industrial-900">Manajemen Inventori</h1>
          <p className="text-industrial-500 mt-1">Kelola stok sparepart dan lakukan stock opname</p>
        </div>
        
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
              placeholder="Cari nama sparepart..."
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-industrial-300 focus:outline-none focus:ring-2 focus:ring-industrial-500 focus:border-industrial-500"
            />
          </div>
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
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-industrial-200 overflow-hidden">
        <Table
          columns={columns}
          data={filteredParts}
          keyExtractor={(row) => row.id}
          isLoading={isLoading}
          emptyMessage="Tidak ada sparepart ditemukan"
        />
        
        <TablePagination
          currentPage={1}
          totalPages={1}
          totalItems={filteredParts.length}
          pageSize={filteredParts.length}
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
    </div>
  );
}