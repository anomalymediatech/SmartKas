import { useState, useEffect } from 'react';
import { Tabs, TabPanel } from '@/components/ui';
import { ShopSettingsForm } from '@/components/settings/ShopSettingsForm';
import { MechanicsTable } from '@/components/settings/MechanicsTable';
import { SparepartsTable } from '@/components/settings/SparepartsTable';
import { ServicesTable } from '@/components/settings/ServicesTable';
import { useAppStore } from '@/stores';
import { LayoutDashboard, Users, Package, Wrench, Settings as SettingsIcon } from 'lucide-react';

const tabs = [
  { key: 'shop', label: 'Toko', icon: <LayoutDashboard className="h-4 w-4" /> },
  { key: 'mechanics', label: 'Mekanik', icon: <Users className="h-4 w-4" /> },
  { key: 'spareparts', label: 'Sparepart', icon: <Package className="h-4 w-4" /> },
  { key: 'services', label: 'Layanan', icon: <Wrench className="h-4 w-4" /> },
];

export default function SettingsPage() {
  const { initializeApp } = useAppStore();

  useEffect(() => {
    initializeApp();
  }, [initializeApp]);

  const [activeTab, setActiveTab] = useState('shop');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-industrial-900">Pengaturan Master Data</h1>
        <p className="text-industrial-500 mt-1">Kelola pengaturan toko, mekanik, sparepart, dan layanan standar</p>
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} variant="pills" />

      <div className="mt-6">
        <TabPanel tabKey="shop" activeTab={activeTab}>
          <ShopSettingsForm />
        </TabPanel>
        <TabPanel tabKey="mechanics" activeTab={activeTab}>
          <MechanicsTable />
        </TabPanel>
        <TabPanel tabKey="spareparts" activeTab={activeTab}>
          <SparepartsTable />
        </TabPanel>
        <TabPanel tabKey="services" activeTab={activeTab}>
          <ServicesTable />
        </TabPanel>
      </div>
    </div>
  );
}