import { useState } from 'react';
import useSWR from 'swr';
import { Button, Input, Select, Modal, Badge } from '@/components/ui';
import { dbGetEmployees, dbAddEmployee, dbDeleteEmployee, dbGetMechanicMonthlySummary } from '@/hooks/useDatabase';
import { useToast } from '@/hooks/useToast';
import { formatRupiah } from '@/utils/currency';

export default function EmployeesPage() {
  const { data: employees, mutate: reloadEmployees, isLoading: loadingEmployees } = useSWR('employees', dbGetEmployees);
  const { success, error } = useToast();

  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState('mechanic');
  const [phone, setPhone] = useState('');
  const [rate, setRate] = useState('10');
  const [salary, setSalary] = useState('');

  const [tab, setTab] = useState<'staff' | 'commission'>('staff');

  // Commission report state
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const mechanics = (employees ?? []).filter((e) => e.role === 'mechanic' && e.is_active === 1);
  const [selectedMechanic, setSelectedMechanic] = useState<number | ''>('');

  const { data: monthly } = useSWR(
    selectedMechanic ? `commission:${selectedMechanic}:${month}:${year}` : null,
    () => dbGetMechanicMonthlySummary(selectedMechanic as number, month, year)
  );

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await dbAddEmployee({
        name,
        role,
        phone: phone || null,
        commission_rate: parseFloat(rate) || 0,
        base_salary: parseFloat(salary) || 0,
      });
      success('Berhasil', `Karyawan ${name} ditambahkan${role === 'mechanic' ? ' dan muncul di POS' : ''}`);
      setShowAdd(false);
      setName(''); setPhone(''); setRate('10'); setSalary(''); setRole('mechanic');
      reloadEmployees();
      window.dispatchEvent(new CustomEvent('mechanics-changed'));
    } catch (err) {
      error('Gagal', String(err));
    }
  };

  const handleDelete = async (id: number, employeeName: string) => {
    if (!confirm(`Nonaktifkan ${employeeName}? Riwayat transaksi tetap tersimpan.`)) return;
    try {
      await dbDeleteEmployee(id);
      success('Berhasil', `${employeeName} dinonaktifkan`);
      reloadEmployees();
      window.dispatchEvent(new CustomEvent('mechanics-changed'));
    } catch (err) {
      error('Gagal', String(err));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-industrial-900">Karyawan</h1>
        <div className="flex gap-2">
          <Button variant={tab === 'staff' ? 'primary' : 'secondary'} onClick={() => setTab('staff')}>Manajemen Staf</Button>
          <Button variant={tab === 'commission' ? 'primary' : 'secondary'} onClick={() => setTab('commission')}>Laporan Komisi</Button>
        </div>
      </div>

      {tab === 'staff' && (
        <>
          <div className="flex justify-end">
            <Button onClick={() => setShowAdd(true)}>+ Tambah Karyawan</Button>
          </div>
          <div className="bg-white rounded-xl border border-industrial-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-industrial-500 bg-industrial-50">
                  <th className="px-5 py-3">Nama</th>
                  <th className="px-5 py-3">Peran</th>
                  <th className="px-5 py-3">Telepon</th>
                  <th className="px-5 py-3">Komisi</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-industrial-100">
                {loadingEmployees && <tr><td colSpan={6} className="px-5 py-8 text-center text-industrial-400">Memuat…</td></tr>}
                {(employees ?? []).map((emp) => (
                  <tr key={emp.id} className={emp.is_active ? '' : 'opacity-50'}>
                    <td className="px-5 py-3 font-medium text-industrial-900">{emp.name}</td>
                    <td className="px-5 py-3">
                      <Badge variant={emp.role === 'mechanic' ? 'success' : emp.role === 'cashier' ? 'warning' : 'default'}>{emp.role}</Badge>
                    </td>
                    <td className="px-5 py-3 text-industrial-600">{emp.phone ?? '-'}</td>
                    <td className="px-5 py-3 text-industrial-600">{emp.commission_rate}%</td>
                    <td className="px-5 py-3">{emp.is_active ? 'Aktif' : 'Nonaktif'}</td>
                    <td className="px-5 py-3 text-right">
                      {emp.is_active === 1 && (
                        <button onClick={() => handleDelete(emp.id, emp.name)} className="text-sm text-danger-600 hover:underline">
                          Nonaktifkan
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {(employees ?? []).length === 0 && (
                  <tr><td colSpan={6} className="px-5 py-8 text-center text-industrial-400">Belum ada karyawan</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'commission' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Select
              label="Mekanik"
              value={selectedMechanic === '' ? '' : String(selectedMechanic)}
              onChange={(e) => setSelectedMechanic(e.target.value ? Number(e.target.value) : '')}
              options={[
                { value: '', label: 'Pilih mekanik' },
                ...mechanics.map((m) => ({ value: String(m.id), label: m.name })),
              ]}
            />
            <Select
              label="Bulan"
              value={String(month)}
              onChange={(e) => setMonth(Number(e.target.value))}
              options={Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: new Date(2000, i).toLocaleString('id-ID', { month: 'long' }) }))}
            />
            <Select
              label="Tahun"
              value={String(year)}
              onChange={(e) => setYear(Number(e.target.value))}
              options={[0, 1, 2].map((i) => {
                const y = now.getFullYear() - i;
                return { value: String(y), label: String(y) };
              })}
            />
          </div>

          {monthly && (
            <div className="bg-white rounded-xl border border-industrial-200 p-5 shadow-sm">
              <p className="text-sm text-industrial-500">Total Komisi Bulan Ini — {monthly.mechanic_name}</p>
              <p className="text-3xl font-bold text-emerald-600 mt-1">{formatRupiah(monthly.total_commission)}</p>
              <p className="text-xs text-industrial-400 mt-1">{monthly.services_count} layanan · nilai jasa {formatRupiah(monthly.total_services)}</p>
            </div>
          )}

          {monthly && monthly.lines.length > 0 && (
            <div className="bg-white rounded-xl border border-industrial-200 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-industrial-500 bg-industrial-50">
                    <th className="px-5 py-3">Tanggal</th>
                    <th className="px-5 py-3">No. Nota</th>
                    <th className="px-5 py-3">Layanan</th>
                    <th className="px-5 py-3 text-right">Harga</th>
                    <th className="px-5 py-3 text-right">Komisi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-industrial-100">
                  {monthly.lines.map((line, i) => (
                    <tr key={i}>
                      <td className="px-5 py-2.5 text-industrial-600">{line.transaction_date}</td>
                      <td className="px-5 py-2.5 font-mono text-xs text-industrial-500">{line.invoice_number}</td>
                      <td className="px-5 py-2.5 text-industrial-800">{line.service_name}</td>
                      <td className="px-5 py-2.5 text-right font-mono">{formatRupiah(line.price)}</td>
                      <td className="px-5 py-2.5 text-right font-mono font-semibold text-emerald-600">{formatRupiah(line.commission)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {monthly && monthly.lines.length === 0 && (
            <p className="text-sm text-industrial-400 text-center py-8">Tidak ada data komisi pada periode ini</p>
          )}
        </>
      )}

      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Tambah Karyawan">
        <form onSubmit={handleAdd} className="space-y-4">
          <Input label="Nama" value={name} onChange={(e) => setName(e.target.value)} required />
          <Select
            label="Peran"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            options={[
              { value: 'mechanic', label: 'Mekanik' },
              { value: 'cashier', label: 'Kasir' },
              { value: 'admin', label: 'Admin' },
            ]}
          />
          <Input label="Telepon" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Input label="Rate Komisi (%)" type="number" value={rate} onChange={(e) => setRate(e.target.value)} />
          <Input label="Gaji Pokok (opsional)" type="number" value={salary} onChange={(e) => setSalary(e.target.value)} />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setShowAdd(false)}>Batal</Button>
            <Button type="submit">Simpan</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
