'use client';

import { formatMoney } from '@/lib/currency';

type AddStaffModalProps = {
  open: boolean;
  fullName: string;
  position: string;
  salary: string;
  onFullNameChange: (value: string) => void;
  onPositionChange: (value: string) => void;
  onSalaryChange: (value: string) => void;
  saving: boolean;
  onClose: () => void;
  onSubmit: () => void;
};

type PayStaffSalaryModalProps = {
  open: boolean;
  fullName: string;
  salary: number;
  currency?: string;
  bankTransfer: string;
  cashbox1: string;
  cashbox2: string;
  onBankTransferChange: (value: string) => void;
  onCashbox1Change: (value: string) => void;
  onCashbox2Change: (value: string) => void;
  saving: boolean;
  onClose: () => void;
  onSubmit: () => void;
};

type EditStaffSalaryModalProps = {
  open: boolean;
  fullName: string;
  salary: string;
  salaryStatus: 'UNPAID' | 'PAID';
  salaryBankTransferPaid: number;
  salaryCashbox1Paid: number;
  salaryCashbox2Paid: number;
  onSalaryChange: (value: string) => void;
  onSalaryStatusChange: (value: 'UNPAID' | 'PAID') => void;
  onSalaryBankTransferPaidChange: (value: number) => void;
  onSalaryCashbox1PaidChange: (value: number) => void;
  onSalaryCashbox2PaidChange: (value: number) => void;
  saving: boolean;
  onDelete: () => void;
  onClose: () => void;
  onSubmit: () => void;
};

export function AddStaffModal({
  open,
  fullName,
  position,
  salary,
  onFullNameChange,
  onPositionChange,
  onSalaryChange,
  saving,
  onClose,
  onSubmit,
}: AddStaffModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/50 p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl md:p-6"
      >
        <h3 className="text-lg font-semibold text-slate-900">Добавить сотрудника</h3>

        <div className="mt-4 grid grid-cols-1 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Должность</label>
            <input
              type="text"
              value={position}
              onChange={(e) => onPositionChange(e.target.value)}
              className="w-full rounded-xl border border-[#D8D1CB] px-3 py-2.5"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Имя фамилия</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => onFullNameChange(e.target.value)}
              className="w-full rounded-xl border border-[#D8D1CB] px-3 py-2.5"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Зарплата</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={salary}
              onChange={(e) => onSalaryChange(e.target.value)}
              className="w-full rounded-xl border border-[#D8D1CB] px-3 py-2.5"
            />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-[#CFC6BF] px-4 py-2 text-sm font-medium text-slate-700 hover:bg-[#F4EFEB] disabled:opacity-60"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-[#FF6A13] px-4 py-2 text-sm font-medium text-white hover:bg-[#E65C00] disabled:opacity-60"
          >
            {saving ? 'Сохранение...' : 'Добавить'}
          </button>
        </div>
      </form>
    </div>
  );
}

export function PayStaffSalaryModal({
  open,
  fullName,
  salary,
  currency,
  bankTransfer,
  cashbox1,
  cashbox2,
  onBankTransferChange,
  onCashbox1Change,
  onCashbox2Change,
  saving,
  onClose,
  onSubmit,
}: PayStaffSalaryModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/50 p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl md:p-6"
      >
        <h3 className="text-lg font-semibold text-slate-900">Оплата зарплаты</h3>
        <p className="mt-1 text-sm text-slate-600">
          {fullName}. Сумма: {formatMoney(salary, currency)}
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Безналичные</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={bankTransfer}
              onChange={(e) => onBankTransferChange(e.target.value)}
              className="w-full rounded-xl border border-[#D8D1CB] px-3 py-2.5"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Наличные касса 1</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={cashbox1}
              onChange={(e) => onCashbox1Change(e.target.value)}
              className="w-full rounded-xl border border-[#D8D1CB] px-3 py-2.5"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Наличные касса 2</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={cashbox2}
              onChange={(e) => onCashbox2Change(e.target.value)}
              className="w-full rounded-xl border border-[#D8D1CB] px-3 py-2.5"
            />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-[#CFC6BF] px-4 py-2 text-sm font-medium text-slate-700 hover:bg-[#F4EFEB] disabled:opacity-60"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-[#FF6A13] px-4 py-2 text-sm font-medium text-white hover:bg-[#E65C00] disabled:opacity-60"
          >
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </form>
    </div>
  );
}

export function EditStaffSalaryModal({
  open,
  fullName,
  salary,
  salaryStatus,
  salaryBankTransferPaid,
  salaryCashbox1Paid,
  salaryCashbox2Paid,
  onSalaryChange,
  onSalaryStatusChange,
  onSalaryBankTransferPaidChange,
  onSalaryCashbox1PaidChange,
  onSalaryCashbox2PaidChange,
  saving,
  onDelete,
  onClose,
  onSubmit,
}: EditStaffSalaryModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/50 p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl md:p-6"
      >
        <h3 className="text-lg font-semibold text-slate-900">Изменить зарплату</h3>
        <p className="mt-1 text-sm text-slate-600">{fullName}</p>

        <div className="mt-4 grid grid-cols-1 gap-3">
          <label className="mb-1 block text-sm font-medium text-slate-700">Новая зарплата</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={salary}
            onChange={(e) => onSalaryChange(e.target.value)}
            className="w-full rounded-xl border border-[#D8D1CB] px-3 py-2.5"
          />

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Статус оплаты</label>
            <select
              value={salaryStatus}
              onChange={(e) => onSalaryStatusChange(e.target.value as 'UNPAID' | 'PAID')}
              className="w-full rounded-xl border border-[#D8D1CB] px-3 py-2.5"
            >
              <option value="UNPAID">Не оплачено</option>
              <option value="PAID">Оплачено</option>
            </select>
          </div>

          {salaryStatus === 'PAID' && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Безналичные
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={salaryBankTransferPaid}
                  onChange={(e) => onSalaryBankTransferPaidChange(Number(e.target.value || 0))}
                  className="w-full rounded-xl border border-[#D8D1CB] px-3 py-2.5"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Наличные касса 1
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={salaryCashbox1Paid}
                  onChange={(e) => onSalaryCashbox1PaidChange(Number(e.target.value || 0))}
                  className="w-full rounded-xl border border-[#D8D1CB] px-3 py-2.5"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Наличные касса 2
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={salaryCashbox2Paid}
                  onChange={(e) => onSalaryCashbox2PaidChange(Number(e.target.value || 0))}
                  className="w-full rounded-xl border border-[#D8D1CB] px-3 py-2.5"
                />
              </div>
            </div>
          )}
        </div>

        <div className="mt-5 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onDelete}
            disabled={saving}
            className="rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
          >
            Удалить
          </button>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl border border-[#CFC6BF] px-4 py-2 text-sm font-medium text-slate-700 hover:bg-[#F4EFEB] disabled:opacity-60"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-[#FF6A13] px-4 py-2 text-sm font-medium text-white hover:bg-[#E65C00] disabled:opacity-60"
            >
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
