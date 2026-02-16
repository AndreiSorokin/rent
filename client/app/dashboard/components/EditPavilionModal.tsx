'use client';

import { useState } from 'react';
import { createPavilion, updatePavilion } from '@/lib/pavilions';

export function EditPavilionModal({
  storeId,
  pavilion,
  existingCategories,
  onClose,
  onSaved,
}: {
  storeId: number;
  pavilion: any;
  existingCategories?: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const normalizedCurrentCategory = pavilion?.category ?? '';
  const [form, setForm] = useState(() => ({
    number: pavilion?.number ?? '',
    category: normalizedCurrentCategory,
    squareMeters: pavilion?.squareMeters ?? '',
    pricePerSqM: pavilion?.pricePerSqM ?? '',
    status: pavilion?.status ?? 'AVAILABLE',
    tenantName: pavilion?.tenantName ?? '',
    rentAmount: pavilion?.rentAmount ?? '',
    utilitiesAmount: pavilion?.utilitiesAmount ?? '',
    advertisingAmount: pavilion?.advertisingAmount ?? '',
  }));
  const [selectedCategory, setSelectedCategory] = useState(
    normalizedCurrentCategory,
  );
  const [newCategory, setNewCategory] = useState('');
  const resolvedCategory = (newCategory.trim() || selectedCategory || '').trim();

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
        next.advertisingAmount = '';
      }

      if (name === 'status' && value === 'PREPAID') {
        next.utilitiesAmount = '0';
        next.advertisingAmount = '0';
      }

      return next;
    });
  };

  const handleSave = async () => {
    const payload = {
      number: form.number,
      category: resolvedCategory || null,
      squareMeters: Number(form.squareMeters),
      pricePerSqM: Number(form.pricePerSqM),
      status: form.status,
      tenantName: form.status === 'AVAILABLE' ? null : form.tenantName,
      rentAmount: form.status === 'AVAILABLE' ? null : Number(form.rentAmount),
      utilitiesAmount: form.status === 'AVAILABLE' ? null : Number(form.utilitiesAmount),
      advertisingAmount: form.status === 'AVAILABLE' ? null : Number(form.advertisingAmount),
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

        <div className="mb-3">
          <label className="mb-1 block text-sm font-medium text-gray-700">Номер павильона</label>
          <input
            name="number"
            value={form.number}
            onChange={handleChange}
            className="input"
          />
        </div>

        <div className="mb-3">
          <label className="mb-1 block text-sm font-medium text-gray-700">Категория</label>
          <input
            name="category"
            value={resolvedCategory}
            readOnly
            className="input bg-gray-50"
          />
        </div>

        {!newCategory.trim() ? (
          <div className="mb-3">
            <label className="mb-1 block text-sm font-medium text-gray-700">Выбор из существующих категорий</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="input"
            >
              <option value="">Выберите категорию</option>
              {(existingCategories || []).map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <p className="mb-3 text-xs text-gray-500">
            Введите новую категорию: выбор из существующих скрыт.
          </p>
        )}

        {!selectedCategory ? (
          <div className="mb-3">
            <label className="mb-1 block text-sm font-medium text-gray-700">Новая категория</label>
            <input
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="input"
            />
          </div>
        ) : (
          <p className="mb-3 text-xs text-gray-500">
            Выбрана существующая категория: поле новой категории скрыто.
          </p>
        )}

        <div className="mb-3">
          <label className="mb-1 block text-sm font-medium text-gray-700">Площадь (м2)</label>
          <input
            name="squareMeters"
            type="number"
            value={form.squareMeters}
            onChange={handleChange}
            className="input"
          />
        </div>

        <div className="mb-3">
          <label className="mb-1 block text-sm font-medium text-gray-700">Цена за м2</label>
          <input
            name="pricePerSqM"
            type="number"
            value={form.pricePerSqM}
            onChange={handleChange}
            className="input"
          />
        </div>

        <div className="mb-3">
          <label className="mb-1 block text-sm font-medium text-gray-700">Статус</label>
          <select name="status" value={form.status} onChange={handleChange} className="input">
            <option value="AVAILABLE">СВОБОДЕН</option>
            <option value="RENTED">ЗАНЯТ</option>
            <option value="PREPAID">ПРЕДОПЛАТА</option>
          </select>
        </div>

        {form.status !== 'AVAILABLE' && (
          <>
            <div className="mb-3">
              <label className="mb-1 block text-sm font-medium text-gray-700">Наименование организации</label>
              <input
                name="tenantName"
                value={form.tenantName}
                onChange={handleChange}
                className="input"
              />
            </div>

            <div className="mb-3">
              <label className="mb-1 block text-sm font-medium text-gray-700">Аренда</label>
              <input
                name="rentAmount"
                type="number"
                value={form.rentAmount}
                onChange={handleChange}
                className="input"
              />
            </div>

            {form.status !== 'PREPAID' && (
              <>
                <div className="mb-3">
                  <label className="mb-1 block text-sm font-medium text-gray-700">Коммунальные</label>
                  <input
                    name="utilitiesAmount"
                    type="number"
                    value={form.utilitiesAmount}
                    onChange={handleChange}
                    className="input"
                  />
                </div>
                <div className="mb-3">
                  <label className="mb-1 block text-sm font-medium text-gray-700">Реклама</label>
                  <input
                    name="advertisingAmount"
                    type="number"
                    value={form.advertisingAmount}
                    onChange={handleChange}
                    className="input"
                  />
                </div>
              </>
            )}

            {form.status === 'PREPAID' && (
              <div className="mb-3">
                <label className="mb-1 block text-sm font-medium text-gray-700">Реклама</label>
                <input
                  name="advertisingAmount"
                  type="number"
                  value={form.advertisingAmount}
                  onChange={handleChange}
                  className="input"
                  disabled
                />
              </div>
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

