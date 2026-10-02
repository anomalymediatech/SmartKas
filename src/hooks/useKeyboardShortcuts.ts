import { useEffect } from 'react';
import { usePOSStore } from '@/stores/usePOSStore';

export function useKeyboardShortcuts() {
  const {
    setVehiclePlateFocus,
    setCustomerNameFocus,
    setQueueNumberFocus,
    setMechanicFocus,
    setDiscountFocus,
    setPaidAmountFocus,
    checkout,
  } = usePOSStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger if not typing in an input
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';
      
      switch (e.key) {
        case 'F1':
          e.preventDefault();
          setVehiclePlateFocus();
          break;
        case 'F2':
          e.preventDefault();
          // Focus layanan search - handled in POS component
          window.dispatchEvent(new CustomEvent('pos-focus-layanan'));
          break;
        case 'F3':
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('pos-focus-sparepart'));
          break;
        case 'F4':
          e.preventDefault();
          setDiscountFocus();
          break;
        case 'F5':
          e.preventDefault();
          setPaidAmountFocus();
          break;
        case 'F12':
          e.preventDefault();
          if (!isInput || (target as HTMLInputElement).name === 'paidAmount') {
            checkout();
          }
          break;
        case 'Enter':
          if (!isInput || (target as HTMLInputElement).name === 'paidAmount') {
            e.preventDefault();
            checkout();
          }
          break;
        case 'Escape':
          // Clear focus or close modal
          (target as HTMLElement).blur();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    setVehiclePlateFocus,
    setCustomerNameFocus,
    setQueueNumberFocus,
    setMechanicFocus,
    setDiscountFocus,
    setPaidAmountFocus,
    checkout,
  ]);
}