import { useEffect, useRef, useState } from 'react';
import { CustomerInput } from './CustomerInput';
import { LayananPanel } from './LayananPanel';
import { SparepartPanel } from './SparepartPanel';
import { CartSummary } from './CartSummary';
import { TutupKasirModal } from './TutupKasirModal';
import { usePOSStore } from '@/stores';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useToast } from '@/hooks/useToast';

export function POSView() {
  const { 
    resetPOS, 
    loadNextQueueNumber,
    queueNumber,
  } = usePOSStore();
  const [showTutupKasir, setShowTutupKasir] = useState(false);

  const { success, error } = useToast();
  useKeyboardShortcuts();

  useEffect(() => {
    // Load next queue number on mount
    loadNextQueueNumber();
  }, [loadNextQueueNumber]);

  const handleCheckoutSuccess = (result: { success: boolean; transactionId?: number; invoiceNumber?: string }) => {
      if (result.success) {
      success('Berhasil', `Transaksi ${result.invoiceNumber} berhasil disimpan`);
      resetPOS();
      if (result.transactionId) {
        window.dispatchEvent(new CustomEvent('print-receipt', { detail: result.transactionId }));
      }
    } else {
      error('Gagal', 'Terjadi kesalahan saat menyimpan transaksi');
    }
  };

  // Patch checkout once to handle success (stable: no store-identity dependency)
  const handleCheckoutSuccessRef = useRef(handleCheckoutSuccess);

  useEffect(() => {
    handleCheckoutSuccessRef.current = handleCheckoutSuccess;
  });

  useEffect(() => {
    const originalCheckout = usePOSStore.getState().checkout;
    usePOSStore.setState({
      checkout: async () => {
        const result = await originalCheckout();
        handleCheckoutSuccessRef.current(result);
        return result;
      },
    });
    return () => {
      usePOSStore.setState({ checkout: originalCheckout });
    };
  }, []);

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col gap-4">
      {/* POS header: queue + tutup kasir */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-industrial-200 px-3 py-2">
        <div className="flex items-center gap-3">
          <span className="text-sm text-industrial-500">Antrian saat ini</span>
          <span className="text-xl font-bold font-mono text-accent-600">#{queueNumber}</span>
        </div>
        <button
          onClick={() => setShowTutupKasir(true)}
          className="px-4 py-2 rounded-lg border border-industrial-300 text-xs font-medium text-industrial-700 hover:bg-industrial-50"
        >
          Tutup Hari Ini
        </button>
      </div>

      {/* Customer Input Section */}
      <CustomerInput />

      {/* Middle Section - kiri: item, kanan: checkout */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 overflow-hidden min-h-0">
        {/* Left: Layanan + Sparepart (scroll internal, stacked) */}
        <div className="lg:w-[62%] flex flex-col lg:flex-row gap-4 min-w-0 min-h-0">
          <div className="flex-1 lg:flex-none lg:w-[57%] min-h-0 min-w-0">
            <LayananPanel />
          </div>
          <div className="flex-1 lg:flex-none lg:w-[43%] min-h-0 min-w-0">
            <SparepartPanel />
          </div>
        </div>

        {/* Right: Checkout card */}
        <div className="lg:w-[38%] min-w-0 overflow-y-auto">
          <CartSummary />
        </div>
      </div>

      <TutupKasirModal open={showTutupKasir} onClose={() => setShowTutupKasir(false)} />
    </div>
  );
}
