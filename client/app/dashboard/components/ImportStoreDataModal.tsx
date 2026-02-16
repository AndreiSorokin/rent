'use client';

import { useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';

type ParsedResult = {
  pavilions: Array<{
    number: string;
    category?: string | null;
    squareMeters: number;
    pricePerSqM: number;
    status?: 'AVAILABLE' | 'RENTED' | 'PREPAID';
    tenantName?: string | null;
    utilitiesAmount?: number | null;
    advertisingAmount?: number | null;
  }>;
  householdExpenses: Array<{
    name: string;
    amount: number;
    status?: 'UNPAID' | 'PAID';
  }>;
  expenses: Array<{
    type:
      | 'PAYROLL_TAX'
      | 'PROFIT_TAX'
      | 'DIVIDENDS'
      | 'BANK_SERVICES'
      | 'VAT'
      | 'LAND_RENT'
      | 'OTHER';
    amount: number;
    status?: 'UNPAID' | 'PAID';
    note?: string | null;
  }>;
  accounting: Array<{
    recordDate: string;
    bankTransferPaid?: number;
    cashbox1Paid?: number;
    cashbox2Paid?: number;
  }>;
  staff: Array<{
    fullName: string;
    position: string;
    salary?: number;
    salaryStatus?: 'UNPAID' | 'PAID';
  }>;
};

const SHEETS = {
  pavilions: 'Павильоны',
  householdExpenses: 'РасходыНаХозЧасть',
  expenses: 'Расходы',
  accounting: 'БухТаблица',
  staff: 'Сотрудники',
} as const;

const PAVILION_COLUMNS = {
  number: 'Номер павильона',
  category: 'Категория',
  squareMeters: 'Площадь',
  pricePerSqM: 'Цена за м2',
  utilitiesAmount: 'Коммунальные',
  status: 'Статус',
  tenantName: 'Наименование организации',
  advertisingAmount: 'Реклама',
} as const;

const STATUS_VALUES = ['ЗАНЯТ', 'СВОБОДЕН', 'ПРЕДОПЛАТА'] as const;

const EXPENSE_TYPE_MAP: Record<string, ParsedResult['expenses'][number]['type']> = {
  payroll_tax: 'PAYROLL_TAX',
  profit_tax: 'PROFIT_TAX',
  dividends: 'DIVIDENDS',
  bank_services: 'BANK_SERVICES',
  vat: 'VAT',
  land_rent: 'LAND_RENT',
  other: 'OTHER',
};

function normalizeText(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

function parseNumber(value: unknown) {
  const source = String(value ?? '').trim();
  if (!source) return null;
  const cleaned = source
    .replace(/\u00A0/g, ' ')
    .replace(/\s/g, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '');
  const match = cleaned.match(/-?\d+(\.\d+)?/);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isNaN(n) ? null : n;
}

function mapPayStatus(value: unknown): 'UNPAID' | 'PAID' {
  const v = normalizeText(value);
  if (v === 'paid' || v === 'оплачено') return 'PAID';
  return 'UNPAID';
}

function mapPavilionStatus(value: unknown): 'AVAILABLE' | 'RENTED' | 'PREPAID' {
  const v = normalizeText(value);
  if (v === 'свободен' || v === 'available') return 'AVAILABLE';
  if (v === 'занят' || v === 'rented') return 'RENTED';
  if (v === 'предоплата' || v === 'prepaid') return 'PREPAID';
  return 'AVAILABLE';
}

function isSummaryText(value: unknown) {
  const v = normalizeText(value);
  return v.includes('итог') || v.includes('всего') || v.includes('total') || v.includes('sum');
}

function requireColumns(
  rows: Array<Record<string, any>>,
  columns: string[],
  sheetName: string,
  errors: string[],
) {
  if (rows.length === 0) return false;
  const headers = new Set(Object.keys(rows[0]));
  const missing = columns.filter((c) => !headers.has(c));
  if (missing.length > 0) {
    errors.push(`Лист "${sheetName}": отсутствуют колонки ${missing.join(', ')}`);
    return false;
  }
  return true;
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
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);

  const hasErrors = useMemo(() => errors.length > 0, [errors]);

  const downloadTemplate = async () => {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();

    const pavilions = XLSX.utils.aoa_to_sheet([
      [
        PAVILION_COLUMNS.number,
        PAVILION_COLUMNS.category,
        PAVILION_COLUMNS.squareMeters,
        PAVILION_COLUMNS.pricePerSqM,
        PAVILION_COLUMNS.utilitiesAmount,
        PAVILION_COLUMNS.status,
        PAVILION_COLUMNS.tenantName,
        PAVILION_COLUMNS.advertisingAmount,
      ],
    ]);

    // Dropdown list for status column in Pavilion sheet.
    (pavilions as any)['!dataValidation'] = [
      {
        sqref: 'F2:F5000',
        type: 'list',
        allowBlank: true,
        formulae: [`"${STATUS_VALUES.join(',')}"`],
      },
    ];

    const household = XLSX.utils.aoa_to_sheet([['name', 'amount', 'status']]);
    const expenses = XLSX.utils.aoa_to_sheet([['type', 'amount', 'status', 'note']]);
    const accounting = XLSX.utils.aoa_to_sheet([
      ['recordDate', 'bankTransferPaid', 'cashbox1Paid', 'cashbox2Paid'],
    ]);
    const staff = XLSX.utils.aoa_to_sheet([['fullName', 'position', 'salary', 'salaryStatus']]);

    XLSX.utils.book_append_sheet(wb, pavilions, SHEETS.pavilions);
    XLSX.utils.book_append_sheet(wb, household, SHEETS.householdExpenses);
    XLSX.utils.book_append_sheet(wb, expenses, SHEETS.expenses);
    XLSX.utils.book_append_sheet(wb, accounting, SHEETS.accounting);
    XLSX.utils.book_append_sheet(wb, staff, SHEETS.staff);

    XLSX.writeFile(wb, 'store-import-template.xlsx');
  };

  const parseTemplate = async (input: File): Promise<ParsedResult | null> => {
    const XLSX = await import('xlsx');
    const localErrors: string[] = [];
    const buffer = await input.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });

    const getSheetRows = (sheetName: string) => {
      const ws = workbook.Sheets[sheetName];
      if (!ws) {
        localErrors.push(`Не найден лист "${sheetName}"`);
        return [] as Array<Record<string, any>>;
      }
      return XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '', raw: false });
    };

    const pavilionRows = getSheetRows(SHEETS.pavilions);
    const householdRows = getSheetRows(SHEETS.householdExpenses);
    const expensesRows = getSheetRows(SHEETS.expenses);
    const accountingRows = getSheetRows(SHEETS.accounting);
    const staffRows = getSheetRows(SHEETS.staff);

    requireColumns(
      pavilionRows,
      [
        PAVILION_COLUMNS.number,
        PAVILION_COLUMNS.category,
        PAVILION_COLUMNS.squareMeters,
        PAVILION_COLUMNS.pricePerSqM,
        PAVILION_COLUMNS.utilitiesAmount,
        PAVILION_COLUMNS.status,
        PAVILION_COLUMNS.tenantName,
        PAVILION_COLUMNS.advertisingAmount,
      ],
      SHEETS.pavilions,
      localErrors,
    );
    requireColumns(householdRows, ['name', 'amount', 'status'], SHEETS.householdExpenses, localErrors);
    requireColumns(expensesRows, ['type', 'amount', 'status', 'note'], SHEETS.expenses, localErrors);
    requireColumns(
      accountingRows,
      ['recordDate', 'bankTransferPaid', 'cashbox1Paid', 'cashbox2Paid'],
      SHEETS.accounting,
      localErrors,
    );
    requireColumns(staffRows, ['fullName', 'position', 'salary', 'salaryStatus'], SHEETS.staff, localErrors);

    const pavilions: ParsedResult['pavilions'] = pavilionRows
      .map((r) => {
        const number = String(r[PAVILION_COLUMNS.number] ?? '').trim();
        const squareMeters = parseNumber(r[PAVILION_COLUMNS.squareMeters]);
        const pricePerSqM = parseNumber(r[PAVILION_COLUMNS.pricePerSqM]);
        const utilitiesAmount = parseNumber(r[PAVILION_COLUMNS.utilitiesAmount]);
        const advertisingAmount = parseNumber(r[PAVILION_COLUMNS.advertisingAmount]);
        const tenantName = String(r[PAVILION_COLUMNS.tenantName] ?? '').trim() || null;
        const rawStatus = String(r[PAVILION_COLUMNS.status] ?? '').trim();
        const status =
          rawStatus.length > 0
            ? mapPavilionStatus(rawStatus)
            : tenantName || (utilitiesAmount ?? 0) > 0 || (advertisingAmount ?? 0) > 0
              ? 'RENTED'
              : 'AVAILABLE';

        return {
          number,
          category: String(r[PAVILION_COLUMNS.category] ?? '').trim() || null,
          squareMeters: squareMeters ?? NaN,
          pricePerSqM: pricePerSqM ?? NaN,
          status,
          tenantName,
          utilitiesAmount:
            status === 'AVAILABLE'
              ? null
              : status === 'PREPAID'
                ? 0
                : (utilitiesAmount ?? 0),
          advertisingAmount:
            status === 'AVAILABLE'
              ? null
              : status === 'PREPAID'
                ? 0
                : (advertisingAmount ?? 0),
        };
      })
      .filter(
        (r) =>
          r.number &&
          !isSummaryText(r.number) &&
          Number.isFinite(r.squareMeters) &&
          Number.isFinite(r.pricePerSqM),
      );

    const householdExpenses: ParsedResult['householdExpenses'] = householdRows
      .map((r) => ({
        name: String(r.name ?? '').trim(),
        amount: parseNumber(r.amount) ?? NaN,
        status: mapPayStatus(r.status),
      }))
      .filter((r) => r.name && !isSummaryText(r.name) && Number.isFinite(r.amount));

    const expenses: ParsedResult['expenses'] = expensesRows
      .map((r) => {
        const typeRaw = normalizeText(r.type);
        return {
          type: EXPENSE_TYPE_MAP[typeRaw] ?? 'OTHER',
          amount: parseNumber(r.amount) ?? NaN,
          status: mapPayStatus(r.status),
          note: String(r.note ?? '').trim() || null,
        };
      })
      .filter((r) => Number.isFinite(r.amount));

    const accounting: ParsedResult['accounting'] = accountingRows
      .map((r) => ({
        recordDate: String(r.recordDate ?? '').trim(),
        bankTransferPaid: parseNumber(r.bankTransferPaid) ?? 0,
        cashbox1Paid: parseNumber(r.cashbox1Paid) ?? 0,
        cashbox2Paid: parseNumber(r.cashbox2Paid) ?? 0,
      }))
      .filter((r) => r.recordDate.length > 0 && !isSummaryText(r.recordDate));

    const staff: ParsedResult['staff'] = staffRows
      .map((r) => ({
        fullName: String(r.fullName ?? '').trim(),
        position: String(r.position ?? '').trim(),
        salary: parseNumber(r.salary) ?? 0,
        salaryStatus: mapPayStatus(r.salaryStatus),
      }))
      .filter((r) => r.fullName && r.position && !isSummaryText(r.fullName));

    if (pavilions.length === 0) {
      localErrors.push(
        'Лист "Павильоны": не найдено валидных строк (проверьте Номер павильона / Площадь / Цена за м2)',
      );
    }

    setErrors(localErrors);
    if (localErrors.length > 0) return null;

    return {
      pavilions,
      householdExpenses,
      expenses,
      accounting,
      staff,
    };
  };

  const handleImport = async () => {
    if (!file) {
      setErrors(['Сначала выберите файл шаблона']);
      return;
    }
    try {
      setImporting(true);
      setErrors([]);
      const payload = await parseTemplate(file);
      if (!payload) return;

      const result = await apiFetch<{ imported?: Record<string, number> }>(
        `/stores/${storeId}/import-data`,
        {
          method: 'POST',
          body: JSON.stringify(payload),
        },
      );
      const imported = result?.imported ?? {};
      alert(
        `Импорт завершен: павильоны ${imported.pavilions ?? 0}, хоз. расходы ${imported.householdExpenses ?? 0}, расходы ${imported.expenses ?? 0}, бух. таблица ${imported.accounting ?? 0}, сотрудники ${imported.staff ?? 0}.`,
      );
      onImported();
    } catch (e) {
      console.error(e);
      setErrors(['Не удалось импортировать данные из шаблона']);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-xl bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Импорт по шаблону Excel</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            Закрыть
          </button>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            Шаг 1: скачайте шаблон, заполните его и загрузите обратно.
          </p>
          <button
            onClick={downloadTemplate}
            className="rounded bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
          >
            Скачать шаблон
          </button>

          <div>
            <label className="mb-1 block text-sm font-medium">Файл шаблона (.xlsx)</label>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          {hasErrors && (
            <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {errors.map((err) => (
                <div key={err}>- {err}</div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="rounded border px-4 py-2">
            Отмена
          </button>
          <button
            onClick={handleImport}
            disabled={importing}
            className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-60"
          >
            {importing ? 'Импорт...' : 'Импортировать'}
          </button>
        </div>
      </div>
    </div>
  );
}
