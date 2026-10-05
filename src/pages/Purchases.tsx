import { useState } from 'react';
import useSWR from 'swr';
import { Button, Input, Select, Modal, Badge } from '@/components/ui';
import {
  dbGetSuppliers, dbCreateSupplier, dbCreatePurchaseOrder, dbReceivePurchaseOrder, dbGetPurchaseOrders, dbGetSpareparts,
} from '@/hooks/useDatabase';
import { useToast } from '@/hooks/useToast';
import { formatRupiah } from '@/utils/currency';

export default function PurchasesPage() {
  const { data: suppliers, mutate: reloadSuppliers } = useSWR('suppliers', dbGetSuppliers);
  const { data: purchaseOrders, mutate: reloadPOs, isLoading: loadingPOs } = useSWR('purchase-orders', () => dbGetPurchaseOrders());
  const { data: spareparts } = useSWR('spareparts', () => dbGetSpareparts(false));
  const { success, error } = useToast();

  const [tab, setTab] = useState<'po' | 'suppliers'>('po');
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [supplierForm, setSupplierForm] = useState({ name: '', phone: '', address: '', contact_person: '' });
  const [showCreatePO, setShowCreatePO] = useState(false);

  const [poSupplier, setPoSupplier] = useState('');
  const [poItems, setPoItems] = useState<{ sparepart_id: number; name: string; quantity: number; unit_cost: number }[]>([]);
  const [itemSparepart, setItemSparepart] = useState('');
  const [itemQty, setItemQty] = useState('1');
  const [itemCost, setItemCost] = useState('');

  const addItem = () => {
    const part = (spareparts ?? []).find((s) => String(s.id) === itemSparepart);
    const qty = parseInt(itemQty, 10);
    const cost = parseFloat(itemCost);
    if (!part || !qty || qty <= 0 || isNaN(cost) || cost < 0) {
      error('Invalid', 'Pilih sparepart, qty > 0, dan harga beli valid');
      return;
    }
    setPoItems((prev) => [...prev, { sparepart_id: part.id, name: part.name, quantity: qty, unit_cost: cost }]);
    setItemSparepart(''); setItemQty('1'); setItemCost('');
  };

  const submitPO = async () => {
    if (!poSupplier || poItems.length === 0) {
      error('Invalid', 'Pilih supplier dan minimal 1 item');
      return;
    }
    try {
      await dbCreatePurchaseOrder({
        supplier_id: Number(poSupplier),
        created_by: 'Admin',
        items: poItems.map((i) => ({ sparepart_id: i.sparepart_id, quantity: i.quantity, unit_cost: i.unit_cost })),
      });
      success('Berhasil', 'PO dibuat dengan status Pending');
      setShowCreatePO(false);
      setPoItems([]); setPoSupplier('');
      reloadPOs();
    } catch (err) {
      error('Gagal', String(err));
    }
  };

  const receivePO = async (poId: number) => {
    if (!confirm('Terima stok untuk PO ini? Stok sparepart akan bertambah.')) return;
    try {
      await dbReceivePurchaseOrder(poId);
      success('Berhasil', 'Stok diterima dan HPP diperbarui');
      reloadPOs();
    } catch (err) {
      error('Gagal', String(err));
    }
  };

  const pending = (purchaseOrders ?? []).filter((p) => p.status === 'Pending');
  const history = (purchaseOrders ?? []).filter((p) => p.status !== 'Pending');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-industrial-900">Pembelian</h1>
        <div className="flex gap-2">
          <Button variant={tab === 'po' ? 'primary' : 'secondary'} onClick={() => setTab('po')}>Purchase Order</Button>
          <Button variant={tab === 'suppliers' ? 'primary' : 'secondary'} onClick={() => setTab('suppliers')}>Supplier</Button>
        </div>
      </div>

      {tab === 'po' && (
        <>
          <div className="flex justify-end">
            <Button onClick={() => setShowCreatePO(true)}>+ Buat PO</Button>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-industrial-900 mb-3">Pesanan Pending</h2>
            <div className="bg-white rounded-xl border border-industrial-200 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-industrial-500 bg-industrial-50">
                    <th className="px-5 py-3">ID</th>
                    <th className="px-5 py-3">Supplier</th>
                    <th className="px-5 py-3">Tanggal</th>
                    <th className="px-5 py-3">Total</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-industrial-100">
                  {loadingPOs && <tr><td colSpan={6} className="px-5 py-6 text-center text-industrial-400">Memuat…</td></tr>}
                  {pending.length === 0 && !loadingPOs && <tr><td colSpan={6} className="px-5 py-6 text-center text-industrial-400">Tidak ada PO pending</td></tr>}
                  {pending.map((po) => (
                    <tr key={po.id}>
                      <td className="px-5 py-2.5 font-mono">#{po.id}</td>
                      <td className="px-5 py-2.5">{po.supplier_name}</td>
                      <td className="px-5 py-2.5 text-industrial-500">{po.purchase_date}</td>
                      <td className="px-5 py-2.5 font-mono">{formatRupiah(po.total_cost)}</td>
                      <td className="px-5 py-2.5"><Badge variant="warning">Pending</Badge></td>
                      <td className="px-5 py-2.5 text-right">
                        <Button size="sm" variant="success" onClick={() => receivePO(po.id)}>Terima Stok</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-industrial-900 mb-3">Riwayat Pembelian</h2>
            <div className="bg-white rounded-xl border border-industrial-200 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-industrial-500 bg-industrial-50">
                    <th className="px-5 py-3">ID</th>
                    <th className="px-5 py-3">Supplier</th>
                    <th className="px-5 py-3">Tanggal</th>
                    <th className="px-5 py-3">Total</th>
                    <th className="px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-industrial-100">
                  {history.length === 0 && <tr><td colSpan={5} className="px-5 py-6 text-center text-industrial-400">Belum ada riwayat</td></tr>}
                  {history.map((po) => (
                    <tr key={po.id}>
                      <td className="px-5 py-2.5 font-mono">#{po.id}</td>
                      <td className="px-5 py-2.5">{po.supplier_name}</td>
                      <td className="px-5 py-2.5 text-industrial-500">{po.purchase_date}</td>
                      <td className="px-5 py-2.5 font-mono">{formatRupiah(po.total_cost)}</td>
                      <td className="px-5 py-2.5"><Badge variant={po.status === 'Received' ? 'success' : 'danger'}>{po.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'suppliers' && (
        <>
          <div className="flex justify-end">
            <Button onClick={() => setShowAddSupplier(true)}>+ Tambah Supplier</Button>
          </div>
          <div className="bg-white rounded-xl border border-industrial-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-industrial-500 bg-industrial-50">
                  <th className="px-5 py-3">Nama</th>
                  <th className="px-5 py-3">Telepon</th>
                  <th className="px-5 py-3">Alamat</th>
                  <th className="px-5 py-3">PIC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-industrial-100">
                {(suppliers ?? []).map((s) => (
                  <tr key={s.id}>
                    <td className="px-5 py-2.5 font-medium">{s.name}</td>
                    <td className="px-5 py-2.5 text-industrial-600">{s.phone ?? '-'}</td>
                    <td className="px-5 py-2.5 text-industrial-600">{s.address ?? '-'}</td>
                    <td className="px-5 py-2.5 text-industrial-600">{s.contact_person ?? '-'}</td>
                  </tr>
                ))}
                {(suppliers ?? []).length === 0 && <tr><td colSpan={4} className="px-5 py-6 text-center text-industrial-400">Belum ada supplier</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Modal isOpen={showCreatePO} onClose={() => setShowCreatePO(false)} title="Buat Purchase Order" size="lg">
        <div className="space-y-4">
          <Select
            label="Supplier"
            value={poSupplier}
            onChange={(e) => setPoSupplier(e.target.value)}
            options={[{ value: '', label: 'Pilih supplier' }, ...(suppliers ?? []).map((s) => ({ value: String(s.id), label: s.name }))]}
          />
          <div className="grid grid-cols-12 gap-2 items-end">
            <div className="col-span-5">
              <Select
                label="Sparepart"
                value={itemSparepart}
                onChange={(e) => setItemSparepart(e.target.value)}
                options={[{ value: '', label: 'Pilih sparepart' }, ...(spareparts ?? []).map((s) => ({ value: String(s.id), label: `${s.name} (stok ${s.stock})` }))]}
              />
            </div>
            <div className="col-span-3">
              <Input label="Qty" type="number" value={itemQty} onChange={(e) => setItemQty(e.target.value)} />
            </div>
            <div className="col-span-3">
              <Input label="Harga Beli (HPP)" type="number" value={itemCost} onChange={(e) => setItemCost(e.target.value)} />
            </div>
            <div className="col-span-1">
              <Button type="button" variant="secondary" onClick={addItem}>+</Button>
            </div>
          </div>

          {poItems.length > 0 && (
            <table className="w-full text-sm border border-industrial-200 rounded-lg">
              <tbody className="divide-y divide-industrial-100">
                {poItems.map((item, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2">{item.name}</td>
                    <td className="px-3 py-2">×{item.quantity}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatRupiah(item.unit_cost)}</td>
                    <td className="px-3 py-2 text-right font-mono font-semibold">{formatRupiah(item.unit_cost * item.quantity)}</td>
                    <td className="px-3 py-2 text-right">
                      <button className="text-danger-600 text-xs" onClick={() => setPoItems((p) => p.filter((_, idx) => idx !== i))}>Hapus</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="flex justify-between items-center">
            <p className="font-semibold text-industrial-900">
              Total: {formatRupiah(poItems.reduce((sum, i) => sum + i.unit_cost * i.quantity, 0))}
            </p>
            <div className="flex gap-3">
              <Button type="button" variant="secondary" onClick={() => setShowCreatePO(false)}>Batal</Button>
              <Button onClick={submitPO}>Simpan PO</Button>
            </div>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showAddSupplier} onClose={() => setShowAddSupplier(false)} title="Tambah Supplier">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await dbCreateSupplier({
                name: supplierForm.name,
                phone: supplierForm.phone || null,
                address: supplierForm.address || null,
                contact_person: supplierForm.contact_person || null,
              });
              success('Berhasil', 'Supplier ditambahkan');
              setShowAddSupplier(false);
              setSupplierForm({ name: '', phone: '', address: '', contact_person: '' });
              reloadSuppliers();
            } catch (err) {
              error('Gagal', String(err));
            }
          }}
          className="space-y-4"
        >
          <Input label="Nama Supplier" value={supplierForm.name} onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })} required />
          <Input label="Telepon" value={supplierForm.phone} onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })} />
          <Input label="Alamat" value={supplierForm.address} onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })} />
          <Input label="Contact Person" value={supplierForm.contact_person} onChange={(e) => setSupplierForm({ ...supplierForm, contact_person: e.target.value })} />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setShowAddSupplier(false)}>Batal</Button>
            <Button type="submit">Simpan</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
