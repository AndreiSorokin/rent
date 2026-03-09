'use client';

type ExpenseStatus = 'UNPAID' | 'PAID';

type ExpenseCreatePaidModalProps = {
  open: boolean;
  title: string;
  subtitle?: string;
  nameLabel?: string;
  nameValue: string;
  onNameChange: (value: string) => void;
  bankTransferPaid: string;
  onBankTransferPaidChange: (value: string) => void;
  cashbox1Paid: string;
  onCashbox1PaidChange: (value: string) => void;
  cashbox2Paid: string;
  onCashbox2PaidChange: (value: string) => void;
  saving: boolean;
  onClose: () => void;
  onSubmit: () => void;
  submitLabel?: string;
};

type ExpenseEditModalProps = {
  open: boolean;
  title: string;
  nameLabel?: string;
  nameValue: string;
  onNameChange: (value: string) => void;
  status: ExpenseStatus;
  onStatusChange: (status: ExpenseStatus) => void;
  bankTransferPaid: string;
  onBankTransferPaidChange: (value: string) => void;
  cashbox1Paid: string;
  onCashbox1PaidChange: (value: string) => void;
  cashbox2Paid: string;
  onCashbox2PaidChange: (value: string) => void;
  saving: boolean;
  onClose: () => void;
  onSubmit: () => void;
  onDelete?: () => void;
  showDelete?: boolean;
  submitLabel?: string;
};

export function ExpenseCreatePaidModal({
  open,
  title,
  subtitle = 'Расход создается сразу со статусом «Оплачено».',
  nameLabel = 'Название',
  nameValue,
  onNameChange,
  bankTransferPaid,
  onBankTransferPaidChange,
  cashbox1Paid,
  onCashbox1PaidChange,
  cashbox2Paid,
  onCashbox2PaidChange,
  saving,
  onClose,
  onSubmit,
  submitLabel = 'Сохранить',
}: ExpenseCreatePaidModalProps) {
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
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        <p className="mt-1 text-sm text-slate-600">{subtitle}</p>

        <div className="mt-4 grid grid-cols-1 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">{nameLabel}</label>
            <input
              type="text"
              value={nameValue}
              onChange={(e) => onNameChange(e.target.value)}
              className="w-full rounded-xl border border-[#D8D1CB] px-3 py-2.5"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Безналичные</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={bankTransferPaid}
              onChange={(e) => onBankTransferPaidChange(e.target.value)}
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
              value={cashbox1Paid}
              onChange={(e) => onCashbox1PaidChange(e.target.value)}
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
              value={cashbox2Paid}
              onChange={(e) => onCashbox2PaidChange(e.target.value)}
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
            {saving ? 'Сохранение...' : submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}

export function ExpenseEditModal({
  open,
  title,
  nameLabel = 'Название',
  nameValue,
  onNameChange,
  status,
  onStatusChange,
  bankTransferPaid,
  onBankTransferPaidChange,
  cashbox1Paid,
  onCashbox1PaidChange,
  cashbox2Paid,
  onCashbox2PaidChange,
  saving,
  onClose,
  onSubmit,
  onDelete,
  showDelete = false,
  submitLabel = 'Сохранить',
}: ExpenseEditModalProps) {
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
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>

        <div className="mt-4 grid grid-cols-1 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">{nameLabel}</label>
            <input
              type="text"
              value={nameValue}
              onChange={(e) => onNameChange(e.target.value)}
              className="w-full rounded-xl border border-[#D8D1CB] px-3 py-2.5"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Статус оплаты</label>
            <select
              value={status}
              onChange={(e) => onStatusChange(e.target.value as ExpenseStatus)}
              className="w-full rounded-xl border border-[#D8D1CB] px-3 py-2.5"
            >
              <option value="UNPAID">Не оплачено</option>
              <option value="PAID">Оплачено</option>
            </select>
          </div>

          {status === 'PAID' && (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Безналичные
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={bankTransferPaid}
                  onChange={(e) => onBankTransferPaidChange(e.target.value)}
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
                  value={cashbox1Paid}
                  onChange={(e) => onCashbox1PaidChange(e.target.value)}
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
                  value={cashbox2Paid}
                  onChange={(e) => onCashbox2PaidChange(e.target.value)}
                  className="w-full rounded-xl border border-[#D8D1CB] px-3 py-2.5"
                />
              </div>
            </>
          )}
        </div>

        <div className="mt-5 flex items-center justify-between gap-2">
          {showDelete && onDelete ? (
            <button
              type="button"
              onClick={onDelete}
              disabled={saving}
              className="rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
            >
              Удалить
            </button>
          ) : (
            <span />
          )}
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
              {saving ? 'Сохранение...' : submitLabel}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
