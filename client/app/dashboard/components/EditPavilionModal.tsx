'use client';

import { useState } from 'react';
import { updatePavilion } from '@/lib/pavilions';

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
  const [form, setForm] = useState({
    number: pavilion.number,
    squareMeters: pavilion.squareMeters,
    pricePerSqM: pavilion.pricePerSqM,
    status: pavilion.status,
    tenantName: pavilion.tenantName ?? '',
    utilitiesAmount: pavilion.utilitiesAmount ?? '',
  });

   if (!storeId) {
     console.error('EditPavilionModal: storeId is missing');
     return null;
   }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleChange = (e: any) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    await updatePavilion(storeId, pavilion.id, {
      ...form,
      squareMeters: Number(form.squareMeters),
      pricePerSqM: Number(form.pricePerSqM),
      utilitiesAmount:
        form.utilitiesAmount === '' ? null : Number(form.utilitiesAmount),
    });

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
