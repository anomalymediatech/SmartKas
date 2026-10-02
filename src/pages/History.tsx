import { useState, useEffect } from 'react';
import { Search, Calendar, Eye, Printer, RotateCcw, Filter, X } from 'lucide-react';
import { Button, Input, Modal, Table, TablePagination, Badge } from '@/components/ui';
import { useHistoryStore } from '@/stores';
import { useToast } from '@/hooks/useToast';
import { formatIndonesianDate } from '@/utils/date';
import { formatRupiah } from '@/utils/currency';
import type { Transaction, TransactionDetail } from '@/types';

export default function HistoryPage() {
  const { 
    transactions, 
    selectedTransaction, 
    selectedDetails, 
    filters, 
    isLoading, 
    error, 
    totalCount,
    loadTransactions, 
    setFilters, 
    selectTransaction, 
    voidTransaction,
    refresh 
  } = useHistoryStore();
  
  const { success, error: showError } = useToast();
  const [searchValue, setSearchValue] = useState(filters.search || '');
  const [dateFrom, setDateFrom] = useState(filters.date_from || '');
  const [dateTo, setDateTo] = useState(filters.date_to || '');

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setFilters({ search: searchValue || undefined, page: 1 });
  };

  const handleDateChange = () => {
    setFilters({ 
      date_from: dateFrom || undefined, 
      date_to: dateTo || undefined, 
      page: 1 
    });
  };

  const clearFilters = () => {
    setSearchValue('');
    setDateFrom('');
    setDateTo('');
    setFilters({ search: undefined, date_from: undefined, date_to: undefined, page: 1 });
  };

  const handleVoid = async (id: number) => {
    if (!confirm('Yakin ingin membatalkan transaksi ini? Stok sparepart akan dikembalikan.')) return;
    const result = await voidTransaction(id);
    if (result) {
      success('Berhasil', 'Transaksi dibatalkan, stok dikembalikan');
    } else {
      showError('Gagal', 'Gagal membatalkan transaksi');
    }
  };

  const columns = [
    { key: 'invoice_number', header: 'No. Nota', render: (row: Transaction) => <span className="font-mono font-medium">{row.invoice_number}</span> },
    { key: 'transaction_date', header: 'Tanggal', render: (row: Transaction) => <span className="text-sm">{formatIndonesianDate(row.transaction_date)}</span> },
    { key: 'queue_number', header: 'Antrian', render: (row: Transaction) => <span className="font-mono">{row.queue_number || '-'}</span> },
    { key: 'customer_name', header: 'Pelanggan', render: (row: Transaction) => <span>{row.customer_name || '-'}</span> },
    { key: 'vehicle_plate', header: 'Plat', render: (row: Transaction) => <span className="font-mono text-sm">{row.vehicle_plate}</span> },
    { key: 'mechanic_name', header: 'Mekanik', render: (row: Transaction) => <span>{row.mechanic_name || '-'}</span> },
    { key: 'total_amount', header: 'Total', render: (row: Transaction) => <span className="font-mono font-semibold">{formatRupiah(row.total_amount)}</span> },
    { 
      key: 'status', 
      header: 'Status', 
      render: (row: Transaction) => (
        <Badge variant={row.status === 'Lunas' ? 'success' : row.status === 'Batal' ? 'danger' : 'warning'}>
          {row.status}
        </Badge>
      ) 
    },
    { 
      key: 'actions', 
      header: 'Aksi', 
      render: (row: Transaction) => (
        <div className="flex items-center gap-1">
          <button onClick={() => selectTransaction(row)} className="p-1.5 text-industrial-500 hover:text-industrial-700 hover:bg-industrial-100 rounded" title="Detail">
            <Eye className="h-4 w-4" />
          </button>
          <button onClick={() => window.dispatchEvent(new CustomEvent('print-receipt', { detail: row.id }))} className="p-1.5 text-industrial-500 hover:text-industrial-700 hover:bg-industrial-100 rounded" title="Cetak Ulang">
            <Printer className="h-4 w-4" />
          </button>
          {row.status === 'Lunas' && (
            <button onClick={() => handleVoid(row.id)} className="p-1.5 text-warning-500 hover:text-danger-600 hover:bg-danger-50 rounded" title="Batalkan">
              <RotateCcw className="h-4 w-4" />
            </button>
          )}
        </div>
      )
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-industrial-900">Riwayat Transaksi</h1>
        <p className="text-industrial-500 mt-1">Lihat dan kelola riwayat transaksi bengkel</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-industrial-200 p-4">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-industrial-400">
              <Search className="h-5 w-5" />
            </div>
            <input
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="Cari no. nota, pelanggan, plat..."
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-industrial-300 focus:outline-none focus:ring-2 focus:ring-industrial-500 focus:border-industrial-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-industrial-500 whitespace-nowrap">Dari</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-2.5 rounded-lg border border-industrial-300 focus:outline-none focus:ring-2 focus:ring-industrial-500 text-sm"
            />
            <label className="text-sm text-industrial-500 whitespace-nowrap">Sampai</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-2.5 rounded-lg border border-industrial-300 focus:outline-none focus:ring-2 focus:ring-industrial-500 text-sm"
            />
            <Button type="submit" variant="secondary">
              <Filter className="h-4 w-4 mr-2" />
              Filter
            </Button>
            {(searchValue || dateFrom || dateTo) && (
              <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </form>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-industrial-200 overflow-hidden">
        <Table
          columns={columns}
          data={transactions}
          keyExtractor={(row) => row.id}
          onRowClick={selectTransaction}
          isLoading={isLoading}
          emptyMessage="Tidak ada transaksi ditemukan"
        />
        
        <TablePagination
          currentPage={filters.page}
          totalPages={Math.ceil(totalCount / filters.page_size)}
          totalItems={totalCount}
          pageSize={filters.page_size}
          onPageChange={(page) => setFilters({ page })}
          onPageSizeChange={(size) => setFilters({ page_size: size, page: 1 })}
        />
      </div>

      {/* Detail Modal */}
      <Modal
        isOpen={!!selectedTransaction}
        onClose={() => selectTransaction(null)}
        title="Detail Transaksi"
        size="xl"
      >
        {selectedTransaction && (
          <TransactionDetailView 
            transaction={selectedTransaction} 
            details={selectedDetails}
            onPrint={() => window.dispatchEvent(new CustomEvent('print-receipt', { detail: selectedTransaction!.id }))}
            onVoid={() => handleVoid(selectedTransaction!.id)}
          />
        )}
      </Modal>
    </div>
  );
}

interface TransactionDetailViewProps {
  transaction: Transaction;
  details: TransactionDetail[];
  onPrint: () => void;
  onVoid: () => void;
}

function TransactionDetailView({ transaction, details, onPrint, onVoid }: TransactionDetailViewProps) {
  const layananItems = details.filter(d => d.item_type === 'layanan');
  const sparepartItems = details.filter(d => d.item_type === 'sparepart');
  const layananTotal = layananItems.reduce((sum, d) => sum + d.total_price, 0);
  const sparepartTotal = sparepartItems.reduce((sum, d) => sum + d.total_price, 0);

  return (
    <div className="space-y-6 max-h-[70vh] overflow-y-auto">
      {/* Header Info */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div><span className="text-industrial-500">No. Nota:</span> <span className="font-mono font-medium ml-2">{transaction.invoice_number}</span></div>
        <div><span className="text-industrial-500">Antrian:</span> <span className="font-mono font-medium ml-2">{transaction.queue_number}</span></div>
        <div><span className="text-industrial-500">Tanggal:</span> <span className="ml-2">{formatIndonesianDate(transaction.transaction_date)}</span></div>
        <div><span className="text-industrial-500">Kasir:</span> <span className="ml-2">{transaction.cashier_name}</span></div>
        <div className="col-span-2"><span className="text-industrial-500">Pelanggan:</span> <span className="ml-2">{transaction.customer_name || '-'}</span></div>
        <div className="col-span-2"><span className="text-industrial-500">Plat:</span> <span className="font-mono font-medium ml-2">{transaction.vehicle_plate}</span></div>
        <div className="col-span-2"><span className="text-industrial-500">Mekanik:</span> <span className="ml-2">{transaction.mechanic_name || '-'}</span></div>
        <div className="col-span-2"><span className="text-industrial-500">Status:</span> <Badge variant={transaction.status === 'Lunas' ? 'success' : 'danger'} className="ml-2">{transaction.status}</Badge></div>
      </div>

      {/* Layanan */}
      {layananItems.length > 0 && (
        <div>
          <h4 className="font-semibold text-accent-700 mb-2 flex items-center gap-2">LAYANAN</h4>
          <div className="space-y-1 text-sm">
            {layananItems.map((item) => (
              <div key={item.id} className="flex justify-between py-1 border-b border-industrial-100">
                <span>{item.item_name} x{item.quantity}</span>
                <span className="font-mono">{formatRupiah(item.total_price)}</span>
              </div>
            ))}
            <div className="flex justify-between font-medium text-accent-700 pt-2">
              <span>Total Layanan</span>
              <span className="font-mono">{formatRupiah(layananTotal)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Sparepart */}
      {sparepartItems.length > 0 && (
        <div>
          <h4 className="font-semibold text-blue-700 mb-2 flex items-center gap-2">SPARE PART</h4>
          <div className="space-y-1 text-sm">
            {sparepartItems.map((item) => (
              <div key={item.id} className="flex justify-between py-1 border-b border-industrial-100">
                <span>{item.item_name} x{item.quantity}</span>
                <span className="font-mono">{formatRupiah(item.total_price)}</span>
              </div>
            ))}
            <div className="flex justify-between font-medium text-blue-700 pt-2">
              <span>Total Sparepart</span>
              <span className="font-mono">{formatRupiah(sparepartTotal)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Totals */}
      <div className="bg-industrial-50 rounded-lg p-4 border border-industrial-200 space-y-2">
        <div className="flex justify-between"><span>Subtotal</span> <span className="font-mono">{formatRupiah(transaction.subtotal)}</span></div>
        <div className="flex justify-between text-danger-600"><span>Diskon</span> <span className="font-mono">- {formatRupiah(transaction.discount)}</span></div>
        <div className="border-t border-industrial-200 pt-2 flex justify-between text-lg font-bold"><span>Total</span> <span className="font-mono text-accent-600">{formatRupiah(transaction.total_amount)}</span></div>
        <div className="flex justify-between"><span>Dibayar</span> <span className="font-mono">{formatRupiah(transaction.paid_amount)}</span></div>
        <div className="flex justify-between text-success-600"><span>Kembalian</span> <span className="font-mono">{formatRupiah(transaction.change_amount)}</span></div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t border-industrial-200">
        <Button variant="secondary" onClick={onPrint}>
          <Printer className="h-4 w-4 mr-2" />
          Cetak Ulang
        </Button>
        {transaction.status === 'Lunas' && (
          <Button variant="danger" onClick={onVoid}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Batalkan Transaksi
          </Button>
        )}
      </div>
    </div>
  );
}