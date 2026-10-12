import { useState } from 'react';
import useSWR from 'swr';
import { Button, Input, Select, Modal, Badge } from '@/components/ui';
import {
  dbGetEmployees,
  dbAddEmployee,
  dbUpdateEmployee,
  dbDeleteEmployee,
  dbGetWeeklyPayrollPreview,
  dbSaveWeeklyPayroll,
  dbGetHelperDailyLogs,
  dbLogHelperDay,
  dbDeleteHelperDay,
  dbGetWeeklyCommissionSummary,
  dbSaveCommissionLineOverride,
  dbDeleteCommissionLineOverride,
  type Employee,
  type WeeklyCommissionLine,
} from '@/hooks/useDatabase';
import { useToast } from '@/hooks/useToast';
import { formatRupiah } from '@/utils/currency';
import { useAppStore } from '@/stores';

const ROLE_LABELS: Record<string, string> = {
  mechanic: 'Mekanik',
  helper: 'Helper',
  cashier: 'Kasir',
  admin: 'Admin',
};

const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Senin..Minggu dari tanggal berapa pun dalam minggu tersebut. */
const weekRange = (base: Date) => {
  const d = new Date(base);
  d.setDate(d.getDate() - (d.getDay() + 6) % 7);
  const from = toISO(d);
  d.setDate(d.getDate() + 6);
  const to = toISO(d);
  return { from, to };
};

export default function EmployeesPage() {
  const { data: employees, mutate: reloadEmployees, isLoading: loadingEmployees } = useSWR('employees', dbGetEmployees);
  const { success, error } = useToast();

  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);

  const [name, setName] = useState('');
  const [role, setRole] = useState('mechanic');
  const [phone, setPhone] = useState('');
  const [salary, setSalary] = useState('');
  const [dailyRate, setDailyRate] = useState('');

  const [tab, setTab] = useState<'staff' | 'commission' | 'payroll'>('staff');

  // Week navigation: Monday..Sunday, weekOffset 0 = minggu berjalan
  const [weekOffset, setWeekOffset] = useState(0);
  const [weekBase] = useState(() => new Date());
  const week = weekRange(new Date(weekBase.getTime() + weekOffset * 7 * 86400000));

  const staffList = (employees ?? []).filter((e) => e.is_active === 1);
  const helpers = staffList.filter((e) => e.role === 'helper');

  // Commission report state
  const [selectedStaff, setSelectedStaff] = useState<number | ''>('');
  const [editingLine, setEditingLine] = useState<WeeklyCommissionLine | null>(null);
  const [lineEditValue, setLineEditValue] = useState('');
  const [editingWeeklySalary, setEditingWeeklySalary] = useState(false);
  const [weeklySalaryEditValue, setWeeklySalaryEditValue] = useState('');
  const { data: monthly, mutate: reloadCommission } = useSWR(
    selectedStaff ? `commission:${selectedStaff}:${week.from}:${week.to}` : null,
    () => dbGetWeeklyCommissionSummary(selectedStaff as number, week.from, week.to)
  );

  // Payroll state
  const { data: preview, mutate: reloadPreview } = useSWR(`payroll:${week.from}:${week.to}`, () => dbGetWeeklyPayrollPreview(week.from, week.to));
  const [selectedHelper, setSelectedHelper] = useState<number | ''>('');
  const [logDate, setLogDate] = useState(new Date().toISOString().slice(0, 10));
  const [logDays, setLogDays] = useState('1');
  const [logNote, setLogNote] = useState('');
  const [finalEdits, setFinalEdits] = useState<Record<string, string>>({});
  const [weeklySalaryEdits, setWeeklySalaryEdits] = useState<Record<string, string>>({});

  const { data: helperLogs, mutate: reloadLogs } = useSWR(
    selectedHelper ? `helperlogs:${selectedHelper}:${week.from}:${week.to}` : null,
    () => dbGetHelperDailyLogs(selectedHelper as number, week.from, week.to)
  );

  const resetForm = () => {
    setName(''); setPhone(''); setSalary(''); setDailyRate(''); setRole('mechanic');
  };

  const openAdd = () => { resetForm(); setShowAdd(true); };

  const openEdit = (emp: Employee) => {
    setEditing(emp);
    setName(emp.name);
    setRole(emp.role);
    setPhone(emp.phone ?? '');
    setSalary(String(emp.base_salary));
    setDailyRate(String(emp.daily_rate));
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await dbAddEmployee({
        name,
        role,
        phone: phone || null,
        base_salary: role === 'mechanic' ? parseFloat(salary) || 0 : 0,
        daily_rate: role === 'helper' ? parseFloat(dailyRate) || 0 : 0,
      });
      success('Berhasil', `Karyawan ${name} ditambahkan${(role === 'mechanic' || role === 'helper') ? ' dan muncul di POS' : ''}`);
      setShowAdd(false);
      resetForm();
      reloadEmployees();
      window.dispatchEvent(new CustomEvent('mechanics-changed'));
    } catch (err) {
      error('Gagal', String(err));
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    try {
      await dbUpdateEmployee({
        id: editing.id,
        name,
        phone: phone || null,
        base_salary: editing.role === 'mechanic' ? parseFloat(salary) || 0 : editing.base_salary,
        daily_rate: editing.role === 'helper' ? parseFloat(dailyRate) || 0 : editing.daily_rate,
      });
      success('Berhasil', `Data ${name} diperbarui`);
      setEditing(null);
      reloadEmployees();
      reloadPreview();
      reloadCommission();
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
      reloadPreview();
      window.dispatchEvent(new CustomEvent('mechanics-changed'));
    } catch (err) {
      error('Gagal', String(err));
    }
  };

  const handleLogDay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedHelper === '') return;
    try {
      await dbLogHelperDay(selectedHelper, logDate, parseFloat(logDays) || 1, logNote || null);
      success('Berhasil', 'Catatan harian tersimpan');
      setLogDays('1'); setLogNote('');
      reloadLogs();
      reloadPreview();
    } catch (err) {
      error('Gagal', String(err));
    }
  };

  const handleDeleteLog = async (id: number) => {
    if (!confirm('Hapus catatan hari ini?')) return;
    try {
      await dbDeleteHelperDay(id);
      reloadLogs();
      reloadPreview();
    } catch (err) {
      error('Gagal', String(err));
    }
  };

  const finalValue = (empId: number, _fallback: number) => {
    const v = finalEdits[`${empId}:${week.from}`];
    if (v !== undefined) return v;
    const row = preview?.find((p) => p.employee_id === empId);
    return String(row?.existing?.final_amount ?? 0);
  };

  const handleSavePayroll = async (empId: number, status: 'draft' | 'paid') => {
    try {
      const row = preview?.find((p) => p.employee_id === empId);
      const amount = parseFloat(finalValue(empId, row?.base_amount ?? 0)) || 0;
      const weeklySalaryKey = `${empId}:${week.from}:weekly`;
      const weeklySalaryOverride = weeklySalaryEdits[weeklySalaryKey] 
        ? parseFloat(weeklySalaryEdits[weeklySalaryKey]) || null 
        : row?.weekly_salary_override ?? null;
      await dbSaveWeeklyPayroll(empId, week.from, week.to, amount, status, row?.existing?.note ?? null, weeklySalaryOverride);
      success('Berhasil', `Gaji ${row?.employee_name} disimpan${status === 'paid' ? ' & ditandai lunas' : ''}`);
      setFinalEdits((prev) => {
        const next = { ...prev };
        delete next[`${empId}:${week.from}`];
        return next;
      });
      setWeeklySalaryEdits((prev) => {
        const next = { ...prev };
        delete next[`${empId}:${week.from}:weekly`];
        return next;
      });
      reloadPreview();
    } catch (err) {
      error('Gagal', String(err));
    }
  };

  const startEditLine = (line: WeeklyCommissionLine) => {
    setEditingLine(line);
    setLineEditValue(String(line.commission));
  };

  const cancelEditLine = () => {
    setEditingLine(null);
    setLineEditValue('');
  };

  const saveLineEdit = async () => {
    if (!editingLine || selectedStaff === '') return;
    try {
      const amount = parseFloat(lineEditValue) || 0;
      await dbSaveCommissionLineOverride(
        editingLine.line_kind,
        editingLine.line_id,
        selectedStaff as number,
        amount,
        null
      );
      success('Berhasil', 'Komisi baris disimpan & dipakai sebagai dasar di tab Gaji');
      cancelEditLine();
      reloadCommission();
      reloadPreview();
    } catch (err) {
      error('Gagal', String(err));
    }
  };

  const resetLine = async (line: WeeklyCommissionLine) => {
    try {
      await dbDeleteCommissionLineOverride(line.line_kind, line.line_id);
      success('Berhasil', 'Komisi baris dihapus');
      reloadCommission();
      reloadPreview();
    } catch (err) {
      error('Gagal', String(err));
    }
  };

  // Weekly salary edit handlers
  const startEditWeeklySalary = (amount: number) => {
    setEditingWeeklySalary(true);
    setWeeklySalaryEditValue(String(amount));
  };

  const cancelEditWeeklySalary = () => {
    setEditingWeeklySalary(false);
    setWeeklySalaryEditValue('');
  };

  const saveWeeklySalaryEdit = async () => {
    if (selectedStaff === '') return;
    try {
      const amount = parseFloat(weeklySalaryEditValue) || 0;
      const row = preview?.find((p) => p.employee_id === selectedStaff);
      await dbSaveWeeklyPayroll(
        selectedStaff,
        week.from,
        week.to,
        row?.existing?.final_amount ?? row?.base_amount ?? 0,
        row?.existing?.status ?? 'draft',
        row?.existing?.note ?? null,
        amount
      );
      success('Berhasil', 'Gaji mingguan disimpan & dipakai sebagai dasar');
      // Optimistic update: immediately reflect the saved value in local state
      // so print section shows the correct value before SWR re-fetch
      const weeklySalaryKey = `${selectedStaff}:${week.from}:weekly`;
      setWeeklySalaryEdits((prev) => ({ ...prev, [weeklySalaryKey]: String(amount) }));
      cancelEditWeeklySalary();
      reloadCommission();
      reloadPreview();
    } catch (err) {
      error('Gagal', String(err));
    }
  };

  const totalPayroll = (preview ?? []).reduce((sum, p) => sum + (parseFloat(finalValue(p.employee_id, p.base_amount)) || 0), 0);

  const weekNav = (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-medium text-industrial-700">Minggu</span>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setWeekOffset((o) => o - 1)}>‹</Button>
        <span className="font-mono text-sm text-industrial-700">{week.from} s/d {week.to}</span>
        <Button type="button" variant="outline" size="sm" onClick={() => setWeekOffset((o) => o + 1)}>›</Button>
        {weekOffset !== 0 && (
          <Button type="button" variant="secondary" size="sm" onClick={() => setWeekOffset(0)}>Minggu Ini</Button>
        )}
      </div>
    </div>
  );

  // Print state for commission sheet
  const [isPrinting, setIsPrinting] = useState(false);

  const handlePrintCommission = () => {
    if (!monthly) return;
    setIsPrinting(true);
    document.body.classList.add('printing-sheet');
    const cleanup = () => {
      document.body.classList.remove('printing-sheet');
      setIsPrinting(false);
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    setTimeout(() => window.print(), 50);
  };

  const settings = useAppStore((s) => s.settings);
  const shopName = settings?.shop_name ?? 'BENGKEL';
  const shopAddress = settings?.shop_address ?? '';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-industrial-900">Karyawan</h1>
        <div className="flex gap-2">
          <Button variant={tab === 'staff' ? 'primary' : 'secondary'} onClick={() => setTab('staff')}>Manajemen Staf</Button>
          <Button variant={tab === 'commission' ? 'primary' : 'secondary'} onClick={() => setTab('commission')}>Laporan Komisi</Button>
          <Button variant={tab === 'payroll' ? 'primary' : 'secondary'} onClick={() => setTab('payroll')}>Gaji</Button>
        </div>
        <div className="flex gap-2 ml-auto">
          {tab === 'commission' && monthly && (
            <Button
              variant="secondary"
              onClick={handlePrintCommission}
              disabled={isPrinting}
              className="no-print"
            >
              Cetak Laporan
            </Button>
          )}
        </div>
      </div>

      {tab === 'staff' && (
        <>
          <div className="flex justify-end">
            <Button onClick={openAdd}>+ Tambah Karyawan</Button>
          </div>
          <div className="bg-white rounded-xl border border-industrial-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-industrial-500 bg-industrial-50">
                  <th className="px-5 py-3">Nama</th>
                  <th className="px-5 py-3">Peran</th>
                  <th className="px-5 py-3">Telepon</th>
                  <th className="px-5 py-3">Tarif Harian</th>
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
                      <Badge variant={emp.role === 'mechanic' || emp.role === 'helper' ? 'success' : emp.role === 'cashier' ? 'warning' : 'default'}>
                        {ROLE_LABELS[emp.role] ?? emp.role}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-industrial-600">{emp.phone ?? '-'}</td>
                    <td className="px-5 py-3 text-industrial-600">
                      {emp.role === 'helper' && `${formatRupiah(emp.daily_rate)}/hari`}
                      {emp.role === 'mechanic' && emp.base_salary > 0 && (
                        <span className="block text-xs text-industrial-400">Pokok {formatRupiah(emp.base_salary)}</span>
                      )}
                      {(emp.role === 'cashier' || emp.role === 'admin') && '-'}
                    </td>
                    <td className="px-5 py-3">{emp.is_active ? 'Aktif' : 'Nonaktif'}</td>
                    <td className="px-5 py-3 text-right space-x-3">
                      {emp.is_active === 1 && (
                        <>
                          <button onClick={() => openEdit(emp)} className="text-sm text-industrial-600 hover:underline">
                            Ubah
                          </button>
                          <button onClick={() => handleDelete(emp.id, emp.name)} className="text-sm text-danger-600 hover:underline">
                            Nonaktifkan
                          </button>
                        </>
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
        <div className="print-sheet">
          <div className="no-print">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
              <Select
                label="Karyawan"
                value={selectedStaff === '' ? '' : String(selectedStaff)}
                onChange={(e) => setSelectedStaff(e.target.value ? Number(e.target.value) : '')}
                options={[
                  { value: '', label: 'Pilih karyawan' },
                  ...staffList.map((s) => ({ value: String(s.id), label: `${s.name} (${ROLE_LABELS[s.role] ?? s.role})` })),
                ]}
              />
              <div className="sm:col-span-2">{weekNav}</div>
            </div>
          </div>

          <div className="print-only">
            <div className="text-center mb-4">
              <div className="font-bold text-lg">{shopName}</div>
              <div className="text-sm text-industrial-600">{shopAddress}</div>
            </div>
            <div className="text-center mb-2">
              <div className="font-bold text-base">LAPORAN KOMISI</div>
              <div className="text-sm text-industrial-600">{monthly?.employee_name ?? ''} — {week.from} s/d {week.to}</div>
            </div>
            <hr className="border-industrial-300 my-2" />
          </div>

          {monthly && (
            <div className="bg-white rounded-xl border border-industrial-200 p-5 shadow-sm flex items-center justify-between flex-wrap gap-4 no-print">
              <div>
                <p className="text-sm text-industrial-500">
                  {monthly.role === 'mechanic' ? 'Total Komisi Efektif' : 'Total Upah Mingguan'} — {monthly.employee_name}
                </p>
                <p className="text-2xl font-bold text-emerald-600 mt-1">{formatRupiah(monthly.effective_total)}</p>
                <p className="text-xs text-industrial-400 mt-1">
                  {monthly.lines.length} baris · total manual
                </p>
              </div>
              <div className="flex items-center gap-4">
                {(() => {
                  const selectedEmployee = staffList.find((s) => s.id === Number(selectedStaff));
                  const isMechanic = selectedEmployee?.role === 'mechanic';
                  const weeklySalary = isMechanic
                    ? (selectedEmployee?.base_salary ?? 0) / 4
                    : (monthly.system_amount ?? 0);
                  const komisi = isMechanic ? (monthly.effective_total ?? 0) : 0;
                  const jumlah = weeklySalary + komisi;
                  const existingPayroll = preview?.find((p) => p.employee_id === Number(selectedStaff));
                  const overrideValue = existingPayroll?.weekly_salary_override ?? null;
                  // Check local edit state for immediate feedback
                  const localEditKey = `${selectedStaff}:${week.from}:weekly`;
                  const localEditValue = weeklySalaryEdits[localEditKey];
                  const displayWeeklySalary = localEditValue !== undefined
                    ? parseFloat(localEditValue) || 0
                    : (overrideValue !== null ? overrideValue : weeklySalary);
                  const isOverridden = overrideValue !== null || localEditValue !== undefined;

                  return (
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-xs text-industrial-500">
                          {isMechanic ? 'Gaji Pokok Mingguan' : 'Upah Mingguan (Harian)'}
                          {isOverridden && <span className="ml-1 text-emerald-600">(Manual)</span>}
                        </p>
                        {editingWeeklySalary ? (
                          <input
                            type="number"
                            className="w-36 px-2 py-1 border border-industrial-300 rounded-lg text-right font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                            value={weeklySalaryEditValue}
                            onChange={(e) => setWeeklySalaryEditValue(e.target.value)}
                            autoFocus
                          />
                        ) : (
                          <p className="text-lg font-bold text-industrial-900">{formatRupiah(displayWeeklySalary)}</p>
                        )}
                      </div>
                      {editingWeeklySalary ? (
                        <>
                          <button onClick={saveWeeklySalaryEdit} className="text-sm text-emerald-600 font-medium hover:underline">Simpan</button>
                          <button onClick={cancelEditWeeklySalary} className="text-sm text-industrial-500 hover:underline">Batal</button>
                        </>
                      ) : (
                        <button onClick={() => startEditWeeklySalary(displayWeeklySalary)} className="text-sm text-primary-600 hover:underline">Edit</button>
                      )}
                    </div>
                  );
                })()}
              </div>
              {monthly.lines.some((l) => l.is_edited) && (
                <p className="text-xs text-emerald-600 max-w-[14rem] text-right">
                  Ada komisi hasil edit manual — dipakai sebagai dasar di tab Gaji
                </p>
              )}
            </div>
          )}

          {monthly && monthly.lines.length > 0 && (
            <div className="bg-white rounded-xl border border-industrial-200 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-industrial-500 bg-industrial-50">
                    <th className="px-5 py-3">Tanggal</th>
                    {monthly.role === 'mechanic' && <th className="px-5 py-3 no-print">No. Nota</th>}
                    {monthly.role === 'mechanic' && <th className="px-5 py-3 no-print">Jenis</th>}
                    <th className="px-5 py-3">{monthly.role === 'mechanic' ? 'Item' : 'Keterangan'}</th>
                    <th className="px-5 py-3 text-right no-print">{monthly.role === 'mechanic' ? 'Harga' : 'Jumlah'}</th>
                    <th className="px-5 py-3 text-right">{monthly.role === 'mechanic' ? 'Komisi' : 'Upah'}</th>
                    <th className="px-5 py-3 text-right no-print">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-industrial-100">
                  {monthly.lines.map((line) => {
                    const isEditing = editingLine?.line_kind === line.line_kind && editingLine?.line_id === line.line_id;
                    return (
                      <tr key={`${line.line_kind}-${line.line_id}`} className={line.is_edited ? 'bg-emerald-50/40' : ''}>
                        <td className="px-5 py-2.5 text-industrial-600">{line.line_date}</td>
                        {monthly.role === 'mechanic' && (
                          <td className="px-5 py-2.5 font-mono text-xs text-industrial-500 no-print">{line.invoice_number}</td>
                        )}
                        {monthly.role === 'mechanic' && (
                          <td className="px-5 py-2.5 no-print">
                            <Badge variant={line.item_type === 'sparepart' ? 'warning' : 'success'}>
                              {line.item_type === 'sparepart' ? 'Sparepart' : 'Layanan'}
                            </Badge>
                          </td>
                        )}
                        <td className="px-5 py-2.5 text-industrial-800">{line.item_name}</td>
                        <td className="px-5 py-2.5 text-right font-mono no-print">{formatRupiah(line.amount)}</td>
                        <td className="px-5 py-2.5 text-right font-mono font-semibold text-emerald-600">
                          {isEditing ? (
                            <input
                              type="number"
                              className="w-32 px-2 py-1 border border-industrial-300 rounded-lg text-right font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                              value={lineEditValue}
                              onChange={(e) => setLineEditValue(e.target.value)}
                              autoFocus
                            />
                          ) : (
                            <>
                              {formatRupiah(line.commission)}
                            </>
                          )}
                        </td>
                        <td className="px-5 py-2.5 text-right space-x-2 whitespace-nowrap no-print">
                          {isEditing ? (
                            <>
                              <button onClick={saveLineEdit} className="text-sm text-emerald-600 font-medium hover:underline">Simpan</button>
                              <button onClick={cancelEditLine} className="text-sm text-industrial-500 hover:underline">Batal</button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => startEditLine(line)} className="text-sm text-primary-600 hover:underline">Edit</button>
                              {line.is_edited && (
                                <button onClick={() => resetLine(line)} className="text-sm text-danger-600 hover:underline">Hapus</button>
                              )}
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {monthly && monthly.lines.length === 0 && (
            <p className="text-sm text-industrial-400 text-center py-8">Tidak ada data pada minggu ini</p>
          )}

          <div className="print-only mt-6">
            {(() => {
              const selectedEmployee = staffList.find((s) => s.id === Number(selectedStaff));
              const isMechanic = selectedEmployee?.role === 'mechanic';
              const weeklySalary = isMechanic
                ? (selectedEmployee?.base_salary ?? 0) / 4
                : (monthly?.system_amount ?? 0);
              const komisi = isMechanic ? (monthly?.effective_total ?? 0) : 0;
              const existingPayroll = preview?.find((p) => p.employee_id === Number(selectedStaff));
              const overrideValue = existingPayroll?.weekly_salary_override ?? null;
              // Check local edit state for immediate feedback before SWR refresh
              const localEditKey = `${selectedStaff}:${week.from}:weekly`;
              const localEditValue = weeklySalaryEdits[localEditKey];
              const displayWeeklySalary = localEditValue !== undefined
                ? parseFloat(localEditValue) || 0
                : (overrideValue !== null ? overrideValue : weeklySalary);
              const jumlah = displayWeeklySalary + komisi;

              return (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 border-t border-industrial-300 pt-4">
                    <div>
                      <div className="text-xs text-industrial-500">
                        {isMechanic ? 'Gaji Pokok Mingguan' : 'Upah Mingguan (Harian)'}
                      </div>
                      <div className="font-medium text-industrial-900">{formatRupiah(displayWeeklySalary)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-industrial-500">Komisi</div>
                      <div className="font-medium text-emerald-600">{formatRupiah(komisi)}</div>
                    </div>
                    <div className="col-span-2 text-right border-t border-industrial-300 pt-4">
                      <div className="text-xs text-industrial-500">Jumlah</div>
                      <div className="font-bold text-lg text-emerald-600">{formatRupiah(jumlah)}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-8 mt-8">
                    <div>
                      <div className="text-xs text-industrial-500">Dibuat oleh</div>
                      <div className="font-medium mt-8 border-t border-industrial-300 pt-2">{shopName}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-industrial-500">Tanggal Cetak</div>
                      <div className="font-medium mt-8 border-t border-industrial-300 pt-2">
                        {new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {tab === 'payroll' && (
        <>
          <div className="flex items-end gap-4">
            {weekNav}
          </div>

          {/* Helper daily attendance */}
          <div className="bg-white rounded-xl border border-industrial-200 shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-industrial-900">Catatan Harian Helper</h2>
              {helperLogs && (
                <p className="text-sm text-industrial-500">
                  {helperLogs.total_days} hari · <span className="font-semibold text-emerald-600">{formatRupiah(helperLogs.total_amount)}</span>
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <Select
                label="Helper"
                value={selectedHelper === '' ? '' : String(selectedHelper)}
                onChange={(e) => setSelectedHelper(e.target.value ? Number(e.target.value) : '')}
                options={[
                  { value: '', label: 'Pilih helper' },
                  ...helpers.map((h) => ({ value: String(h.id), label: h.name })),
                ]}
              />
              <Input label="Tanggal" type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)} />
              <Input label="Jumlah Hari" type="number" step="0.5" min="0" value={logDays} onChange={(e) => setLogDays(e.target.value)} />
              <div className="flex gap-2">
                <Button type="button" onClick={handleLogDay} disabled={selectedHelper === ''}>Catat</Button>
              </div>
            </div>
            <Input label="Catatan (opsional)" value={logNote} onChange={(e) => setLogNote(e.target.value)} placeholder="mis. setengah hari" />

            {selectedHelper && helperLogs && (
              helperLogs.logs.length > 0 ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-industrial-500 bg-industrial-50">
                      <th className="px-4 py-2.5">Tanggal</th>
                      <th className="px-4 py-2.5 text-right">Hari</th>
                      <th className="px-4 py-2.5 text-right">Tarif</th>
                      <th className="px-4 py-2.5 text-right">Jumlah</th>
                      <th className="px-4 py-2.5">Catatan</th>
                      <th className="px-4 py-2.5 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-industrial-100">
                    {helperLogs.logs.map((log) => (
                      <tr key={log.id}>
                        <td className="px-4 py-2.5 text-industrial-700">{log.work_date}</td>
                        <td className="px-4 py-2.5 text-right font-mono">{log.days}</td>
                        <td className="px-4 py-2.5 text-right font-mono">{formatRupiah(log.rate)}</td>
                        <td className="px-4 py-2.5 text-right font-mono font-semibold">{formatRupiah(log.days * log.rate)}</td>
                        <td className="px-4 py-2.5 text-industrial-500">{log.note ?? '-'}</td>
                        <td className="px-4 py-2.5 text-right">
                          <button onClick={() => handleDeleteLog(log.id)} className="text-sm text-danger-600 hover:underline">Hapus</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-industrial-400 text-center py-4">Belum ada catatan harian minggu ini</p>
              )
            )}
          </div>

          {/* Monthly payroll */}
          <div className="bg-white rounded-xl border border-industrial-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-industrial-100">
              <h2 className="font-semibold text-industrial-900">Gaji Mingguan {week.from} – {week.to}</h2>
              <p className="text-sm text-industrial-500">
                Total:{' '}
                <span className="font-semibold text-industrial-900">{formatRupiah(totalPayroll)}</span>
              </p>
            </div>
            {!preview && <p className="px-5 py-8 text-center text-industrial-400 text-sm">Memuat…</p>}
            {preview && preview.length === 0 && (
              <p className="px-5 py-8 text-center text-industrial-400 text-sm">Tidak ada mekanik/helper aktif</p>
            )}
            {preview && preview.length > 0 && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-industrial-500 bg-industrial-50">
                    <th className="px-5 py-3">Nama</th>
                    <th className="px-5 py-3">Peran</th>
                    <th className="px-5 py-3 text-right">Gaji Pokok Mingguan</th>
                    <th className="px-5 py-3 text-right">Total Gaji</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-industrial-100">
                  {preview.map((p) => {
                    const isMechanic = p.role === 'mechanic';
                    const baseWeeklySalary = isMechanic ? p.weekly_base_salary : p.daily_amount;
                    const weeklySalaryOverride = p.weekly_salary_override ?? null;
                    const displayWeeklySalary = weeklySalaryOverride !== null ? weeklySalaryOverride : baseWeeklySalary;
                    const isWeeklyOverridden = weeklySalaryOverride !== null;
                    const weeklySalaryKey = `${p.employee_id}:${week.from}:weekly`;
                    const editingWeekly = weeklySalaryEdits[weeklySalaryKey] !== undefined;
                    const weeklySalaryValue = editingWeekly ? weeklySalaryEdits[weeklySalaryKey] : String(displayWeeklySalary);

                    return (
                      <tr key={p.employee_id}>
                        <td className="px-5 py-3 font-medium text-industrial-900">{p.employee_name}</td>
                        <td className="px-5 py-3">
                          <Badge variant={p.role === 'mechanic' ? 'success' : 'warning'}>{ROLE_LABELS[p.role] ?? p.role}</Badge>
                        </td>
                        <td className="px-5 py-3 text-right">
                          {editingWeekly ? (
                            <input
                              type="number"
                              className="w-36 px-3 py-1.5 border border-industrial-300 rounded-lg text-right font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                              value={weeklySalaryValue}
                              onChange={(e) => setWeeklySalaryEdits((prev) => ({ ...prev, [weeklySalaryKey]: e.target.value }))}
                              autoFocus
                            />
                          ) : (
                            <>
                              <span className="font-mono">{formatRupiah(displayWeeklySalary)}</span>
                              {isWeeklyOverridden && <span className="ml-1 text-xs text-emerald-600">(Manual)</span>}
                            </>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <input
                            type="number"
                            className="w-40 px-3 py-1.5 border border-industrial-300 rounded-lg text-right font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                            value={finalValue(p.employee_id, p.base_amount)}
                            onChange={(e) => setFinalEdits((prev) => ({ ...prev, [`${p.employee_id}:${week.from}`]: e.target.value }))}
                          />
                        </td>
                        <td className="px-5 py-3">
                          {p.existing?.status === 'paid'
                            ? <Badge variant="success">Lunas</Badge>
                            : p.existing
                              ? <Badge variant="warning">Draft</Badge>
                              : <span className="text-xs text-industrial-400">Belum ada</span>}
                        </td>
                        <td className="px-5 py-3 text-right space-x-2">
                          <Button size="sm" variant="outline" onClick={() => handleSavePayroll(p.employee_id, 'draft')}>Simpan</Button>
                          <Button size="sm" variant="success" onClick={() => handleSavePayroll(p.employee_id, 'paid')}>Lunas</Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
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
              { value: 'helper', label: 'Helper' },
              { value: 'cashier', label: 'Kasir' },
              { value: 'admin', label: 'Admin' },
            ]}
          />
          <Input label="Telepon" value={phone} onChange={(e) => setPhone(e.target.value)} />
          {role === 'mechanic' && (
            <Input label="Gaji Pokok" type="number" value={salary} onChange={(e) => setSalary(e.target.value)} placeholder="mis. 1500000" />
          )}
          {role === 'helper' && (
            <Input label="Tarif Harian" type="number" value={dailyRate} onChange={(e) => setDailyRate(e.target.value)} placeholder="mis. 100000" />
          )}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setShowAdd(false)}>Batal</Button>
            <Button type="submit">Simpan</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!editing} onClose={() => setEditing(null)} title="Ubah Karyawan">
        {editing && (
          <form onSubmit={handleUpdate} className="space-y-4">
            <Input label="Nama" value={name} onChange={(e) => setName(e.target.value)} required />
            <Input label="Telepon" value={phone} onChange={(e) => setPhone(e.target.value)} />
            {editing.role === 'mechanic' && (
              <>
                <Input label="Gaji Pokok" type="number" value={salary} onChange={(e) => setSalary(e.target.value)} />
              </>
            )}
            {editing.role === 'helper' && (
              <Input label="Tarif Harian" type="number" value={dailyRate} onChange={(e) => setDailyRate(e.target.value)} />
            )}
            <p className="text-xs text-industrial-400">Peran tidak dapat diubah. Peran: {ROLE_LABELS[editing.role] ?? editing.role}</p>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setEditing(null)}>Batal</Button>
              <Button type="submit">Simpan</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
