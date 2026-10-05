import { invoke } from '@tauri-apps/api/core';
import { useToast } from './useToast';

export function usePrint() {
  const { success, error } = useToast();

  const printReceipt = async (transactionId: number, printerName?: string, paperWidth = 80) => {
    try {
      await invoke('print_receipt', { transactionId, printerName, paperWidth });
      // The backend handles actual printing via Windows spooler
      // This just confirms the command was sent
      success('Berhasil', 'Struk dikirim ke printer');
      return true;
    } catch (err) {
      error('Gagal Cetak', err instanceof Error ? err.message : 'Terjadi kesalahan saat mencetak');
      return false;
    }
  };

  const getPrinters = async () => {
    try {
      return await invoke('get_printers');
    } catch {
      error('Gagal', 'Tidak dapat mengambil daftar printer');
      return [];
    }
  };

  return { printReceipt, getPrinters };
}
