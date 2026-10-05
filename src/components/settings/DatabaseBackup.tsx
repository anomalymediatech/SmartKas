import { useState } from 'react';
import { save, open } from '@tauri-apps/plugin-dialog';
import { Button } from '@/components/ui';
import { dbBackupDatabase, dbRestoreDatabase, dbInit } from '@/hooks/useDatabase';
import { useToast } from '@/hooks/useToast';

export function DatabaseBackup() {
  const { success, error } = useToast();
  const [busy, setBusy] = useState(false);

  const handleBackup = async () => {
    const path = await save({
      title: 'Simpan Backup Database',
      defaultPath: `smartkas-backup-${new Date().toISOString().slice(0, 10)}.db`,
      filters: [{ name: 'Database', extensions: ['db'] }],
    });
    if (!path) return;
    setBusy(true);
    try {
      await dbBackupDatabase(path);
      success('Berhasil', `Backup disimpan ke ${path}`);
    } catch (err) {
      error('Gagal Backup', err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleRestore = async () => {
    const path = await open({
      title: 'Pilih File Backup',
      multiple: false,
      filters: [{ name: 'Database', extensions: ['db'] }],
    });
    if (!path || Array.isArray(path)) return;
    if (!confirm('Restore akan menggantikan database saat ini. Lanjutkan?')) return;
    setBusy(true);
    try {
      await dbRestoreDatabase(path);
      await dbInit();
      success('Berhasil', 'Database berhasil dipulihkan, silakan muat ulang data');
    } catch (err) {
      error('Gagal Restore', err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-industrial-200 p-6">
      <h3 className="text-lg font-semibold text-industrial-900 mb-2">Backup & Restore Database</h3>
      <p className="text-sm text-industrial-500 mb-6">Cadangkan database SQLite atau pulihkan dari file backup.</p>
      <div className="flex gap-3">
        <Button variant="secondary" onClick={handleBackup} loading={busy}>Backup Database</Button>
        <Button variant="danger" onClick={handleRestore} loading={busy}>Restore Database</Button>
      </div>
    </div>
  );
}
