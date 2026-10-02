export function validateRequired(value: string, fieldName: string): string | null {
  if (!value || value.trim() === '') {
    return `${fieldName} wajib diisi`;
  }
  return null;
}

export function validateNumber(value: string, fieldName: string, min?: number, max?: number): string | null {
  const num = Number(value);
  if (isNaN(num)) {
    return `${fieldName} harus berupa angka`;
  }
  if (min !== undefined && num < min) {
    return `${fieldName} minimal ${min}`;
  }
  if (max !== undefined && num > max) {
    return `${fieldName} maksimal ${max}`;
  }
  return null;
}

export function validatePositiveNumber(value: string, fieldName: string): string | null {
  return validateNumber(value, fieldName, 0);
}

export function validateVehiclePlate(plate: string): string | null {
  if (!plate || plate.trim() === '') {
    return 'Nomor plat wajib diisi';
  }
  // Basic Indonesian plate format validation
  const cleanPlate = plate.replace(/\s+/g, '').toUpperCase();
  if (cleanPlate.length < 6 || cleanPlate.length > 10) {
    return 'Format plat tidak valid';
  }
  return null;
}

export function validateQueueNumber(value: string): string | null {
  const num = Number(value);
  if (isNaN(num) || num < 1) {
    return 'Nomor antrian harus angka positif';
  }
  return null;
}

export function validatePrice(value: string, fieldName: string = 'Harga'): string | null {
  const num = Number(value);
  if (isNaN(num) || num < 0) {
    return `${fieldName} tidak boleh negatif`;
  }
  return null;
}

export function validateQuantity(value: string, maxStock?: number): string | null {
  const num = Number(value);
  if (isNaN(num) || num < 1) {
    return 'Kuantitas minimal 1';
  }
  if (maxStock !== undefined && num > maxStock) {
    return `Stok tidak mencukupi (tersedia: ${maxStock})`;
  }
  return null;
}