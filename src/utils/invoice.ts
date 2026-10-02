export async function generateInvoiceNumber(): Promise<string> {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  
  // This will be called from the backend via Tauri command
  // The sequence will be generated there
  return `INV-${dateStr}-XXXX`;
}

export function buildInvoiceNumber(dateStr: string, sequence: number): string {
  return `INV-${dateStr}-${sequence.toString().padStart(4, '0')}`;
}

export function parseInvoiceNumber(invoice: string): { date: string; sequence: number } | null {
  const match = invoice.match(/^INV-(\d{8})-(\d{4})$/);
  if (!match) return null;
  return {
    date: match[1],
    sequence: parseInt(match[2], 10),
  };
}