'use client';

import { useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { createAdditionalCharge, deleteAdditionalCharge } from '@/lib/additionalCharges';
import { createPavilionPayment } from '@/lib/payments';
import { updatePavilion } from '@/lib/pavilions';

type PavilionStatus = 'AVAILABLE' | 'RENTED' | 'PREPAID';

type PavilionLike = {
  id: number;
  number?: string;
  category?: string | null;
  squareMeters?: number | null;
  pricePerSqM?: number | null;
  status?: PavilionStatus | string;
  tenantName?: string | null;
  utilitiesAmount?: number | null;
  advertisingAmount?: number | null;
  additionalCharges?: Array<{
    id: number;
    name: string;
    amount: number;
  }>;
};

const STATUS_OPTIONS: Array<{ value: PavilionStatus; label: string }> = [
  { value: 'AVAILABLE', label: 'РЎР’РћР‘РћР”Р•Рќ' },
  { value: 'RENTED', label: 'Р—РђРќРЇРў' },
  { value: 'PREPAID', label: 'РџР Р•Р”РћРџР›РђРўРђ' },
];

export function EditPavilionModal({
  storeId,
  pavilion,
  existingCategories,
  canManageAdditionalCharges = false,
  onClose,
  onSaved,
}: {
  storeId: number;
  pavilion: PavilionLike;
  existingCategories?: string[];
  canManageAdditionalCharges?: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const normalizedCurrentCategory = pavilion?.category ?? '';
  const [form, setForm] = useState<{
    number: string;
    squareMeters: string;
    pricePerSqM: string;
    status: PavilionStatus;
    tenantName: string;
    utilitiesAmount: string;
    advertisingAmount: string;
  }>(() => ({
    number: pavilion?.number ?? '',
    squareMeters:
      pavilion?.squareMeters != null ? String(pavilion.squareMeters) : '',
    pricePerSqM:
      pavilion?.pricePerSqM != null ? String(pavilion.pricePerSqM) : '',
    status:
      pavilion?.status === 'RENTED' || pavilion?.status === 'PREPAID'
        ? pavilion.status
        : 'AVAILABLE',
    tenantName: pavilion?.tenantName ?? '',
    utilitiesAmount:
      pavilion?.utilitiesAmount != null ? String(pavilion.utilitiesAmount) : '',
    advertisingAmount:
      pavilion?.advertisingAmount != null
        ? String(pavilion.advertisingAmount)
        : '',
  }));
  const [selectedCategory, setSelectedCategory] = useState(
    normalizedCurrentCategory,
  );
  const [newCategory, setNewCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prepaymentMonth, setPrepaymentMonth] = useState(
    new Date().toISOString().slice(0, 7),
  );
  const [prepaymentAmount, setPrepaymentAmount] = useState('');
  const [prepaymentBankTransferPaid, setPrepaymentBankTransferPaid] =
    useState('');
  const [prepaymentCashbox1Paid, setPrepaymentCashbox1Paid] = useState('');
  const [prepaymentCashbox2Paid, setPrepaymentCashbox2Paid] = useState('');
  const [additionalCharges, setAdditionalCharges] = useState<
    Array<{ id: number; name: string; amount: number }>
  >(() => [...(pavilion.additionalCharges || [])]);
  const [newChargeName, setNewChargeName] = useState('');
  const [newChargeAmount, setNewChargeAmount] = useState('');
  const [chargeSaving, setChargeSaving] = useState(false);
  const modalBodyRef = useRef<HTMLDivElement | null>(null);

  const setErrorAndScrollTop = (message: string) => {
    setError(message);
    requestAnimationFrame(() => {
      modalBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    });
  };

  const resolvedCategory = (newCategory.trim() || selectedCategory || '').trim();
  const squareMeters = Number(form.squareMeters || 0);
  const pricePerSqM = Number(form.pricePerSqM || 0);
  const rentAmount = Math.max(squareMeters, 0) * Math.max(pricePerSqM, 0);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setError(null);

    setForm((prev) => {
      const next = { ...prev, [name]: value };

      if (name === 'status' && value === 'AVAILABLE') {
        next.tenantName = '';
      }

      if (name === 'status' && value === 'PREPAID') {
        next.utilitiesAmount = '0';
        next.advertisingAmount = '0';
      }

      if (name === 'status' && value === 'RENTED') {
        if (!next.utilitiesAmount) next.utilitiesAmount = '0';
        if (!next.advertisingAmount) next.advertisingAmount = '0';
      }

      return next;
    });
  };

  const handleSave = async () => {
    const parsedSquareMeters = Number(form.squareMeters);
    const parsedPricePerSqM = Number(form.pricePerSqM);
    const parsedUtilities =
      form.status === 'RENTED' ? Number(form.utilitiesAmount || 0) : 0;
    const parsedAdvertising =
      form.status === 'RENTED' ? Number(form.advertisingAmount || 0) : 0;

    if (!form.number.trim()) {
      setErrorAndScrollTop('РЈРєР°Р¶РёС‚Рµ РЅРѕРјРµСЂ РїР°РІРёР»СЊРѕРЅР°');
      return;
    }
    if (!Number.isFinite(parsedSquareMeters) || parsedSquareMeters <= 0) {
      setErrorAndScrollTop('РџР»РѕС‰Р°РґСЊ РґРѕР»Р¶РЅР° Р±С‹С‚СЊ Р±РѕР»СЊС€Рµ 0');
      return;
    }
    if (!Number.isFinite(parsedPricePerSqM) || parsedPricePerSqM < 0) {
      setErrorAndScrollTop('Р¦РµРЅР° Р·Р° РјВІ РґРѕР»Р¶РЅР° Р±С‹С‚СЊ РЅРµРѕС‚СЂРёС†Р°С‚РµР»СЊРЅРѕР№');
      return;
    }
    if (form.status !== 'AVAILABLE' && !form.tenantName.trim()) {
      setErrorAndScrollTop('РЈРєР°Р¶РёС‚Рµ Р°СЂРµРЅРґР°С‚РѕСЂР° РґР»СЏ Р·Р°РЅСЏС‚С‹С…/РїСЂРµРґРѕРїР»Р°С‡РµРЅРЅС‹С… РїР°РІРёР»СЊРѕРЅРѕРІ');
      return;
    }
    if (
      !Number.isFinite(parsedUtilities) ||
      !Number.isFinite(parsedAdvertising) ||
      parsedUtilities < 0 ||
      parsedAdvertising < 0
    ) {
      setErrorAndScrollTop('РљРѕРјРјСѓРЅР°Р»СЊРЅС‹Рµ Рё СЂРµРєР»Р°РјР° РґРѕР»Р¶РЅС‹ Р±С‹С‚СЊ РЅРµРѕС‚СЂРёС†Р°С‚РµР»СЊРЅС‹РјРё');
      return;
    }

    const periodIso = new Date(`${prepaymentMonth}-01`).toISOString();
    const targetPrepayment = prepaymentAmount ? Number(prepaymentAmount) : rentAmount;
    const prepayBank = prepaymentBankTransferPaid
      ? Number(prepaymentBankTransferPaid)
      : 0;
    const prepayCash1 = prepaymentCashbox1Paid ? Number(prepaymentCashbox1Paid) : 0;
    const prepayCash2 = prepaymentCashbox2Paid ? Number(prepaymentCashbox2Paid) : 0;
    const prepayChannelsTotal = prepayBank + prepayCash1 + prepayCash2;

    if (form.status === 'PREPAID') {
      if (targetPrepayment <= 0) {
        setErrorAndScrollTop('РЎСѓРјРјР° РїСЂРµРґРѕРїР»Р°С‚С‹ РґРѕР»Р¶РЅР° Р±С‹С‚СЊ Р±РѕР»СЊС€Рµ 0');
        return;
      }
      if (Math.abs(prepayChannelsTotal - targetPrepayment) > 0.01) {
        setErrorAndScrollTop('РЎСѓРјРјР° РїРѕ РєР°РЅР°Р»Р°Рј РѕРїР»Р°С‚С‹ РґРѕР»Р¶РЅР° СЃРѕРІРїР°РґР°С‚СЊ СЃ СЃСѓРјРјРѕР№ РїСЂРµРґРѕРїР»Р°С‚С‹');
        return;
      }
    }

    const payload = {
      number: form.number.trim(),
      category: resolvedCategory || null,
      squareMeters: parsedSquareMeters,
      pricePerSqM: parsedPricePerSqM,
      status: form.status,
      prepaidUntil: form.status === 'PREPAID' ? periodIso : null,
      tenantName: form.status === 'AVAILABLE' ? null : form.tenantName.trim(),
      utilitiesAmount:
        form.status === 'RENTED'
          ? parsedUtilities
          : form.status === 'PREPAID'
            ? 0
            : null,
      advertisingAmount:
        form.status === 'RENTED'
          ? parsedAdvertising
          : form.status === 'PREPAID'
            ? 0
            : null,
    };

    try {
      setSaving(true);
      setError(null);
      await updatePavilion(storeId, pavilion.id, payload);
      if (form.status === 'PREPAID') {
        const selectedPeriodDate = new Date(periodIso);
        const payments = await apiFetch<any[]>(
          `/stores/${storeId}/pavilions/${pavilion.id}/payments?period=${encodeURIComponent(
            selectedPeriodDate.toISOString(),
          )}`,
        );
        const existingForPeriod = payments[0];
        const currentRentPaid = Number(existingForPeriod?.rentPaid ?? 0);
        const currentRentBank = Number(existingForPeriod?.rentBankTransferPaid ?? 0);
        const currentRentCash1 = Number(existingForPeriod?.rentCashbox1Paid ?? 0);
        const currentRentCash2 = Number(existingForPeriod?.rentCashbox2Paid ?? 0);
                let rentDelta = targetPrepayment - currentRentPaid;
        let rentBankDelta = prepayBank - currentRentBank;
        let rentCash1Delta = prepayCash1 - currentRentCash1;
        let rentCash2Delta = prepayCash2 - currentRentCash2;

        if (
          rentDelta < -0.01 ||
          rentBankDelta < -0.01 ||
          rentCash1Delta < -0.01 ||
          rentCash2Delta < -0.01
        ) {
          if (existingForPeriod?.id) {
            await apiFetch(
              `/stores/${storeId}/pavilions/${pavilion.id}/payments/entries/${existingForPeriod.id}`,
              { method: 'DELETE' },
            );
          }
          rentDelta = targetPrepayment;
          rentBankDelta = prepayBank;
          rentCash1Delta = prepayCash1;
          rentCash2Delta = prepayCash2;
        }

        if (Math.abs(rentDelta) > 0.0001) {
          await createPavilionPayment(storeId, pavilion.id, {
            period: periodIso,
            rentPaid: rentDelta,
            rentBankTransferPaid: rentBankDelta > 0 ? rentBankDelta : undefined,
            rentCashbox1Paid: rentCash1Delta > 0 ? rentCash1Delta : undefined,
            rentCashbox2Paid: rentCash2Delta > 0 ? rentCash2Delta : undefined,
            utilitiesPaid: 0,
            advertisingPaid: 0,
          });
        }
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕС…СЂР°РЅРёС‚СЊ РёР·РјРµРЅРµРЅРёСЏ';
      setErrorAndScrollTop(message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddAdditionalCharge = async () => {
    const name = newChargeName.trim();
    const amount = Number(newChargeAmount);

    if (!name || !newChargeAmount) {
      setErrorAndScrollTop('Р’РІРµРґРёС‚Рµ РЅР°Р·РІР°РЅРёРµ Рё СЃСѓРјРјСѓ РґРѕРїРѕР»РЅРёС‚РµР»СЊРЅРѕРіРѕ РЅР°С‡РёСЃР»РµРЅРёСЏ');
      return;
    }
    if (!Number.isFinite(amount) || amount < 0) {
      setErrorAndScrollTop('РЎСѓРјРјР° РґРѕРїРѕР»РЅРёС‚РµР»СЊРЅРѕРіРѕ РЅР°С‡РёСЃР»РµРЅРёСЏ РґРѕР»Р¶РЅР° Р±С‹С‚СЊ РЅРµРѕС‚СЂРёС†Р°С‚РµР»СЊРЅРѕР№');
      return;
    }

    try {
      setChargeSaving(true);
      setError(null);
      const created = await createAdditionalCharge(pavilion.id, { name, amount });
      setAdditionalCharges((prev) => [...prev, created as any]);
      setNewChargeName('');
      setNewChargeAmount('');
      onSaved();
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'РќРµ СѓРґР°Р»РѕСЃСЊ РґРѕР±Р°РІРёС‚СЊ РґРѕРїРѕР»РЅРёС‚РµР»СЊРЅРѕРµ РЅР°С‡РёСЃР»РµРЅРёРµ';
      setErrorAndScrollTop(message);
    } finally {
      setChargeSaving(false);
    }
  };

  const handleDeleteAdditionalCharge = async (chargeId: number) => {
    if (!confirm('РЈРґР°Р»РёС‚СЊ СЌС‚Рѕ РґРѕРїРѕР»РЅРёС‚РµР»СЊРЅРѕРµ РЅР°С‡РёСЃР»РµРЅРёРµ?')) return;

    try {
      setChargeSaving(true);
      setError(null);
      await deleteAdditionalCharge(pavilion.id, chargeId);
      setAdditionalCharges((prev) => prev.filter((item) => item.id !== chargeId));
      onSaved();
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'РќРµ СѓРґР°Р»РѕСЃСЊ СѓРґР°Р»РёС‚СЊ РґРѕРїРѕР»РЅРёС‚РµР»СЊРЅРѕРµ РЅР°С‡РёСЃР»РµРЅРёРµ';
      setErrorAndScrollTop(message);
    } finally {
      setChargeSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        ref={modalBodyRef}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded bg-white"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
          <h2 className="text-lg font-bold">Р РµРґР°РєС‚РёСЂРѕРІР°С‚СЊ РїР°РІРёР»СЊРѕРЅ</h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Р—Р°РєСЂС‹С‚СЊ"
          >
            <span aria-hidden>вњ•</span>
          </button>
        </div>
        <div className="p-6">

        {error && (
          <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mb-3">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            РќРѕРјРµСЂ РїР°РІРёР»СЊРѕРЅР°
          </label>
          <input
            name="number"
            value={form.number}
            onChange={handleChange}
            className="input"
          />
        </div>

        <div className="mb-3">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            РљР°С‚РµРіРѕСЂРёСЏ
          </label>
          <input value={resolvedCategory} readOnly className="input bg-gray-50" />
        </div>

        {!newCategory.trim() ? (
          <div className="mb-3">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Р’С‹Р±РѕСЂ РёР· СЃСѓС‰РµСЃС‚РІСѓСЋС‰РёС… РєР°С‚РµРіРѕСЂРёР№
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="input"
            >
              <option value="">Р’С‹Р±РµСЂРёС‚Рµ РєР°С‚РµРіРѕСЂРёСЋ</option>
              {(existingCategories || []).map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <p className="mb-3 text-xs text-gray-500">
            Р’РІРµРґРёС‚Рµ РЅРѕРІСѓСЋ РєР°С‚РµРіРѕСЂРёСЋ: РІС‹Р±РѕСЂ РёР· СЃСѓС‰РµСЃС‚РІСѓСЋС‰РёС… СЃРєСЂС‹С‚.
          </p>
        )}

        {!selectedCategory ? (
          <div className="mb-3">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              РќРѕРІР°СЏ РєР°С‚РµРіРѕСЂРёСЏ
            </label>
            <input
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="input"
            />
          </div>
        ) : (
          <p className="mb-3 text-xs text-gray-500">
            Р’С‹Р±СЂР°РЅР° СЃСѓС‰РµСЃС‚РІСѓСЋС‰Р°СЏ РєР°С‚РµРіРѕСЂРёСЏ: РїРѕР»Рµ РЅРѕРІРѕР№ РєР°С‚РµРіРѕСЂРёРё СЃРєСЂС‹С‚Рѕ.
          </p>
        )}

        <div className="mb-3">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            РџР»РѕС‰Р°РґСЊ (РјВІ)
          </label>
          <input
            name="squareMeters"
            type="number"
            min={0}
            step="0.01"
            value={form.squareMeters}
            onChange={handleChange}
            className="input"
          />
        </div>

        <div className="mb-3">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Р¦РµРЅР° Р·Р° РјВІ
          </label>
          <input
            name="pricePerSqM"
            type="number"
            min={0}
            step="0.01"
            value={form.pricePerSqM}
            onChange={handleChange}
            className="input"
          />
        </div>

        <div className="mb-3">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            РђСЂРµРЅРґР° (Р°РІС‚РѕСЂР°СЃС‡РµС‚)
          </label>
          <input
            type="number"
            value={Number.isFinite(rentAmount) ? rentAmount : 0}
            readOnly
            className="input bg-gray-50"
          />
        </div>

        <div className="mb-3">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            РЎС‚Р°С‚СѓСЃ
          </label>
          <select
            name="status"
            value={form.status}
            onChange={handleChange}
            className="input"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {form.status !== 'AVAILABLE' && (
          <>
            <div className="mb-3">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                РќР°РёРјРµРЅРѕРІР°РЅРёРµ РѕСЂРіР°РЅРёР·Р°С†РёРё
              </label>
              <input
                name="tenantName"
                value={form.tenantName}
                onChange={handleChange}
                className="input"
              />
            </div>

            {form.status === 'RENTED' && (
              <>
                <div className="mb-3">
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    РљРѕРјРјСѓРЅР°Р»СЊРЅС‹Рµ
                  </label>
                  <input
                    name="utilitiesAmount"
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.utilitiesAmount}
                    onChange={handleChange}
                    className="input"
                  />
                </div>
                <div className="mb-3">
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Р РµРєР»Р°РјР°
                  </label>
                  <input
                    name="advertisingAmount"
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.advertisingAmount}
                    onChange={handleChange}
                    className="input"
                  />
                </div>
                <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="mb-2 text-sm font-medium text-gray-700">
                    Р”РѕРїРѕР»РЅРёС‚РµР»СЊРЅС‹Рµ РЅР°С‡РёСЃР»РµРЅРёСЏ
                  </p>
                  {additionalCharges.length === 0 ? (
                    <p className="mb-2 text-xs text-gray-500">РќР°С‡РёСЃР»РµРЅРёР№ РїРѕРєР° РЅРµС‚</p>
                  ) : (
                    <div className="mb-3 space-y-2">
                      {additionalCharges.map((charge) => (
                        <div
                          key={charge.id}
                          className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0">
                            <span className="font-medium">{charge.name}: </span>
                            <span className="ml-2 text-gray-600">{charge.amount.toFixed(2)}</span>
                          </div>
                          {canManageAdditionalCharges && (
                            <button
                              type="button"
                              onClick={() => handleDeleteAdditionalCharge(charge.id)}
                              disabled={chargeSaving}
                              className="self-start rounded border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-60 sm:self-auto"
                            >
                              РЈРґР°Р»РёС‚СЊ
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {canManageAdditionalCharges && (
                    <div>
                      <div>РќРѕРІРѕРµ РЅР°С‡РёСЃР»РµРЅРёРµ:</div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_140px]">
                      <input
                        value={newChargeName}
                        onChange={(e) => setNewChargeName(e.target.value)}
                        className="input"
                        placeholder="РќР°Р·РІР°РЅРёРµ РЅР°С‡РёСЃР»РµРЅРёСЏ"
                      />
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={newChargeAmount}
                        onChange={(e) => setNewChargeAmount(e.target.value)}
                        className="input"
                        placeholder="РЎСѓРјРјР°"
                      />
                      <button
                        type="button"
                        onClick={handleAddAdditionalCharge}
                        disabled={chargeSaving}
                        className="w-full rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 sm:w-auto"
                      >
                        Р”РѕР±Р°РІРёС‚СЊ
                      </button>
                    </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {form.status === 'PREPAID' && (
              <>
                <div className="mb-3 rounded bg-blue-50 px-3 py-2 text-xs text-blue-700">
                  Р”Р»СЏ СЃС‚Р°С‚СѓСЃР° РџР Р•Р”РћРџР›РђРўРђ РєРѕРјРјСѓРЅР°Р»СЊРЅС‹Рµ Рё СЂРµРєР»Р°РјР° Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё СЂР°РІРЅС‹ 0.
                </div>
                <div className="mb-3">
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    РњРµСЃСЏС† РїСЂРµРґРѕРїР»Р°С‚С‹
                  </label>
                  <input
                    type="month"
                    value={prepaymentMonth}
                    onChange={(e) => setPrepaymentMonth(e.target.value)}
                    className="input"
                  />
                </div>
                <div className="mb-3">
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    РЎСѓРјРјР° РїСЂРµРґРѕРїР»Р°С‚С‹ (РµСЃР»Рё РїСѓСЃС‚Рѕ - РїРѕР»РЅР°СЏ Р°СЂРµРЅРґР°)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={prepaymentAmount}
                    onChange={(e) => setPrepaymentAmount(e.target.value)}
                    className="input"
                    placeholder={rentAmount.toFixed(2)}
                  />
                </div>
                <div className="mb-3 rounded border p-3">
                  <p className="mb-2 text-sm font-medium text-gray-700">
                    РљР°РЅР°Р»С‹ РѕРїР»Р°С‚С‹ РїСЂРµРґРѕРїР»Р°С‚С‹
                  </p>
                  <div className="space-y-2">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={prepaymentBankTransferPaid}
                      onChange={(e) =>
                        setPrepaymentBankTransferPaid(e.target.value)
                      }
                      className="input"
                      placeholder="Р‘РµР·РЅР°Р»РёС‡РЅС‹Рµ"
                    />
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={prepaymentCashbox1Paid}
                      onChange={(e) => setPrepaymentCashbox1Paid(e.target.value)}
                      className="input"
                      placeholder="РќР°Р»РёС‡РЅС‹Рµ - РєР°СЃСЃР° 1"
                    />
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={prepaymentCashbox2Paid}
                      onChange={(e) => setPrepaymentCashbox2Paid(e.target.value)}
                      className="input"
                      placeholder="РќР°Р»РёС‡РЅС‹Рµ - РєР°СЃСЃР° 2"
                    />
                  </div>
                </div>
              </>
            )}
          </>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary" disabled={saving}>
            РћС‚РјРµРЅР°
          </button>
          <button onClick={handleSave} className="btn-primary" disabled={saving}>
            {saving ? 'РЎРѕС…СЂР°РЅРµРЅРёРµ...' : 'РЎРѕС…СЂР°РЅРёС‚СЊ'}
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}

