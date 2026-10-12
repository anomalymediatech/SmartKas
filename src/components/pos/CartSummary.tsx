import { useRef, useEffect } from 'react';
import { CreditCard, ArrowRight, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui';
import { usePOSStore } from '@/stores';
import { formatRupiah, parseRupiah } from '@/utils/currency';
import { cn } from '@/utils/cn';

export function CartSummary() {
  const {
    layananItems,
    sparepartItems,
    discount,
    paidAmount,
    paymentMethod,
    setDiscount,
    setPaidAmount,
    setPaymentMethod,
    getSubtotalLayanan,
    getSubtotalSparepart,
    getSubtotal,
    getTotalAmount,
    getChangeAmount,
    canCheckout,
    checkout,
    resetPOS,
    isProcessing,
    setFocusRef,
  } = usePOSStore();

  const discountRef = useRef<HTMLInputElement | null>(null);
  const paidAmountRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setFocusRef('discount', discountRef);
    setFocusRef('paidAmount', paidAmountRef);
  }, [setFocusRef]);

  const subtotalLayanan = getSubtotalLayanan();
  const subtotalSparepart = getSubtotalSparepart();
  const subtotal = getSubtotal();
  const totalAmount = getTotalAmount();
  const changeAmount = getChangeAmount();
  const canPay = canCheckout();

  const handleDiscountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseRupiah(e.target.value);
    setDiscount(value);
  };

  const handlePaidAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseRupiah(e.target.value);
    setPaidAmount(value);
  };

  const handlePaidAmountKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && canPay) {
      e.preventDefault();
      checkout();
    }
  };

  return (
    <div className="bg-white rounded-xl border border-industrial-200 p-3">
      <div className="grid grid-cols-1 gap-6">
        {/* Subtotal Breakdown */}
        <div className="space-y-4">
          {/* Layanan Subtotal */}
          {layananItems.length > 0 && (
            <div className="bg-accent-50 rounded-lg p-4 border border-accent-100">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-accent-700 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-accent-500 rounded-full"></span>
                  LAYANAN
                </h4>
                <span className="font-mono text-sm font-bold text-accent-700">
                  {formatRupiah(subtotalLayanan)}
                </span>
              </div>
              <div className="text-xs text-accent-600">
                {layananItems.length} item layanan
              </div>
            </div>
          )}

          {/* Sparepart Subtotal */}
          {sparepartItems.length > 0 && (
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-blue-700 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                  SPARE PART
                </h4>
                <span className="font-mono text-sm font-bold text-blue-700">
                  {formatRupiah(subtotalSparepart)}
                </span>
              </div>
              <div className="text-xs text-blue-600">
                {sparepartItems.length} item sparepart
              </div>
            </div>
          )}

          {/* Total Calculation */}
          <div className="bg-industrial-50 rounded-lg p-4 border border-industrial-202 space-y-3">
            <div className="flex justify-between text-industrial-700">
              <span>Subtotal</span>
              <span className="font-mono font-medium">{formatRupiah(subtotal)}</span>
            </div>
            <div className="flex justify-between text-industrial-700">
              <span>Diskon</span>
              <span className="font-mono font-medium text-danger-600">- {formatRupiah(discount)}</span>
            </div>
            <div className="border-t border-industrial-200 pt-3">
              <div className="flex justify-between text-base">
                <span className="font-semibold text-industrial-900">TOTAL</span>
                <span className="font-mono font-bold text-base text-accent-600">
                  {formatRupiah(totalAmount)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Section */}
        <div className="space-y-4">
          <div className="bg-industrial-50 rounded-lg p-4 border border-industrial-200">
            <h4 className="font-semibold text-industrial-900 mb-4 flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-industrial-500" />
              PEMBAYARAN
            </h4>
            
            {/* Payment Method */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-industrial-700 mb-1.5">Metode Bayar</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as 'Cash' | 'Transfer' | 'QRIS')}
                className="w-full px-3 py-1.5 rounded-lg border border-industrial-300 focus:outline-none focus:ring-2 focus:ring-industrial-500"
              >
                <option value="Cash">Cash</option>
                <option value="Transfer">Transfer</option>
                <option value="QRIS">QRIS</option>
              </select>
            </div>

            {/* Discount Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-industrial-700 mb-1.5">
                Diskon (Rp)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-industrial-400 font-mono pointer-events-none">Rp</span>
                <input
                  ref={discountRef}
                  type="text"
                  value={discount > 0 ? discount : ''}
                  onChange={handleDiscountChange}
                  onKeyDown={(e) => { if (e.key === 'Enter') paidAmountRef.current?.focus(); }}
                  placeholder="0"
                  className="w-full pl-8 pr-4 py-1.5 rounded-lg border border-industrial-300 focus:outline-none focus:ring-2 focus:ring-industrial-500 focus:border-industrial-500 text-right font-mono"
                  inputMode="numeric"
                />
              </div>
            </div>

            {/* Total to Pay */}
            <div className="bg-white rounded-lg p-3 border border-industrial-200 mb-4">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-industrial-600">Total Bayar</span>
                <span className="font-mono font-semibold text-industrial-900">{formatRupiah(totalAmount)}</span>
              </div>
              <div className="flex justify-between text-base">
                <span className="font-semibold text-industrial-900">Uang Diterima</span>
                <span className="font-mono font-bold text-base text-success-600">
                  {paidAmount > 0 ? formatRupiah(paidAmount) : '-'}
                </span>
              </div>
            </div>

            {/* Paid Amount Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-industrial-700 mb-1.5">
                Bayar <span className="text-danger-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-industrial-400 font-mono pointer-events-none">Rp</span>
                <input
                  ref={paidAmountRef}
                  type="text"
                  value={paidAmount > 0 ? paidAmount : ''}
                  onChange={handlePaidAmountChange}
                  onKeyDown={handlePaidAmountKeyDown}
                  placeholder={String(totalAmount)}
                  className="w-full pl-8 pr-4 py-2 rounded-lg border-2 border-industrial-300 focus:outline-none focus:ring-2 focus:ring-industrial-500 focus:border-industrial-500 text-right font-mono text-sm"
                  inputMode="numeric"
                />
              </div>
            </div>

            {/* Change */}
            <div className={cn(
              'rounded-lg p-4 text-center font-mono',
              changeAmount >= 0 ? 'bg-success-50 border border-success-200 text-success-700' : 'bg-danger-50 border border-danger-200 text-danger-700'
            )}>
              <div className="text-sm text-industrial-500 mb-1">KEMBALIAN</div>
              <div className="text-xl font-bold">
                {changeAmount >= 0 ? formatRupiah(changeAmount) : formatRupiah(Math.abs(changeAmount))}
              </div>
              {changeAmount < 0 && (
                <div className="text-xs mt-1">Kurang: {formatRupiah(Math.abs(changeAmount))}</div>
              )}
            </div>
          </div>

          {/* Checkout Button */}
          <Button
            onClick={checkout}
            disabled={!canPay || isProcessing}
            loading={isProcessing}
            size="xl"
            variant="success"
            className="w-full"
          >
            <RotateCcw className="h-5 w-5" />
            BAYAR & CETAK
            <ArrowRight className="h-5 w-5" />
          </Button>

          {/* Reset Button */}
          <Button
            onClick={resetPOS}
            variant="ghost"
            size="sm"
            className="w-full text-industrial-500 hover:text-industrial-700"
          >
            <RotateCcw className="h-4 w-4" />
            Reset Transaksi (Esc)
          </Button>
        </div>
      </div>
    </div>
  );
}
