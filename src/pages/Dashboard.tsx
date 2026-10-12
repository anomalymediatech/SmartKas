import useSWR from 'swr';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { TrendingUp, Receipt, Wallet, AlertTriangle, Wrench } from 'lucide-react';
import {
  dbGetDailySummary,
  dbGetLowStockItems,
  dbGetMechanicPerformance,
  dbGetSalesTrend,
  dbGetTopSpareparts,
} from '@/hooks/useDatabase';
import { formatRupiah } from '@/utils/currency';

const LOW_STOCK_THRESHOLD = 5;

export default function DashboardPage() {
  const { data: summary, isLoading: loadingSummary } = useSWR('dashboard:summary', () => dbGetDailySummary(), { refreshInterval: 15000 });
  const { data: lowStock } = useSWR('dashboard:lowstock', () => dbGetLowStockItems(LOW_STOCK_THRESHOLD), { refreshInterval: 15000 });
  const today = new Date().toISOString().slice(0, 10);
  const { data: mechanics } = useSWR('dashboard:mechanics', () => dbGetMechanicPerformance(today, today), { refreshInterval: 15000 });
  const { data: trend } = useSWR('dashboard:trend', () => dbGetSalesTrend(7), { refreshInterval: 30000 });
  const { data: topParts } = useSWR('dashboard:topparts', () => dbGetTopSpareparts(30, 5), { refreshInterval: 60000 });

  const cards = [
    { label: 'Omzet Hari Ini', value: summary ? formatRupiah(summary.total_omzet) : '—', icon: TrendingUp, color: 'text-accent-600 bg-accent-100' },
    { label: 'Jumlah Transaksi', value: summary ? String(summary.total_transactions) : '—', icon: Receipt, color: 'text-industrial-600 bg-industrial-100' },
    { label: 'Laba Kotor', value: summary ? formatRupiah(summary.gross_profit) : '—', icon: Wallet, color: 'text-emerald-600 bg-emerald-100' },
    { label: 'Stok Kritis', value: lowStock ? String(lowStock.length) : '—', icon: AlertTriangle, color: 'text-red-600 bg-red-100' },
  ];

  const chartData = (trend ?? []).map((p) => ({
    date: p.date.slice(5),
    total: p.total_amount,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-industrial-900">Dashboard</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-xl border border-industrial-200 p-5 shadow-sm">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${c.color}`}>
              <c.icon className="h-5 w-5" />
            </div>
            <p className="text-sm text-industrial-500">{c.label}</p>
            <p className="text-xl font-bold text-industrial-900 mt-1">{loadingSummary && c.value === '—' ? '…' : c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-industrial-200 p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-industrial-900 mb-4">Tren Penjualan 7 Hari Terakhir</h2>
          {chartData.length === 0 ? (
            <p className="text-sm text-industrial-400 py-16 text-center">Belum ada data penjualan</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} tick={{ fontSize: 12 }} width={48} />
                <Tooltip formatter={(v) => formatRupiah(Number(v))} />
                <Bar dataKey="total" fill="#16a34a" radius={[4, 4, 0, 0]} name="Omzet" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-xl border border-industrial-200 p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-industrial-900 mb-4">Mekanik Teraktif Hari Ini</h2>
          {!mechanics || mechanics.length === 0 ? (
            <p className="text-sm text-industrial-400 py-10 text-center">Belum ada layanan tercatat</p>
          ) : (
            <ul className="divide-y divide-industrial-100">
              {mechanics.map((m) => (
                <li key={m.mechanic_name} className="flex items-center justify-between py-2.5">
                  <span className="flex items-center gap-2 text-industrial-700">
                    <Wrench className="h-4 w-4 text-industrial-400" />
                    {m.mechanic_name}
                  </span>
                  <span className="font-mono font-semibold text-industrial-900">{m.services_handled}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-industrial-200 p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-industrial-900 mb-4">Peringatan Stok Menipis</h2>
        {!lowStock || lowStock.length === 0 ? (
          <p className="text-sm text-industrial-400 py-6 text-center">Semua stok aman</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-industrial-500 border-b border-industrial-100">
                <th className="pb-2">Nama Sparepart</th>
                <th className="pb-2">Harga Jual</th>
                <th className="pb-2 text-right">Stok</th>
              </tr>
            </thead>
            <tbody>
              {lowStock.map((item) => (
                <tr key={item.id} className={item.stock <= 0 ? 'bg-red-50' : 'bg-orange-50/50'}>
                  <td className="py-2 font-medium text-industrial-800">{item.name}</td>
                  <td className="py-2 font-mono text-industrial-600">{formatRupiah(item.sell_price)}</td>
                  <td className={`py-2 text-right font-mono font-bold ${item.stock <= 0 ? 'text-red-600' : 'text-orange-600'}`}>
                    {item.stock}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="bg-white rounded-xl border border-industrial-200 p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-industrial-900 mb-4">Barang Paling Laku — 30 Hari Terakhir</h2>
        {!topParts || topParts.length === 0 ? (
          <p className="text-sm text-industrial-400 py-6 text-center">Belum ada penjualan sparepart 30 hari terakhir</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-industrial-500 border-b border-industrial-100">
                <th className="pb-2 w-10">#</th>
                <th className="pb-2">Nama Sparepart</th>
                <th className="pb-2 text-right">Terjual</th>
                <th className="pb-2 text-right">Omzet</th>
                <th className="pb-2 text-right">Stok Saat Ini</th>
              </tr>
            </thead>
            <tbody>
              {topParts.map((item, i) => (
                <tr key={item.name} className="border-b border-industrial-50">
                  <td className="py-2 font-mono text-industrial-400">{i + 1}</td>
                  <td className="py-2 font-medium text-industrial-800">{item.name}</td>
                  <td className="py-2 text-right font-mono font-semibold text-industrial-900">{item.qty_sold} pcs</td>
                  <td className="py-2 text-right font-mono text-industrial-600">{formatRupiah(item.revenue)}</td>
                  <td className={`py-2 text-right font-mono font-bold ${item.stock == null ? 'text-industrial-400' : item.stock <= 0 ? 'text-red-600' : item.stock <= 5 ? 'text-orange-600' : 'text-emerald-600'}`}>
                    {item.stock == null ? '—' : `${item.stock} pcs`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
