export type Discount = {
  id: number;
  amount: number;
  startsAt: string;
  endsAt: string | null;
  note?: string | null;
};

export type PavilionExpenseType =
  | 'SALARIES'
  | 'PAYROLL_TAX'
  | 'PROFIT_TAX'
  | 'DIVIDENDS'
  | 'BANK_SERVICES'
  | 'VAT'
  | 'LAND_RENT'
  | 'OTHER';

export type PavilionExpenseStatus = 'UNPAID' | 'PAID';

export const MANUAL_EXPENSE_CATEGORIES: Array<{
  type: PavilionExpenseType;
  label: string;
}> = [
  { type: 'SALARIES', label: 'Зарплаты' },
  { type: 'PAYROLL_TAX', label: 'Налоги с зарплаты' },
  { type: 'PROFIT_TAX', label: 'Налог на прибыль' },
  { type: 'DIVIDENDS', label: 'Дивиденды' },
  { type: 'BANK_SERVICES', label: 'Услуги банка' },
  { type: 'VAT', label: 'НДС' },
  { type: 'LAND_RENT', label: 'Аренда земли' },
  { type: 'OTHER', label: 'Прочие расходы' },
];

export type Pavilion = {
  id: number;
  number: string;
  squareMeters: number;
  pricePerSqM: number;
  status: string;
  tenantName?: string;
  rentAmount?: number;
  utilitiesAmount?: number;
  prepaidUntil?: string | null;
  payments: Array<{
    id: number;
    period: string;
    rentPaid?: number | null;
    utilitiesPaid?: number | null;
    bankTransferPaid?: number | null;
    cashbox1Paid?: number | null;
    cashbox2Paid?: number | null;
    createdAt: string;
  }>;
  paymentTransactions?: Array<{
    id: number;
    period: string;
    rentPaid: number;
    utilitiesPaid: number;
    bankTransferPaid: number;
    cashbox1Paid: number;
    cashbox2Paid: number;
    createdAt: string;
  }>;
  additionalCharges: any[];
  discounts: Discount[];
  contracts?: Array<{
    id: number;
    fileName: string;
    filePath: string;
    fileType: string;
    uploadedAt: string;
  }>;
  householdExpenses?: Array<{
    id: number;
    name: string;
    amount: number;
    createdAt: string;
  }>;
  pavilionExpenses?: Array<{
    id: number;
    type: PavilionExpenseType;
    status: PavilionExpenseStatus;
    amount: number;
    note?: string | null;
    createdAt: string;
  }>;
  store?: {
    currency?: 'RUB' | 'KZT';
  };
};
