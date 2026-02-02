'use client';

import { useState } from 'react';
import { createPavilion, updatePavilion } from '@/lib/pavilions';
import { Pavilion } from '@/types/store';

interface EditPavilionModalProps {
  storeId: number;
  pavilion: Pavilion | null;
  onClose: () => void;
  onSaved: () => void;
}

export function EditPavilionModal({
  storeId,
  pavilion,
  onClose,
  onSaved,
}: {
  storeId: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pavilion: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(() => ({
    number: pavilion?.number ?? '',
    squareMeters: pavilion?.squareMeters ?? '',
    pricePerSqM: pavilion?.pricePerSqM ?? '',
    status: pavilion?.status ?? 'AVAILABLE',
    tenantName: pavilion?.tenantName ?? '',
    rentAmount: pavilion?.rentAmount ?? '',
    utilitiesAmount: pavilion?.utilitiesAmount ?? '',
  }));

  if (!storeId) {
    console.error('EditPavilionModal: storeId is missing');
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleChange = (e: any) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

 const handleSave = async () => {
  const payload = {
    number: form.number,
    squareMeters: Number(form.squareMeters),
    pricePerSqM: Number(form.pricePerSqM),
    status: form.status,
    tenantName: form.status === 'AVAILABLE' ? null : form.tenantName,
    rentAmount: form.status === 'AVAILABLE' ? null : Number(form.rentAmount),
    utilitiesAmount:
      form.status === 'AVAILABLE' ? null : Number(form.utilitiesAmount),
  };

  if (pavilion) {
    await updatePavilion(storeId, pavilion.id, payload);
  } else {
    await createPavilion(storeId, payload);
  }

  onSaved();
  onClose();
};



  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded p-6 w-[400px]">
        <h2 className="text-lg font-bold mb-4">Edit Pavilion</h2>

        <input
          name="number"
          value={form.number}
          onChange={handleChange}
          className="input"
          placeholder="Number"
        />

        <input
          name="squareMeters"
          type="number"
          value={form.squareMeters}
          onChange={handleChange}
          className="input"
          placeholder="Square meters"
        />

        <input
          name="pricePerSqM"
          type="number"
          value={form.pricePerSqM}
          onChange={handleChange}
          className="input"
          placeholder="Price per m²"
        />

        <select
          name="status"
          value={form.status}
          onChange={handleChange}
          className="input"
        >
          <option value="AVAILABLE">Available</option>
          <option value="RENTED">Rented</option>
        </select>

        {form.status === 'RENTED' && (
  <>
    <input
      name="tenantName"
      value={form.tenantName}
      onChange={handleChange}
      className="input"
      placeholder="Tenant name"
    />

    <input
      name="rentAmount"
      type="number"
      value={form.rentAmount}
      onChange={handleChange}
      className="input"
      placeholder="Rent amount"
    />

    <input
      name="utilitiesAmount"
      type="number"
      value={form.utilitiesAmount}
      onChange={handleChange}
      className="input"
      placeholder="Utilities amount"
    />
  </>
)}


        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button onClick={handleSave} className="btn-primary">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
