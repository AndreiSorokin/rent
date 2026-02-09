'use client';

import { useState } from 'react';
import { createPavilion, updatePavilion } from '@/lib/pavilions';

export function EditPavilionModal({
  storeId,
  pavilion,
  onClose,
  onSaved,
}: {
  storeId: number;
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

  const handleChange = (e: any) => {
    const { name, value } = e.target;

    setForm((prev) => {
      const next = { ...prev, [name]: value };

      if (name === 'squareMeters' || name === 'pricePerSqM') {
        const squareMeters = Number(name === 'squareMeters' ? value : next.squareMeters);
        const pricePerSqM = Number(name === 'pricePerSqM' ? value : next.pricePerSqM);

        if (!Number.isNaN(squareMeters) && !Number.isNaN(pricePerSqM)) {
          next.rentAmount = String(squareMeters * pricePerSqM);
        }
      }

      if (name === 'status' && value === 'AVAILABLE') {
        next.tenantName = '';
        next.utilitiesAmount = '';
      }

      if (name === 'status' && value === 'PREPAID') {
        next.utilitiesAmount = '0';
      }

      return next;
    });
  };

  const handleSave = async () => {
    const payload = {
      number: form.number,
      squareMeters: Number(form.squareMeters),
      pricePerSqM: Number(form.pricePerSqM),
      status: form.status,
      tenantName: form.status === 'AVAILABLE' ? null : form.tenantName,
      rentAmount: form.status === 'AVAILABLE' ? null : Number(form.rentAmount),
      utilitiesAmount: form.status === 'AVAILABLE' ? null : Number(form.utilitiesAmount),
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-[400px] rounded bg-white p-6">
        <h2 className="mb-4 text-lg font-bold">Редактировать павильон</h2>

        <input
          name="number"
          value={form.number}
          onChange={handleChange}
          className="input"
          placeholder="Номер"
        />

        <input
          name="squareMeters"
          type="number"
          value={form.squareMeters}
          onChange={handleChange}
          className="input"
          placeholder="Площадь"
        />

        <input
          name="pricePerSqM"
          type="number"
          value={form.pricePerSqM}
          onChange={handleChange}
          className="input"
          placeholder="Цена за м2"
        />

        <select name="status" value={form.status} onChange={handleChange} className="input">
          <option value="AVAILABLE">СВОБОДЕН</option>
          <option value="RENTED">ЗАНЯТ</option>
          <option value="PREPAID">ПРЕДОПЛАТА</option>
        </select>

        {form.status !== 'AVAILABLE' && (
          <>
            <input
              name="tenantName"
              value={form.tenantName}
              onChange={handleChange}
              className="input"
              placeholder="Арендатор"
            />

            <input
              name="rentAmount"
              type="number"
              value={form.rentAmount}
              onChange={handleChange}
              className="input"
              placeholder="Аренда"
            />

            {form.status !== 'PREPAID' && (
              <input
                name="utilitiesAmount"
                type="number"
                value={form.utilitiesAmount}
                onChange={handleChange}
                className="input"
                placeholder="Коммунальные"
              />
            )}
          </>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">
            Отмена
          </button>
          <button onClick={handleSave} className="btn-primary">
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}

