import { useRef, useState, useEffect } from 'react';
import { Search, X, Wrench } from 'lucide-react';
import { usePOSStore } from '@/stores';
import { useAppStore } from '@/stores/useAppStore';
import { formatRupiah } from '@/utils/currency';
import type { Service, CartItem } from '@/types';
import { cn } from '@/utils/cn';

export function LayananPanel() {
  const { services, loadServices } = useAppStore();
  const {
    layananItems,
    addLayanan,
    updateLayananPrice,
    updateLayananQty,
    updateLayananName,
    removeLayanan,
    updateLayananServiceType,
    setFocusRef,
  } = usePOSStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setFocusRef('layananSearch', searchRef);
  }, [setFocusRef]);

  const filteredServices = services.filter((service) =>
    service.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setShowDropdown(value.length > 0 || filteredServices.length > 0);
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && filteredServices[selectedIndex]) {
        addServiceFromDB(filteredServices[selectedIndex]);
      } else if (searchQuery.trim()) {
        addLayanan({
          item_type: 'layanan',
          item_name: searchQuery.trim(),
          quantity: 1,
          unit_price: 0,
          total_price: 0,
          service_type: 'biasa',
        });
      }
      setSearchQuery('');
      setShowDropdown(false);
      searchRef.current?.blur();
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
      setSearchQuery('');
      searchRef.current?.blur();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, filteredServices.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, -1));
    } else if (e.key === 'Tab') {
      setShowDropdown(false);
    }
  };

  const addServiceFromDB = (service: Service) => {
    const item: Omit<CartItem, 'id'> = {
      item_type: 'layanan',
      item_name: service.name,
      quantity: 1,
      unit_price: service.price,
      total_price: service.price,
      service_id: service.id,
      service_type: service.service_type ?? 'biasa',
    };
    addLayanan(item);
  };

  const saveServiceToMaster = async (name: string, serviceType: 'biasa' | 'upgrade', price: number) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const exists = services.some((s) => s.name.toLowerCase() === trimmed.toLowerCase());
    if (exists) return;
    try {
      const { dbCreateService } = await import('@/hooks/useDatabase');
      await dbCreateService({ name: trimmed, price, service_type: serviceType });
      await loadServices();
    } catch {
      // ignore duplicate-name errors
    }
  };

  const savingNamesRef = useRef<Set<string>>(new Set());

  // Auto-save layanan manual ke master data services (nama baru saja)
  useEffect(() => {
    for (const item of layananItems) {
      const name = item.item_name.trim();
      if (!name) continue;
      if (item.service_id) continue;
      if (item.unit_price <= 0) continue; // jangan tulis master berharga 0
      const key = name.toLowerCase();
      if (savingNamesRef.current.has(key)) continue;
      const exists = services.some((s) => s.name.toLowerCase() === key);
      if (!exists) {
        savingNamesRef.current.add(key);
        saveServiceToMaster(name, item.service_type ?? 'biasa', item.unit_price).finally(() =>
          savingNamesRef.current.delete(key)
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layananItems, services]);

  return (
    <div className="bg-white rounded-xl border border-industrial-200 h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b border-industrial-200 bg-industrial-50 rounded-t-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-accent-100 rounded-lg flex items-center justify-center">
              <Wrench className="h-4 w-4 text-accent-600" />
            </div>
            <h3 className="text-base font-semibold text-industrial-900">LAYANAN</h3>
          </div>
          <span className="text-sm text-industrial-500">
            {layananItems.length} item
          </span>
        </div>
      </div>

      {/* Search */}
      <div className="p-3 border-b border-industrial-200 relative">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-industrial-400">
            <Search className="h-5 w-5" />
          </div>
          <input
            ref={searchRef}
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setShowDropdown(true)}
            placeholder="Cari/ketik layanan + Enter"
            className="w-full pl-10 pr-4 py-1.5 text-xs rounded-lg border border-industrial-300 focus:outline-none focus:ring-2 focus:ring-industrial-500 focus:border-industrial-500"
            autoComplete="off"
          />
          {showDropdown && (
            <div
              ref={dropdownRef}
              className="absolute z-10 w-full mt-1 bg-white border border-industrial-200 rounded-lg shadow-lg overflow-hidden max-h-60 overflow-y-auto"
            >
              {filteredServices.length === 0 && searchQuery.length === 0 ? (
                <div className="px-3 py-2 text-xs text-industrial-500 text-center">
                  Ketik untuk mencari layanan standar
                </div>
              ) : filteredServices.length === 0 ? (
                <div className="px-3 py-2 text-xs text-industrial-500 text-center">
                  Tidak ditemukan. Tekan Enter untuk input manual: "{searchQuery}"
                </div>
              ) : (
                filteredServices.map((service, index) => (
                  <button
                    key={service.id}
                    onClick={() => addServiceFromDB(service)}
                    className={cn(
                      'w-full px-3 py-2 text-left text-xs hover:bg-industrial-50 flex items-center justify-between gap-2',
                      selectedIndex === index && 'bg-accent-50'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Wrench className="h-4 w-4 text-accent-500" />
                      <span className="font-medium text-industrial-900">{service.name}</span>
                    </div>
                    <span className="text-industrial-600 font-mono whitespace-nowrap">
                      {formatRupiah(service.price)}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

      </div>

      {/* Items List */}
      <div className="flex-1 min-h-0 overflow-y-auto p-2">
        {layananItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-industrial-400">
            <Wrench className="h-12 w-12 opacity-30" />
            <p className="mt-2 text-xs">Belum ada layanan</p>
            <p className="text-xs text-industrial-500">Cari atau input manual layanan</p>
          </div>
        ) : (
          <div className="space-y-2">
            {layananItems.map((item, index) => (
              <LayananItemRow
                key={item.id}
                item={item}
                index={index}
                onUpdatePrice={updateLayananPrice}
                onUpdateQty={updateLayananQty}
                onRemove={removeLayanan}
                onUpdateServiceType={updateLayananServiceType}
                onUpdateName={updateLayananName}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface LayananItemRowProps {
  item: CartItem;
  index: number;
  onUpdatePrice: (index: number, price: number) => void;
  onUpdateQty: (index: number, qty: number) => void;
  onRemove: (index: number) => void;
  onUpdateServiceType: (index: number, type: 'biasa' | 'upgrade') => void;
  onUpdateName: (index: number, name: string) => void;
}

function LayananItemRow({ item, index, onUpdatePrice, onUpdateQty, onRemove, 
onUpdateServiceType, onUpdateName }: LayananItemRowProps) {
  const [editPrice, setEditPrice] = useState(false);
  const [editQty, setEditQty] = useState(false);
  const [editName, setEditName] = useState(false);
  const priceRef = useRef<HTMLInputElement | null>(null);
  const qtyRef = useRef<HTMLInputElement | null>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);
  const [priceValue, setPriceValue] = useState(item.unit_price.toString());
  const [qtyValue, setQtyValue] = useState(item.quantity.toString());
  const [nameValue, setNameValue] = useState(item.item_name);

  useEffect(() => {
    if (editPrice && priceRef.current) {
      priceRef.current.focus();
      priceRef.current.select();
    }
    if (editQty && qtyRef.current) {
      qtyRef.current.focus();
      qtyRef.current.select();
    }
    if (editName && nameRef.current) {
      nameRef.current.focus();
      nameRef.current.select();
    }
  }, [editPrice, editQty, editName]);

  const handleNameSave = () => {
    const name = nameValue.trim();
    if (name && name !== item.item_name) onUpdateName(index, name);
    else setNameValue(item.item_name);
    setEditName(false);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleNameSave();
    else if (e.key === 'Escape') { setNameValue(item.item_name); setEditName(false); }
  };

  const handlePriceSave = () => {
    const price = parseFloat(priceValue) || 0;
    onUpdatePrice(index, price);
    setEditPrice(false);
  };

  const handleQtySave = () => {
    const qty = parseInt(qtyValue, 10) || 1;
    onUpdateQty(index, qty);
    setEditQty(false);
  };

  const handlePriceKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handlePriceSave();
    else if (e.key === 'Escape') { setEditPrice(false); setPriceValue(item.unit_price.toString()); }
  };

  const handleQtyKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleQtySave();
    else if (e.key === 'Escape') { setEditQty(false); setQtyValue(item.quantity.toString()); }
  };

  return (
    <div className="bg-industrial-50 rounded-lg border border-industrial-200 p-2 space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <Wrench className="h-4 w-4 text-accent-500 flex-shrink-0" />
        {editName ? (
          <input
            ref={nameRef}
            type="text"
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            onKeyDown={handleNameKeyDown}
            onBlur={handleNameSave}
            className="flex-1 min-w-[6rem] px-1 py-0.5 text-xs font-medium border border-industrial-300 rounded focus:outline-none focus:ring-2 focus:ring-industrial-500"
          />
        ) : (
          <button
            type="button"
            onClick={() => { setNameValue(item.item_name); setEditName(true); }}
            className="font-medium text-industrial-900 text-xs break-words text-left flex-1 min-w-[6rem] hover:text-accent-600"
            title={`${item.item_name} (klik untuk ubah nama)`}
          >
            {item.item_name}
          </button>
        )}
            {item.service_id && (
              <span className="text-[10px] bg-industrial-200 text-industrial-600 px-1.5 py-0.5 rounded flex-shrink-0">DB</span>
            )}
            <select
              value={item.service_type ?? 'biasa'}
              onChange={(e) => onUpdateServiceType(index, e.target.value as 'biasa' | 'upgrade')}
              className={`text-[10px] px-1 py-0 rounded border flex-shrink-0 max-w-full ${
                item.service_type === 'upgrade'
                  ? 'bg-purple-50 border-purple-200 text-purple-700'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-700'
              }`}
            >
              <option value="biasa">service biasa</option>
              <option value="upgrade">service upgrade</option>
            </select>
      </div>
      <div className="flex flex-wrap items-center gap-2 pl-6">
          {/* Quantity */}
          {editQty ? (
            <input
              ref={qtyRef}
              type="number"
              value={qtyValue}
              onChange={(e) => setQtyValue(e.target.value)}
              onKeyDown={handleQtyKeyDown}
              onBlur={handleQtySave}
              min="1"
              className="w-14 px-2 py-1 text-xs border border-industrial-300 rounded focus:outline-none focus:ring-2 focus:ring-industrial-500 text-center"
            />
          ) : (
            <button
              onClick={() => { setQtyValue(item.quantity.toString()); setEditQty(true); }}
              className="px-2 py-1 text-xs font-mono text-industrial-700 bg-white border border-industrial-300 rounded hover:bg-industrial-50"
            >
              x{item.quantity}
            </button>
          )}
          
          {/* Price */}
          {editPrice ? (
            <input
              ref={priceRef}
              type="text"
              value={priceValue}
              onChange={(e) => setPriceValue(e.target.value)}
              onKeyDown={handlePriceKeyDown}
              onBlur={handlePriceSave}
              placeholder="Harga"
              className="w-20 px-2 py-1 text-xs border border-industrial-300 rounded focus:outline-none focus:ring-2 focus:ring-industrial-500 text-right"
            />
          ) : (
            <button
              onClick={() => { setPriceValue(item.unit_price.toString()); setEditPrice(true); }}
              className="px-2 py-1 text-xs font-mono text-industrial-700 bg-white border border-industrial-300 rounded hover:bg-industrial-50 text-right min-w-[80px]"
            >
              {formatRupiah(item.unit_price)}
            </button>
          )}

          {/* Total */}
          <span className="min-w-[72px] flex-1 text-right font-medium text-industrial-900 font-mono text-xs">
            {formatRupiah(item.total_price)}
          </span>

          <button
            onClick={() => onRemove(index)}
            className="p-1.5 text-industrial-400 hover:text-danger-600 hover:bg-danger-50 rounded transition-colors ml-auto flex-shrink-0"
            aria-label="Hapus layanan"
          >
            <X className="h-4 w-4" />
          </button>
      </div>
    </div>
  );
}
