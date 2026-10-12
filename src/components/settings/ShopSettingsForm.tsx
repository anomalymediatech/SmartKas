import { useState, useEffect } from 'react';
import { Input, Button, Textarea, Select } from '@/components/ui';
import { useAppStore } from '@/stores';
import { useToast } from '@/hooks/useToast';
import { dbGetPrinters, dbUploadShopLogo, dbDeleteShopLogo, dbGetShopLogoBase64 } from '@/hooks/useDatabase';
import type { Settings, PrinterInfo } from '@/types';
import { open } from '@tauri-apps/plugin-dialog';
import { readFile } from '@tauri-apps/plugin-fs';

export function ShopSettingsForm() {
  const { settings, updateSettings, isLoading } = useAppStore();
  const { success, error } = useToast();
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [formData, setFormData] = useState<Partial<Settings>>({
    shop_name: '',
    shop_address: '',
    receipt_footer: '',
    printer_name: null,
    paper_width: 80,
    shop_logo: null,
  });
  const [syncedSettings, setSyncedSettings] = useState<Settings | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);

  const loadLogoPreview = async () => {
    const base64 = await dbGetShopLogoBase64();
    setLogoPreview(base64);
  };

  useEffect(() => {
    dbGetPrinters().then(setPrinters).catch(() => setPrinters([]));
  }, []);

  useEffect(() => {
    dbGetShopLogoBase64().then(setLogoPreview);
  }, []);

  if (settings && settings !== syncedSettings) {
    setSyncedSettings(settings);
    setFormData({
      shop_name: settings.shop_name || '',
      shop_address: settings.shop_address || '',
      receipt_footer: settings.receipt_footer || '',
      printer_name: settings.printer_name ?? null,
      paper_width: settings.paper_width ?? 80,
      shop_logo: settings.shop_logo ?? null,
    });
    loadLogoPreview();
  }

  const handleChange = (field: string, value: string | number | null) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleLogoSelect = async () => {
    try {
      const filePath = await open({
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg'] }],
        multiple: false,
      });
      if (!filePath) return;

      setLogoUploading(true);

      // Read file as binary using Tauri fs plugin
      const bytes = await readFile(filePath);
      
      // Check file size (2MB limit)
      if (bytes.length > 2 * 1024 * 1024) {
        error('File terlalu besar', 'Maksimal 2MB');
        return;
      }

      // Determine extension from file path
      const extension = filePath.toLowerCase().endsWith('.png') ? 'png' : 'jpg';

      const savedName = await dbUploadShopLogo(Array.from(bytes), extension);
      const base64 = await dbGetShopLogoBase64();
      setLogoPreview(base64);
      setFormData((prev) => ({ ...prev, shop_logo: savedName }));
      success('Berhasil', 'Logo berhasil diupload');
    } catch {
      error('Gagal', 'Gagal mengupload logo');
    } finally {
      setLogoUploading(false);
    }
  };

  const handleLogoDelete = async () => {
    try {
      await dbDeleteShopLogo();
      setLogoPreview(null);
      setFormData((prev) => ({ ...prev, shop_logo: null }));
      success('Berhasil', 'Logo dihapus');
    } catch {
      error('Gagal', 'Gagal menghapus logo');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateSettings(formData);
      success('Berhasil', 'Pengaturan toko disimpan');
    } catch {
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-industrial-700 mb-2">Logo Struk</label>
            <div className="flex items-center gap-4">
              <div className="relative w-24 h-24 bg-industrial-50 rounded-lg border border-industrial-200 flex items-center justify-center overflow-hidden">
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo preview" className="max-w-full max-h-full object-contain" />
                ) : (
                  <svg className="w-10 h-10 text-industrial-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={logoUploading}
                  onClick={handleLogoSelect}
                >
                  {logoUploading ? 'Mengupload...' : logoPreview ? 'Ganti Logo' : 'Upload Logo'}
                </Button>
                {logoPreview && (
                  <Button type="button" variant="danger" size="sm" onClick={handleLogoDelete}>
                    Hapus Logo
                  </Button>
                )}
                <p className="text-xs text-industrial-500">PNG/JPG, max 2MB. Disarankan rasio 3:1 (lebar:tinggi)</p>
              </div>
            </div>
          </div>

          <Input
            label="Nama Bengkel"
            value={formData.shop_name ?? ''}
            onChange={(e) => handleChange('shop_name', e.target.value)}
            placeholder="POS Bengkel"
            required
          />

          <Textarea
            label="Alamat Bengkel"
            value={formData.shop_address ?? ''}
            onChange={(e) => handleChange('shop_address', e.target.value)}
            placeholder="Jl. Raya No. 123, Jakarta"
            rows={3}
          />

          <Textarea
            label="Footer Struk"
            value={formData.receipt_footer ?? ''}
            onChange={(e) => handleChange('receipt_footer', e.target.value)}
            placeholder="Service lebih dari 7x gratis 1x. Barang yang sudah dibeli tidak dapat dikembalikan."
            rows={3}
            helperText="Teks yang akan dicetak di bagian bawah struk"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-industrial-200 p-6">
        <h3 className="text-lg font-semibold text-industrial-900 mb-6 flex items-center gap-2">
          <span className="w-8 h-8 bg-accent-100 rounded-lg flex items-center justify-center">
            <svg className="h-5 w-5 text-accent-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
          </span>
          Printer
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Printer Struk"
            value={formData.printer_name ?? ''}
            onChange={(e) => handleChange('printer_name', e.target.value || null)}
            options={[
              { value: '', label: 'Pilih printer (kosong = tidak mencetak)' },
              ...printers.map((p) => ({ value: p.name, label: p.is_default ? `${p.name} (Default)` : p.name })),
            ]}
          />
          <Select
            label="Lebar Kertas"
            value={String(formData.paper_width ?? 80)}
            onChange={(e) => handleChange('paper_width', Number(e.target.value))}
            options={[
              { value: '58', label: '58 mm' },
              { value: '80', label: '80 mm' },
            ]}
          />
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={() => setFormData({ shop_name: '', shop_address: '', receipt_footer: '', printer_name: null, paper_width: 80, shop_logo: null })}>
          Reset
        </Button>
        <Button type="submit" loading={isLoading}>
          Simpan Pengaturan
        </Button>
      </div>
    </form>
  );
}