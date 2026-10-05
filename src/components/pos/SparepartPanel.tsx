import { useRef, useState, useEffect } from 'react';
import { Search, X, Package, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui';
import { usePOSStore } from '@/stores';
import { useAppStore } from '@/stores/useAppStore';
import { formatRupiah } from '@/utils/currency';
import type { Sparepart, CartItem } from '@/types';
import { cn } from '@/utils/cn';

export function SparepartPanel() {
  const { spareparts } = useAppStore();
  const {
    sparepartItems,
    addSparepart,
    updateSparepartPrice,
    updateSparepartQty,
    removeSparepart,
    setFocusRef,
  } = usePOSStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setFocusRef('sparepartSearch', searchRef);
  }, [setFocusRef]);

  const filteredParts = spareparts.filter((part) =>
    part.name.toLowerCase().includes(searchQuery.toLowerCase()) && part.is_active === 1
  );

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setShowDropdown(value.length > 0 || filteredParts.length > 0);
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && filteredParts[selectedIndex]) {
        addPartFromDB(filteredParts[selectedIndex]);
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
      setSelectedIndex((prev) => Math.min(prev + 1, filteredParts.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, -1));
    } else if (e.key === 'Tab') {
      setShowDropdown(false);
    }
  };

  const addPartFromDB = async (part: Sparepart) => {
    if (part.stock <= 0) {
      return;
    }
    
    const item: Omit<CartItem, 'id'> = {
      item_type: 'sparepart',
      item_name: part.name,
      quantity: 1,
      unit_price: part.sell_price,
      total_price: part.sell_price,
      sparepart_id: part.id,
    };
    
    const success = await addSparepart(item, part.stock);
    if (!success) {
      // Stock insufficient - could show toast
    }
  };

  return (
    <div className="bg-white rounded-xl border border-industrial-200 h-[calc(100vh-320px)] min-h-[300px] max-h-[500px] flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-industrial-200 bg-industrial-50 rounded-t-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <Package className="h-5 w-5 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-industrial-900">SPARE PART</h3>
          </div>
          <span className="text-sm text-industrial-500">
            {sparepartItems.length} item
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
            placeholder="Cari sparepart..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-industrial-300 focus:outline-none focus:ring-2 focus:ring-industrial-500 focus:border-industrial-500"
            autoComplete="off"
          />
          {showDropdown && (
            <div
              ref={dropdownRef}
              className="absolute z-10 w-full mt-1 bg-white border border-industrial-200 rounded-lg shadow-lg overflow-hidden max-h-60 overflow-y-auto"
            >
              {filteredParts.length === 0 && searchQuery.length === 0 ? (
                <div className="px-4 py-3 text-sm text-industrial-500 text-center">
                  Ketik untuk mencari sparepart
                </div>
              ) : filteredParts.length === 0 ? (
                <div className="px-4 py-3 text-sm text-industrial-500 text-center">
                  Sparepart tidak ditemukan
                </div>
              ) : (
                filteredParts.map((part, index) => (
                  <button
                    key={part.id}
                    onClick={() => addPartFromDB(part)}
                    disabled={part.stock <= 0}
                    className={cn(
                      'w-full px-4 py-3 text-left text-sm hover:bg-industrial-50 flex items-center justify-between gap-2',
                      selectedIndex === index && 'bg-blue-50',
                      part.stock <= 0 && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Package className="h-4 w-4 text-blue-500 flex-shrink-0" />
                      <div className="min-w-0">
                        <span className="font-medium text-industrial-900 truncate block">{part.name}</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" size="sm">Stok: {part.stock}</Badge>
                          <span className="text-industrial-600 font-mono text-xs">
                            {formatRupiah(part.sell_price)}
                          </span>
                        </div>
                      </div>
                    </div>
                    {part.stock <= 0 && (
                      <AlertTriangle className="h-4 w-4 text-warning-500 flex-shrink-0" />
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Items List */}
      <div className="flex-1 overflow-y-auto p-4">
        {sparepartItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-industrial-400">
            <Package className="h-12 w-12 opacity-30" />
            <p className="mt-2 text-sm">Belum ada sparepart</p>
            <p className="text-xs text-industrial-500">Cari dan pilih sparepart dari daftar</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sparepartItems.map((item, index) => (
              <SparepartItemRow
                key={item.id}
                item={item}
                index={index}
                currentStock={spareparts.find(p => p.id === item.sparepart_id)?.stock || 0}
                onUpdatePrice={updateSparepartPrice}
                onUpdateQty={(idx, qty) =>
                  updateSparepartQty(idx, qty, spareparts.find((p) => p.id === item.sparepart_id)?.stock || 0)
                }
                onRemove={removeSparepart}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface SparepartItemRowProps {
  item: CartItem;
  index: number;
  currentStock: number;
  onUpdatePrice: (index: number, price: number) => void;
  onUpdateQty: (index: number, qty: number) => Promise<boolean>;
  onRemove: (index: number) => void;
}

function SparepartItemRow({ item, index, currentStock, onUpdatePrice, onUpdateQty, onRemove }: SparepartItemRowProps) {
  const [editPrice, setEditPrice] = useState(false);
  const [editQty, setEditQty] = useState(false);
  const priceRef = useRef<HTMLInputElement | null>(null);
  const qtyRef = useRef<HTMLInputElement | null>(null);
  const [priceValue, setPriceValue] = useState(item.unit_price.toString());
  const [qtyValue, setQtyValue] = useState(item.quantity.toString());

  // Available stock = current stock in DB + quantity already in cart
  const availableStock = currentStock + item.quantity;

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

  const handleQtySave = async () => {
    const qty = parseInt(qtyValue, 10) || 1;
    if (qty > availableStock) {
      setQtyValue(item.quantity.toString());
      setEditQty(false);
      return;
    }
    await onUpdateQty(index, qty);
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

  const isLowStock = availableStock <= 5 && availableStock > 0;
  const isOutOfStock = availableStock <= 0;

  return (
    <div className={cn(
      'rounded-lg border p-3',
      isOutOfStock ? 'bg-danger-50 border-danger-200' : isLowStock ? 'bg-warning-50 border-warning-200' : 'bg-industrial-50 border-industrial-200'
    )}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-blue-500 flex-shrink-0" />
            <span className="font-medium text-industrial-900 truncate">{item.item_name}</span>
            {item.sparepart_id && (
              <span className="text-xs bg-industrial-200 text-industrial-600 px-1.5 py-0.5 rounded">DB</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Badge 
              variant={isOutOfStock ? 'danger' : isLowStock ? 'warning' : 'success'} 
              size="sm"
              className="font-normal"
            >
              Stok tersedia: {availableStock}
            </Badge>
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
              max={availableStock}
              className="w-16 px-2 py-1 text-sm border border-industrial-300 rounded focus:outline-none focus:ring-2 focus:ring-industrial-500 text-center"
            />
          ) : (
            <button
              onClick={() => { setQtyValue(item.quantity.toString()); setEditQty(true); }}
              disabled={isOutOfStock}
              className={cn(
                'px-3 py-1.5 text-sm font-mono bg-white border border-industrial-300 rounded hover:bg-industrial-50',
                isOutOfStock && 'opacity-50 cursor-not-allowed'
              )}
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
            aria-label="Hapus sparepart"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}