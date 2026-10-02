import { useState } from 'react';
import { Input, Button, Textarea } from '@/components/ui';
import { useAppStore } from '@/stores';
import { useToast } from '@/hooks/useToast';
import type { Settings } from '@/types';

export function ShopSettingsForm() {
  const { settings, updateSettings, isLoading } = useAppStore();
  const { success, error } = useToast();
  const [formData, setFormData] = useState<Partial<Settings>>({
    shop_name: '',
    shop_address: '',
    receipt_footer: '',
  });
  const [syncedSettings, setSyncedSettings] = useState<Settings | null>(null);

  if (settings && settings !== syncedSettings) {
    setSyncedSettings(settings);
    setFormData({
      shop_name: settings.shop_name || '',
      shop_address: settings.shop_address || '',
      receipt_footer: settings.receipt_footer || '',
    });
  }

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateSettings(formData);
      success('Berhasil', 'Pengaturan toko disimpan');
    } catch (err) {
      error('Gagal', 'Gagal menyimpan pengaturan');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white rounded-xl border border-industrial-200 p-6">
        <h3 className="text-lg font-semibold text-industrial-900 mb-6 flex items-center gap-2">
          <span className="w-8 h-8 bg-accent-100 rounded-lg flex items-center justify-center">
            <svg className="h-5 w-5 text-accent-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
          </span>
          Informasi Toko
        </h3>
        
        <Input
          label="Nama Bengkel"
          value={formData.shop_name}
          onChange={(e) => handleChange('shop_name', e.target.value)}
          placeholder="KASMINI BENGKEL"
          required
        />
        
        <Textarea
          label="Alamat Bengkel"
          value={formData.shop_address}
          onChange={(e) => handleChange('shop_address', e.target.value)}
          placeholder="Jl. Raya No. 123, Jakarta"
          rows={3}
        />
        
        <Textarea
          label="Footer Struk"
          value={formData.receipt_footer}
          onChange={(e) => handleChange('receipt_footer', e.target.value)}
          placeholder="Service lebih dari 7x gratis 1x. Barang yang sudah dibeli tidak dapat dikembalikan."
          rows={3}
          helperText="Teks yang akan dicetak di bagian bawah struk"
        />
      </div>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={() => setFormData({ shop_name: '', shop_address: '', receipt_footer: '' })}>
          Reset
        </Button>
        <Button type="submit" loading={isLoading}>
          Simpan Pengaturan
        </Button>
      </div>
    </form>
  );
}