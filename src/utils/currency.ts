export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount).replace('Rp', 'Rp ');
}

export function parseRupiah(value: string): number {
  return Number(value.replace(/[^0-9.-]+/g, '')) || 0;
}