import { POSView } from '@/components/pos/POSView';
import { useAppStore } from '@/stores';
import { useEffect } from 'react';

export default function POSPage() {
  const { initializeApp, loadMechanics, loadSpareparts, loadServices } = useAppStore();

  useEffect(() => {
    initializeApp();
  }, [initializeApp]);

  return (
    <div className="h-full">
      <POSView />
    </div>
  );
}