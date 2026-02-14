'use client';

import { useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';

type ParsedSheet = {
  headers: string[];
  rows: Array<Record<string, any>>;
};

type SheetRows = Record<string, ParsedSheet>;

type SectionKey = 'pavilions' | 'householdExpenses' | 'expenses' | 'accounting' | 'staff';

type SectionState = {
  enabled: boolean;
  sheet: string;
  mappings: Record<string, string>;
};

const SECTION_FIELDS: Record<SectionKey, Array<{ key: string; label: string; required?: boolean }>> = {
  pavilions: [
    { key: 'number', label: 'Номер павильона', required: true },
    { key: 'category', label: 'Категория' },
    { key: 'squareMeters', label: 'Площадь', required: true },
    { key: 'pricePerSqM', label: 'Цена за м2', required: true },
    { key: 'status', label: 'Статус' },
    { key: 'tenantName', label: 'Арендатор' },
    { key: 'utilitiesAmount', label: 'Коммуналка' },
  ],
  householdExpenses: [
    { key: 'name', label: 'Название расхода', required: true },
    { key: 'amount', label: 'Сумма', required: true },
    { key: 'status', label: 'Статус' },
  ],
  expenses: [
    { key: 'type', label: 'Тип расхода', required: true },
    { key: 'amount', label: 'Сумма', required: true },
    { key: 'status', label: 'Статус' },
    { key: 'note', label: 'Комментарий' },
  ],
  accounting: [
    { key: 'recordDate', label: 'Дата', required: true },
    { key: 'bankTransferPaid', label: 'Безналичные' },
    { key: 'cashbox1Paid', label: 'Наличные касса 1' },
    { key: 'cashbox2Paid', label: 'Наличные касса 2' },
  ],
  staff: [
    { key: 'fullName', label: 'Имя фамилия', required: true },
    { key: 'position', label: 'Должность', required: true },
    { key: 'salary', label: 'Зарплата' },
    { key: 'salaryStatus', label: 'Статус выплаты' },
  ],
};

const HEADER_ALIASES: Record<string, string[]> = {
  number: ['номер', 'павильон', 'pavilion', 'number'],
  category: ['катег', 'category'],
  squareMeters: ['площад', 'м2', 'кв', 'square'],
  pricePerSqM: ['цена', 'за м2', 'price'],
  status: ['статус', 'status'],
  tenantName: ['арендатор', 'tenant'],
  utilitiesAmount: ['коммун', 'utilities'],
  name: ['название', 'наименование', 'name'],
  amount: ['сумма', 'amount'],
  type: ['тип', 'категория расхода', 'expense type'],
  note: ['комментар', 'примеч', 'note'],
  recordDate: ['дата', 'date'],
  bankTransferPaid: ['безнал', 'банк', 'bank'],
  cashbox1Paid: ['касса 1', 'cash1'],
  cashbox2Paid: ['касса 2', 'cash2'],
  fullName: ['имя', 'фио', 'full name'],
  position: ['должность', 'position'],
  salary: ['зарплат', 'salary'],
  salaryStatus: ['статус выплаты', 'статус зарплаты'],
};

const HEADER_HINTS = Array.from(
  new Set(
    Object.values(HEADER_ALIASES)
      .flat()
      .map((v) => normalizeText(v))
      .filter((v) => v.length > 0),
  ),
);

const EXPENSE_TYPE_MAP: Record<string, string> = {
  'налоги с зарплаты': 'PAYROLL_TAX',
  'налог на прибыль': 'PROFIT_TAX',
  дивиденды: 'DIVIDENDS',
  'услуги банка': 'BANK_SERVICES',
  ндс: 'VAT',
  'аренда земли': 'LAND_RENT',
  'прочие расходы': 'OTHER',
};

function normalizeText(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

function parseNumber(value: unknown) {
  const raw = String(value ?? '').replace(/\s/g, '').replace(',', '.');
  const n = Number(raw);
  return Number.isNaN(n) ? null : n;
}

function mapStatus(value: unknown): 'UNPAID' | 'PAID' {
  const v = normalizeText(value);
  if (v.includes('оплач') || v === 'paid') return 'PAID';
  return 'UNPAID';
}

function mapPavilionStatus(value: unknown): 'AVAILABLE' | 'RENTED' | 'PREPAID' {
  const v = normalizeText(value);
  if (v.includes('предоп') || v.includes('prepaid')) return 'PREPAID';
  if (v.includes('занят') || v.includes('rented')) return 'RENTED';
  return 'AVAILABLE';
}

function mapExpenseType(value: unknown) {
  const v = normalizeText(value);
  for (const [k, mapped] of Object.entries(EXPENSE_TYPE_MAP)) {
    if (v.includes(k)) return mapped;
  }
  return 'OTHER';
}

function autoDetectHeader(headers: string[], fieldKey: string) {
  const aliases = HEADER_ALIASES[fieldKey] ?? [];
  const normalizedHeaders = headers.map((h) => ({ raw: h, normalized: normalizeText(h) }));
  for (const alias of aliases) {
    const found = normalizedHeaders.find((h) => h.normalized.includes(alias));
    if (found) return found.raw;
  }
  return '';
}

function toHeaderName(value: unknown, fallbackIndex: number) {
  const raw = String(value ?? '').trim();
  return raw.length > 0 ? raw : '';
}

function buildHeaderMap(headerRow: any[]) {
  const seen = new Map<string, number>();
  const map: Array<{ index: number; header: string }> = [];

  headerRow.forEach((cell, idx) => {
    const base = toHeaderName(cell, idx);
    if (!base) return;

    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    const header = count === 0 ? base : `${base} (${count + 1})`;
    map.push({ index: idx, header });
  });

  return map;
}

function detectHeaderRow(matrix: any[][]) {
  const maxRowsToScan = Math.min(matrix.length, 100);
  let bestRow = 0;
  let bestScore = -1;

  for (let i = 0; i < maxRowsToScan; i += 1) {
    const row = matrix[i] ?? [];
    if (row.length === 0) continue;

    const nonEmpty = row.filter((c) => String(c ?? '').trim().length > 0).length;
    const textCells = row.filter((c) => {
      const v = String(c ?? '').trim();
      if (!v) return false;
      return Number.isNaN(Number(v.replace(',', '.')));
    }).length;
    const normalizedCells = row
      .map((c) => normalizeText(c))
      .filter((v) => v.length > 0);
    const aliasHits = HEADER_HINTS.reduce((sum, hint) => {
      const has = normalizedCells.some((cell) => cell.includes(hint));
      return sum + (has ? 1 : 0);
    }, 0);
    const score = aliasHits * 100 + nonEmpty * 2 + textCells;

    if (score > bestScore) {
      bestScore = score;
      bestRow = i;
    }
  }

  return bestRow;
}

export function ImportStoreDataModal({
  storeId,
  onClose,
  onImported,
}: {
  storeId: number;
  onClose: () => void;
  onImported: () => void;
}) {
  const [sheetRows, setSheetRows] = useState<SheetRows>({});
  const [sections, setSections] = useState<Record<SectionKey, SectionState>>({
    pavilions: { enabled: true, sheet: '', mappings: {} },
    householdExpenses: { enabled: true, sheet: '', mappings: {} },
    expenses: { enabled: true, sheet: '', mappings: {} },
    accounting: { enabled: true, sheet: '', mappings: {} },
    staff: { enabled: true, sheet: '', mappings: {} },
  });
  const [importing, setImporting] = useState(false);

  const sheetNames = useMemo(() => Object.keys(sheetRows), [sheetRows]);

  const handleFile = async (file: File) => {
    const XLSX = await import('xlsx');
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const rowsBySheet: SheetRows = {};
    for (const sheetName of workbook.SheetNames) {
      const ws = workbook.Sheets[sheetName];
      const matrix = XLSX.utils.sheet_to_json<any[]>(ws, {
        header: 1,
        defval: '',
        raw: false,
      }) as any[][];

      if (!matrix.length) {
        rowsBySheet[sheetName] = { headers: [], rows: [] };
        continue;
      }

      const headerRowIndex = detectHeaderRow(matrix);
      const headerRow = matrix[headerRowIndex] ?? [];
      const headerMap = buildHeaderMap(headerRow);
      const headers = headerMap.map((h) => h.header);

      const rows = matrix
        .slice(headerRowIndex + 1)
        .map((row) => {
          const out: Record<string, any> = {};
          headerMap.forEach(({ index, header }) => {
            out[header] = row?.[index] ?? '';
          });
          return out;
        })
        .filter((row) =>
          Object.values(row).some((v) => String(v ?? '').trim().length > 0),
        );

      rowsBySheet[sheetName] = { headers, rows };
    }
    setSheetRows(rowsBySheet);

    const firstSheet = workbook.SheetNames[0] ?? '';
    const initSections = { ...sections };
    (Object.keys(initSections) as SectionKey[]).forEach((key) => {
      initSections[key] = { ...initSections[key], sheet: firstSheet, mappings: {} };
      const headers = rowsBySheet[firstSheet]?.headers ?? [];
      for (const field of SECTION_FIELDS[key]) {
        initSections[key].mappings[field.key] = autoDetectHeader(headers, field.key);
      }
    });
    setSections(initSections);
  };

  const getHeaders = (section: SectionKey) =>
    sheetRows[sections[section].sheet]?.headers ?? [];

  const buildPayload = () => {
    const payload: Record<string, any[]> = {};

    for (const [sectionKey, state] of Object.entries(sections) as [SectionKey, SectionState][]) {
      if (!state.enabled || !state.sheet) continue;
      const rows = sheetRows[state.sheet]?.rows ?? [];
      const fields = SECTION_FIELDS[sectionKey];

      const mappedRows = rows
        .map((row) => {
          const out: Record<string, any> = {};
          for (const f of fields) {
            const header = state.mappings[f.key];
            if (header) out[f.key] = row[header];
          }
          return out;
        })
        .filter((row) => {
          const required = fields.filter((f) => f.required).map((f) => f.key);
          return required.every((k) => normalizeText(row[k]).length > 0);
        });

      if (sectionKey === 'pavilions') {
        payload.pavilions = mappedRows
          .map((r) => ({
            number: String(r.number ?? '').trim(),
            category: r.category ? String(r.category).trim() : null,
            squareMeters: parseNumber(r.squareMeters),
            pricePerSqM: parseNumber(r.pricePerSqM),
            status: mapPavilionStatus(r.status),
            tenantName: r.tenantName ? String(r.tenantName).trim() : null,
            utilitiesAmount: parseNumber(r.utilitiesAmount),
          }))
          .filter((r) => r.number && r.squareMeters != null && r.pricePerSqM != null);
      }

      if (sectionKey === 'householdExpenses') {
        payload.householdExpenses = mappedRows
          .map((r) => ({
            name: String(r.name ?? '').trim(),
            amount: parseNumber(r.amount),
            status: mapStatus(r.status),
          }))
          .filter((r) => r.name && r.amount != null);
      }

      if (sectionKey === 'expenses') {
        payload.expenses = mappedRows
          .map((r) => ({
            type: mapExpenseType(r.type),
            amount: parseNumber(r.amount),
            status: mapStatus(r.status),
            note: r.note ? String(r.note).trim() : null,
          }))
          .filter((r) => r.amount != null);
      }

      if (sectionKey === 'accounting') {
        payload.accounting = mappedRows
          .map((r) => ({
            recordDate: String(r.recordDate ?? '').trim(),
            bankTransferPaid: parseNumber(r.bankTransferPaid) ?? 0,
            cashbox1Paid: parseNumber(r.cashbox1Paid) ?? 0,
            cashbox2Paid: parseNumber(r.cashbox2Paid) ?? 0,
          }))
          .filter((r) => r.recordDate.length > 0);
      }

      if (sectionKey === 'staff') {
        payload.staff = mappedRows
          .map((r) => ({
            fullName: String(r.fullName ?? '').trim(),
            position: String(r.position ?? '').trim(),
            salary: parseNumber(r.salary) ?? 0,
            salaryStatus: mapStatus(r.salaryStatus),
          }))
          .filter((r) => r.fullName && r.position);
      }
    }

    return payload;
  };

  const handleImport = async () => {
    try {
      setImporting(true);
      const payload = buildPayload();
      await apiFetch(`/stores/${storeId}/import-data`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      onImported();
    } catch (e) {
      console.error(e);
      alert('Не удалось импортировать данные');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-5xl overflow-auto rounded-xl bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Загрузка данных из Excel</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            Закрыть
          </button>
        </div>

        <div className="mb-5">
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
        </div>

        {sheetNames.length > 0 && (
          <div className="space-y-4">
            {(Object.keys(SECTION_FIELDS) as SectionKey[]).map((sectionKey) => (
              <div key={sectionKey} className="rounded-lg border p-4">
                <div className="mb-3 flex items-center justify-between">
                  <label className="font-medium">
                    <input
                      type="checkbox"
                      checked={sections[sectionKey].enabled}
                      onChange={(e) =>
                        setSections((prev) => ({
                          ...prev,
                          [sectionKey]: {
                            ...prev[sectionKey],
                            enabled: e.target.checked,
                          },
                        }))
                      }
                      className="mr-2"
                    />
                    {sectionKey}
                  </label>
                  <select
                    value={sections[sectionKey].sheet}
                    onChange={(e) =>
                      setSections((prev) => ({
                        ...prev,
                        [sectionKey]: {
                          ...prev[sectionKey],
                          sheet: e.target.value,
                        },
                      }))
                    }
                    className="rounded border px-2 py-1 text-sm"
                  >
                    {sheetNames.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {SECTION_FIELDS[sectionKey].map((field) => (
                    <label key={field.key} className="text-sm">
                      <div className="mb-1">
                        {field.label} {field.required ? '*' : ''}
                      </div>
                      <input
                        type="text"
                        list={`headers-${sectionKey}-${field.key}`}
                        value={sections[sectionKey].mappings[field.key] ?? ''}
                        onChange={(e) =>
                          setSections((prev) => ({
                            ...prev,
                            [sectionKey]: {
                              ...prev[sectionKey],
                              mappings: {
                                ...prev[sectionKey].mappings,
                                [field.key]: e.target.value,
                              },
                            },
                          }))
                        }
                        className="w-full rounded border px-2 py-1"
                        placeholder="Начните вводить название колонки"
                      />
                      <datalist id={`headers-${sectionKey}-${field.key}`}>
                        <option value="">Не выбрано</option>
                        {getHeaders(sectionKey).map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </datalist>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="rounded border px-4 py-2">
            Отмена
          </button>
          <button
            onClick={handleImport}
            disabled={importing || sheetNames.length === 0}
            className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-60"
          >
            {importing ? 'Импорт...' : 'Импортировать'}
          </button>
        </div>
      </div>
    </div>
  );
}
