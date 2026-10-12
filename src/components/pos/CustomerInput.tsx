import { useRef, useEffect, useState } from 'react';
import { Truck, User, Hash, UserCog } from 'lucide-react';
import { usePOSStore } from '@/stores';
import { useAppStore } from '@/stores/useAppStore';
import { VehicleHistoryModal } from './VehicleHistoryModal';
import { dbSearchVehiclePlates } from '@/hooks/useDatabase';

export function CustomerInput() {
  const {
    vehiclePlate,
    customerName,
    queueNumber,
    mechanicId,
    setVehiclePlate,
    setCustomerName,
    setQueueNumber,
    setMechanicId,
    setVehiclePlateSuggestions,
    setShowVehiclePlateDropdown,
    setCustomerNameSuggestions,
    setShowCustomerNameDropdown,
    setFocusRef,
    setCustomerNameFocus,
    setQueueNumberFocus,
    setMechanicFocus,
    vehiclePlateSuggestions,
    showVehiclePlateDropdown,
    customerNameSuggestions,
    showCustomerNameDropdown,
    mechanics,
  } = usePOSStore();
  
  const { mechanics: appMechanics } = useAppStore();

  const vehiclePlateRef = useRef<HTMLInputElement>(null);
  const customerNameRef = useRef<HTMLInputElement>(null);
  const queueNumberRef = useRef<HTMLInputElement>(null);
  const mechanicRef = useRef<HTMLSelectElement>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    setFocusRef('vehiclePlate', vehiclePlateRef);
    setFocusRef('customerName', customerNameRef);
    setFocusRef('queueNumber', queueNumberRef);
    setFocusRef('mechanic', mechanicRef);
  }, [setFocusRef]);

  // Sync mechanics from app store
  useEffect(() => {
    const activeMechanics = appMechanics.filter(m => m.is_active === 1);
    if (activeMechanics.length !== mechanics.length || 
        activeMechanics.some((m, i) => m.id !== mechanics[i]?.id)) {
      usePOSStore.getState().setMechanics(activeMechanics);
    }
  }, [appMechanics, mechanics]);

  const handleVehiclePlateChange = (value: string) => {
    const upperValue = value.toUpperCase();
    setVehiclePlate(upperValue);
    
    // Suggestion plates dari riwayat transaksi di database
    if (upperValue.length >= 2) {
      dbSearchVehiclePlates(upperValue)
        .then((suggestions) => {
          setVehiclePlateSuggestions(suggestions);
          setShowVehiclePlateDropdown(suggestions.length > 0);
        })
        .catch(() => setShowVehiclePlateDropdown(false));
    } else {
      setShowVehiclePlateDropdown(false);
    }
  };

  const handleVehiclePlateSelect = (plate: string) => {
    setVehiclePlate(plate);
    setShowVehiclePlateDropdown(false);
    vehiclePlateRef.current?.blur();
  };

  const handleCustomerNameChange = (value: string) => {
    setCustomerName(value);
    if (value.length >= 2) {
      const suggestions = ['Pelanggan Setia', 'Pelanggan Baru', 'Pelanggan Langganan']
        .filter(n => n.toLowerCase().includes(value.toLowerCase()));
      setCustomerNameSuggestions(suggestions);
      setShowCustomerNameDropdown(suggestions.length > 0);
    } else {
      setShowCustomerNameDropdown(false);
    }
  };

  const handleCustomerNameSelect = (name: string) => {
    setCustomerName(name);
    setShowCustomerNameDropdown(false);
    customerNameRef.current?.blur();
  };

  const handleQueueNumberChange = (value: string) => {
    const num = parseInt(value, 10) || 1;
    setQueueNumber(Math.max(1, num));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      if (e.currentTarget === vehiclePlateRef.current) {
        setCustomerNameFocus();
      } else if (e.currentTarget === customerNameRef.current) {
        setQueueNumberFocus();
      } else if (e.currentTarget === queueNumberRef.current) {
        setMechanicFocus();
      } else if (e.currentTarget === mechanicRef.current) {
        // Focus will move to layanan search via keyboard shortcut
      }
    } else if (e.key === 'Escape') {
      setShowVehiclePlateDropdown(false);
      setShowCustomerNameDropdown(false);
    } else if (e.key === 'ArrowDown' && showVehiclePlateDropdown) {
      e.preventDefault();
      // Could implement dropdown navigation
    }
  };

  return (
    <div className="bg-white rounded-xl border border-industrial-200 p-3 mb-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Vehicle Plate */}
        <div className="relative">
          <label className="block text-xs font-medium text-industrial-700 mb-1">
            Plat Nomor <span className="text-danger-500">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-industrial-400">
              <Truck className="h-5 w-5" />
            </div>
            <input
              ref={vehiclePlateRef}
              type="text"
              value={vehiclePlate}
              onChange={(e) => handleVehiclePlateChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setShowVehiclePlateDropdown(vehiclePlateSuggestions.length > 0)}
              onBlur={() => setTimeout(() => setShowVehiclePlateDropdown(false), 200)}
              placeholder="Contoh: B 1234 ABC"
              className="w-full pl-10 pr-4 py-1.5 rounded-lg border border-industrial-300 focus:outline-none focus:ring-2 focus:ring-industrial-500 focus:border-industrial-500 text-uppercase"
              autoComplete="off"
              autoFocus
            />
          </div>
          {showVehiclePlateDropdown && vehiclePlateSuggestions.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-industrial-200 rounded-lg shadow-lg overflow-hidden">
              {vehiclePlateSuggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => handleVehiclePlateSelect(suggestion)}
                  className="w-full px-4 py-2 text-left text-sm text-industrial-700 hover:bg-industrial-50"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
          {vehiclePlate.trim().length >= 3 && (
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              className="mt-1.5 text-xs font-medium text-accent-600 hover:text-accent-700 hover:underline"
            >
              Lihat Riwayat Servis
            </button>
          )}
        </div>

        {/* Customer Name */}
        <div className="relative">
          <label className="block text-xs font-medium text-industrial-700 mb-1">
            Nama Pelanggan
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-industrial-400">
              <User className="h-5 w-5" />
            </div>
            <input
              ref={customerNameRef}
              type="text"
              value={customerName}
              onChange={(e) => handleCustomerNameChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setShowCustomerNameDropdown(customerNameSuggestions.length > 0)}
              onBlur={() => setTimeout(() => setShowCustomerNameDropdown(false), 200)}
              placeholder="Nama pelanggan (opsional)"
              className="w-full pl-10 pr-4 py-1.5 rounded-lg border border-industrial-300 focus:outline-none focus:ring-2 focus:ring-industrial-500 focus:border-industrial-500"
              autoComplete="off"
            />
          </div>
          {showCustomerNameDropdown && customerNameSuggestions.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-industrial-200 rounded-lg shadow-lg overflow-hidden">
              {customerNameSuggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => handleCustomerNameSelect(suggestion)}
                  className="w-full px-4 py-2 text-left text-sm text-industrial-700 hover:bg-industrial-50"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Queue Number */}
        <div>
          <label className="block text-xs font-medium text-industrial-700 mb-1">
            No. Antrian <span className="text-danger-500">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-industrial-400">
              <Hash className="h-5 w-5" />
            </div>
            <input
              ref={queueNumberRef}
              type="number"
              value={queueNumber}
              onChange={(e) => handleQueueNumberChange(e.target.value)}
              onKeyDown={handleKeyDown}
              min="1"
              className="w-full pl-10 pr-4 py-1.5 rounded-lg border border-industrial-300 focus:outline-none focus:ring-2 focus:ring-industrial-500 focus:border-industrial-500 text-center font-mono text-lg"
            />
          </div>
        </div>

        {/* Mechanic */}
        <div>
          <label className="block text-xs font-medium text-industrial-700 mb-1">
            Mekanik <span className="text-danger-500">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-industrial-400">
              <UserCog className="h-5 w-5" />
            </div>
            <select
              ref={mechanicRef}
              value={mechanicId || ''}
              onChange={(e) => setMechanicId(e.target.value ? parseInt(e.target.value, 10) : null)}
              onKeyDown={handleKeyDown}
              className="w-full pl-10 pr-10 py-1.5 rounded-lg border border-industrial-300 focus:outline-none focus:ring-2 focus:ring-industrial-500 focus:border-industrial-500 bg-white appearance-none bg-[url('data:image/svg+xml,%3csvg xmlns=%27http://www.w3.org/2000/svg%27 fill=%27none%27 viewBox=%270 0 20 20%27%3e%3cpath stroke=%27%236b7280%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27 stroke-width=%271.5%27 d=%27M6 8l4 4 4-4%27/%3e%3c/svg%3e')] bg-[length:1.5rem_1.5rem] bg-[right_0.5rem_center] bg-no-repeat"
            >
              <option value="">Pilih mekanik</option>
              {mechanics.map((mechanic) => (
                <option key={mechanic.id} value={mechanic.id}>
                  {mechanic.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      <VehicleHistoryModal isOpen={historyOpen} onClose={() => setHistoryOpen(false)} plate={vehiclePlate.trim()} />
    </div>
  );
}
