import { useEffect, useRef } from 'react';
import { CustomerInput } from './CustomerInput';
import { LayananPanel } from './LayananPanel';
import { SparepartPanel } from './SparepartPanel';
import { CartSummary } from './CartSummary';
import { usePOSStore } from '@/stores';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useToast } from '@/hooks/useToast';

export function POSView() {
  const { 
    resetPOS, 
    loadNextQueueNumber,
  } = usePOSStore();
  
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
      {/* Customer Input Section */}
      <CustomerInput />

      {/* Middle Section - Dual Category */}
      <div className="flex-1 flex gap-4 overflow-hidden">
        {/* Layanan Panel */}
        <div className="w-1/2 flex flex-col min-w-0">
          <LayananPanel onAddManual={() => {}} />
        </div>

        {/* Sparepart Panel */}
        <div className="w-1/2 flex flex-col min-w-0">
          <SparepartPanel />
        </div>
      </div>

      {/* Cart Summary */}
      <CartSummary />
    </div>
  );
}