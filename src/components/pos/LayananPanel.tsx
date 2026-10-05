import { useRef, useState, useEffect } from 'react';
import { Search, Plus, X, Wrench } from 'lucide-react';
import { Button } from '@/components/ui';
import { usePOSStore } from '@/stores';
import { useAppStore } from '@/stores/useAppStore';
import { formatRupiah } from '@/utils/currency';
import type { Service, CartItem } from '@/types';
import { cn } from '@/utils/cn';

interface LayananPanelProps {
  onAddManual: () => void;
}

export function LayananPanel({ onAddManual }: LayananPanelProps) {
  const { services } = useAppStore();
  const {
    layananItems,
    addLayanan,
    updateLayananPrice,
    updateLayananQty,
    removeLayanan,
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
        onAddManual();
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
    };
    addLayanan(item);
  };

  const handleManualAdd = () => {
    if (searchQuery.trim()) {
      const item: Omit<CartItem, 'id'> = {
        item_type: 'layanan',
        item_name: searchQuery.trim(),
        quantity: 1,
        unit_price: 0,
        total_price: 0,
      };
      addLayanan(item);
      setSearchQuery('');
      setShowDropdown(false);
    }
    onAddManual();
  };

  return (
    <div className="bg-white rounded-xl border border-industrial-200 h-[calc(100vh-320px)] min-h-[300px] max-h-[500px] flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-industrial-200 bg-industrial-50 rounded-t-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-accent-100 rounded-lg flex items-center justify-center">
              <Wrench className="h-5 w-5 text-accent-600" />
            </div>
            <h3 className="text-lg font-semibold text-industrial-900">LAYANAN</h3>
          </div>
          <span className="text-sm text-industrial-500">
            {layananItems.length} item
          </span>
        </div>
      </div>

      {/* Search */}
      <div className="p-4 border-b border-industrial-200 relative">
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
            placeholder="Cari layanan atau ketik nama manual + Enter..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-industrial-300 focus:outline-none focus:ring-2 focus:ring-industrial-500 focus:border-industrial-500"
            autoComplete="off"
          />
          {showDropdown && (
            <div
              ref={dropdownRef}
              className="absolute z-10 w-full mt-1 bg-white border border-industrial-200 rounded-lg shadow-lg overflow-hidden max-h-60 overflow-y-auto"
            >
              {filteredServices.length === 0 && searchQuery.length === 0 ? (
                <div className="px-4 py-3 text-sm text-industrial-500 text-center">
                  Ketik untuk mencari layanan standar
                </div>
              ) : filteredServices.length === 0 ? (
                <div className="px-4 py-3 text-sm text-industrial-500 text-center">
                  Tidak ditemukan. Tekan Enter untuk input manual: "{searchQuery}"
                </div>
              ) : (
                filteredServices.map((service, index) => (
                  <button
                    key={service.id}
                    onClick={() => addServiceFromDB(service)}
                    className={cn(
                      'w-full px-4 py-3 text-left text-sm hover:bg-industrial-50 flex items-center justify-between gap-2',
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
        <div className="mt-2 flex gap-2">
          <Button variant="outline" size="sm" onClick={handleManualAdd} className="flex-1">
            <Plus className="h-4 w-4" />
            Input Manual
          </Button>
        </div>
      </div>

      {/* Items List */}
      <div className="flex-1 overflow-y-auto p-4">
        {layananItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-industrial-400">
            <Wrench className="h-12 w-12 opacity-30" />
            <p className="mt-2 text-sm">Belum ada layanan</p>
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
}

function LayananItemRow({ item, index, onUpdatePrice, onUpdateQty, onRemove }: LayananItemRowProps) {
  const [editPrice, setEditPrice] = useState(false);
  const [editQty, setEditQty] = useState(false);
  const priceRef = useRef<HTMLInputElement | null>(null);
  const qtyRef = useRef<HTMLInputElement | null>(null);
  const [priceValue, setPriceValue] = useState(item.unit_price.toString());
  const [qtyValue, setQtyValue] = useState(item.quantity.toString());

  useEffect(() => {
    if (editPrice && priceRef.current) {
      priceRef.current.focus();
      priceRef.current.select();
    }
    if (editQty && qtyRef.current) {
      qtyRef.current.focus();
      qtyRef.current.select();
    }
  }, [editPrice, editQty]);

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
    <div className="bg-industrial-50 rounded-lg border border-industrial-200 p-3">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-accent-500 flex-shrink-0" />
            <span className="font-medium text-industrial-900 truncate">{item.item_name}</span>
            {item.service_id && (
              <span className="text-xs bg-industrial-200 text-industrial-600 px-1.5 py-0.5 rounded">DB</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
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
              className="w-16 px-2 py-1 text-sm border border-industrial-300 rounded focus:outline-none focus:ring-2 focus:ring-industrial-500 text-center"
            />
          ) : (
            <button
              onClick={() => { setQtyValue(item.quantity.toString()); setEditQty(true); }}
              className="px-3 py-1.5 text-sm font-mono text-industrial-700 bg-white border border-industrial-300 rounded hover:bg-industrial-50"
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
              className="w-28 px-2 py-1 text-sm border border-industrial-300 rounded focus:outline-none focus:ring-2 focus:ring-industrial-500 text-right"
            />
          ) : (
            <button
              onClick={() => { setPriceValue(item.unit_price.toString()); setEditPrice(true); }}
              className="px-3 py-1.5 text-sm font-mono text-industrial-700 bg-white border border-industrial-300 rounded hover:bg-industrial-50 text-right min-w-[90px]"
            >
              {formatRupiah(item.unit_price)}
            </button>
          )}

          {/* Total */}
          <span className="w-24 text-right font-medium text-industrial-900 font-mono">
            {formatRupiah(item.total_price)}
          </span>

          <button
            onClick={() => onRemove(index)}
            className="p-1.5 text-industrial-400 hover:text-danger-600 hover:bg-danger-50 rounded transition-colors"
            aria-label="Hapus layanan"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}