'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { formatMoney } from '@/lib/currency';
import { hasPermission } from '@/lib/permissions';
import { useDialog } from '@/components/dialog/DialogProvider';
import { useToast } from '@/components/toast/ToastProvider';
import { reorderStaff } from '@/lib/staff';
import { AddStaffModal, EditStaffSalaryModal } from '../components/StaffModals';
import { StoreSidebar } from '../components/StoreSidebar';
import {
  CirclePlus,
  GripVertical,
} from 'lucide-react';


type StaffMember = {
  id: number;
  sortIndex?: number | null;
  position: string;
  fullName: string;
  salary: number;
  createdAt?: string;
  salaryStatus: 'UNPAID' | 'PAID';
  salaryBankTransferPaid?: number;
  salaryCashbox1Paid?: number;
  salaryCashbox2Paid?: number;
};

function paymentChannelsLines(
  bankTransferPaid: number | null | undefined,
  cashbox1Paid: number | null | undefined,
  cashbox2Paid: number | null | undefined,
  currency: 'RUB' | 'KZT',
) {
  const lines: string[] = [];
  const bank = Number(bankTransferPaid ?? 0);
  const cash1 = Number(cashbox1Paid ?? 0);
  const cash2 = Number(cashbox2Paid ?? 0);

  if (bank > 0) lines.push(`Безналичные: ${formatMoney(bank, currency)}`);
  if (cash1 > 0) lines.push(`Наличные касса 1: ${formatMoney(cash1, currency)}`);
  if (cash2 > 0) lines.push(`Наличные касса 2: ${formatMoney(cash2, currency)}`);

  return lines;
}

function formatDateTime(value: string | Date | null | undefined, timeZone: string): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('ru-RU', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function StoreStaffPage() {
  const params = useParams();
  const router = useRouter();
  const storeId = Number(params.storeId);
  const dialog = useDialog();
  const toast = useToast();

  const [store, setStore] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [addModal, setAddModal] = useState<{
    fullName: string;
    position: string;
    salary: string;
  } | null>(null);
  const [editModal, setEditModal] = useState<{
    id: number;
    fullName: string;
    salary: string;
    salaryStatus: 'UNPAID' | 'PAID';
    salaryBankTransferPaid: number;
    salaryCashbox1Paid: number;
    salaryCashbox2Paid: number;
  } | null>(null);
  const [orderedStaffIds, setOrderedStaffIds] = useState<number[]>([]);
  const [draggedStaffId, setDraggedStaffId] = useState<number | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<any>(`/stores/${storeId}?lite=true`);
      if (!hasPermission(data.permissions || [], 'VIEW_STAFF')) {
        router.replace(`/stores/${storeId}`);
        return;
      }
      setStore(data);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Не удалось загрузить штатное расписание');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (storeId) void fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  const permissions = store?.permissions || [];
  const canManage = hasPermission(permissions, 'MANAGE_STAFF');
  const canView = hasPermission(permissions, 'VIEW_STAFF');
  const currency: 'RUB' | 'KZT' = store?.currency ?? 'RUB';

  const staff: StaffMember[] = useMemo(() => (store?.staff || []) as StaffMember[], [store]);

  useEffect(() => {
    setOrderedStaffIds(staff.map((s) => Number(s.id)));
  }, [staff]);

  const orderedStaff = useMemo(() => {
    if (!orderedStaffIds.length) return staff;
    const byId = new Map(staff.map((s) => [Number(s.id), s]));
    const inOrder = orderedStaffIds
      .map((id) => byId.get(id))
      .filter((item): item is StaffMember => Boolean(item));
    const missing = staff.filter((s) => !orderedStaffIds.includes(Number(s.id)));
    return [...inOrder, ...missing];
  }, [orderedStaffIds, staff]);
  const payrollTotal = useMemo(
    () => orderedStaff.reduce((sum, item) => sum + Number(item.salary ?? 0), 0),
    [orderedStaff],
  );

  const moveStaff = async (dragId: number, targetId: number) => {
    if (dragId === targetId) return;
    const current = orderedStaffIds.length
      ? [...orderedStaffIds]
      : staff.map((s) => Number(s.id));
    const from = current.indexOf(dragId);
    const to = current.indexOf(targetId);
    if (from < 0 || to < 0 || from === to) return;

    current.splice(from, 1);
    current.splice(to, 0, dragId);

    const previous = orderedStaffIds;
    setOrderedStaffIds(current);
    try {
      await reorderStaff(storeId, current);
    } catch (err) {
      console.error(err);
      setOrderedStaffIds(previous);
      await fetchData();
    }
  };

  const handleAdd = async () => {
    if (!addModal) return;
    if (!addModal.fullName.trim() || !addModal.position.trim() || !addModal.salary) {
      toast.error('Заполните все поля');
      return;
    }
    const salary = Number(addModal.salary);
    if (!Number.isFinite(salary) || salary < 0) {
      toast.error('Зарплата должна быть неотрицательным числом');
      return;
    }
    try {
      setSaving(true);
      await apiFetch(`/stores/${storeId}/staff`, {
        method: 'POST',
        body: JSON.stringify({
          fullName: addModal.fullName.trim(),
          position: addModal.position.trim(),
          salary,
        }),
      });
      setAddModal(null);
      await fetchData();
    } catch (err) {
      console.error(err);
      toast.error('Не удалось добавить сотрудника');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    const confirmed = await dialog.confirm({
      title: 'Удаление сотрудника',
      message: 'Удалить сотрудника?',
      tone: 'danger',
      confirmText: 'Удалить',
    });
    if (!confirmed) return;
    try {
      setSaving(true);
      await apiFetch(`/stores/${storeId}/staff/${id}`, { method: 'DELETE' });
      await fetchData();
    } catch (err) {
      console.error(err);
      toast.error('Не удалось удалить сотрудника');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editModal) return;
    const nextSalary = Number(editModal.salary);
    if (!Number.isFinite(nextSalary) || nextSalary < 0) {
      toast.error('Зарплата должна быть неотрицательным числом');
      return;
    }

    let bank = 0;
    let cash1 = 0;
    let cash2 = 0;
    if (editModal.salaryStatus === 'PAID') {
      bank = Number(editModal.salaryBankTransferPaid ?? 0);
      cash1 = Number(editModal.salaryCashbox1Paid ?? 0);
      cash2 = Number(editModal.salaryCashbox2Paid ?? 0);
      if ([bank, cash1, cash2].some((v) => !Number.isFinite(v) || v < 0)) {
        toast.error('Каналы оплаты должны быть неотрицательными');
        return;
      }
      if (Math.abs(bank + cash1 + cash2 - nextSalary) > 0.01) {
        toast.error('Сумма каналов оплаты должна быть равна зарплате');
        return;
      }
    }

    try {
      setSaving(true);
      await apiFetch(`/stores/${storeId}/staff/${editModal.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          salary: nextSalary,
          salaryStatus: editModal.salaryStatus,
          salaryBankTransferPaid: editModal.salaryStatus === 'PAID' ? bank : 0,
          salaryCashbox1Paid: editModal.salaryStatus === 'PAID' ? cash1 : 0,
          salaryCashbox2Paid: editModal.salaryStatus === 'PAID' ? cash2 : 0,
        }),
      });
      setEditModal(null);
      await fetchData();
    } catch (err) {
      console.error(err);
      toast.error('Не удалось обновить сотрудника');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6 text-center text-lg">Загрузка...</div>;
  if (error) return <div className="p-6 text-center text-red-600">{error}</div>;
  if (!store || !canView) return null;

  return (
    <div className="min-h-screen bg-[#f6f1eb]">
      <div className="mx-auto flex max-w-[1600px] gap-6 px-3 py-1 md:px-6 md:py-6">
        <StoreSidebar storeId={storeId} store={store} active="staff" />
        <main className="min-w-0 flex-1 pt-12 md:pt-0">
          <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-2">
            <section className="rounded-2xl border border-[#d8d1cb] bg-white p-6 shadow-[0_12px_36px_-20px_rgba(17,17,17,0.2)] md:p-8">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-xl font-semibold text-[#111111] md:text-2xl">Штатное расписание</h1>
                {canManage && (
                  <button
                    onClick={() =>
                      setAddModal({
                        fullName: '',
                        position: '',
                        salary: '',
                      })
                    }
                    className="inline-flex items-center gap-2 rounded-xl bg-[#2563EB] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#1D4ED8]"
                  >
                    <CirclePlus className="h-4 w-4" />
                    Добавить сотрудника
                  </button>
                )}
              </div>
              <div className="mb-4 rounded-xl border border-[#E5DED8] bg-[#F9F5F1] px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-[#6B6B6B]">
                  Общая сумма расходов
                </p>
                <p className="mt-1 text-xl font-semibold text-[#111111]">
                  {formatMoney(payrollTotal, currency)}
                </p>
              </div>

              {!staff.length ? (
                <p className="text-[#6b6b6b]">Сотрудников пока нет</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="bg-[#F4EFEB]">
                      <tr>
                        <th className="rounded-l-xl px-4 py-3 text-left text-xs font-medium uppercase text-[#6B6B6B]">
                          Дата
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[#6B6B6B]">
                          Должность
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[#6B6B6B]">
                          Имя и фамилия
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[#6B6B6B]">
                          Статус
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[#6B6B6B]">
                          Каналы оплаты
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium uppercase text-[#6B6B6B]">
                          Зарплата
                        </th>
                        <th className="rounded-r-xl px-4 py-3 text-right text-xs font-medium uppercase text-[#6B6B6B]">
                          Действия
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5DED8] bg-white">
                      {orderedStaff.map((s) => (
                        <tr
                          key={s.id}
                          className="transition-colors hover:bg-[#f9f5f0]"
                          onDragOver={(e) => {
                            if (!canManage) return;
                            if (draggedStaffId == null) return;
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'move';
                          }}
                          onDrop={(e) => {
                            if (!canManage) return;
                            e.preventDefault();
                            if (draggedStaffId == null) return;
                            void moveStaff(draggedStaffId, Number(s.id));
                            setDraggedStaffId(null);
                          }}
                        >
                          <td className="whitespace-nowrap px-4 py-2.5 align-middle text-xs text-[#6B6B6B]">
                            {formatDateTime(s.createdAt, store?.timeZone || 'UTC')}
                          </td>
                          <td className="px-4 py-2.5 align-middle text-sm font-medium text-[#111111]">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                draggable={canManage}
                                onDragStart={(e) => {
                                  if (!canManage) return;
                                  setDraggedStaffId(Number(s.id));
                                  e.dataTransfer.effectAllowed = 'move';
                                }}
                                onDragEnd={() => setDraggedStaffId(null)}
                                className={`inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#d8d1cb] bg-white transition ${
                                  canManage
                                    ? 'cursor-grab text-[#6b6b6b] hover:bg-[#f8f4ef] active:cursor-grabbing'
                                    : 'cursor-not-allowed text-gray-300'
                                }`}
                                title="Потяните, чтобы изменить порядок"
                                aria-label={`Переместить сотрудника ${s.fullName}`}
                              >
                                <GripVertical className="h-4 w-4" />
                              </button>
                              <span>{s.position}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 align-middle text-sm text-[#374151]">
                            {s.fullName}
                          </td>
                          <td className="px-4 py-2.5 align-middle text-sm text-[#374151]">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                (s.salaryStatus ?? 'UNPAID') === 'PAID'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-amber-100 text-amber-700'
                              }`}
                            >
                              {(s.salaryStatus ?? 'UNPAID') === 'PAID' ? 'Оплачено' : 'Не оплачено'}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 align-middle text-xs text-slate-600">
                            {(s.salaryStatus ?? 'UNPAID') === 'PAID' ? (
                              (() => {
                                const lines = paymentChannelsLines(
                                  s.salaryBankTransferPaid,
                                  s.salaryCashbox1Paid,
                                  s.salaryCashbox2Paid,
                                  currency,
                                );
                                if (!lines.length) return <div>Каналы оплаты не заданы</div>;
                                return lines.map((line) => <div key={`${s.id}-${line}`}>{line}</div>);
                              })()
                            ) : (
                              <div>Каналы оплаты не заданы</div>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right align-middle text-sm font-bold text-slate-900">
                            {formatMoney(Number(s.salary ?? 0), currency)}
                          </td>
                          <td className="px-4 py-2.5 text-right align-middle">
                            {canManage ? (
                              <button
                                onClick={() =>
                                  setEditModal({
                                    id: Number(s.id),
                                    fullName: String(s.fullName ?? 'Сотрудник'),
                                    salary: String(Number(s.salary ?? 0)),
                                    salaryStatus: (s.salaryStatus ?? 'UNPAID') as 'UNPAID' | 'PAID',
                                    salaryBankTransferPaid: Number(s.salaryBankTransferPaid ?? 0),
                                    salaryCashbox1Paid: Number(s.salaryCashbox1Paid ?? 0),
                                    salaryCashbox2Paid: Number(s.salaryCashbox2Paid ?? 0),
                                  })
                                }
                                className="rounded-lg border border-[#d8d1cb] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#111111] hover:bg-[#f4efeb]"
                              >
                                Оплатить/Изменить
                              </button>
                            ) : (
                              <span className="text-xs text-[#6B6B6B]">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        </main>
      </div>

      <AddStaffModal
        open={Boolean(addModal)}
        fullName={addModal?.fullName ?? ''}
        position={addModal?.position ?? ''}
        salary={addModal?.salary ?? ''}
        onFullNameChange={(value) => setAddModal((prev) => (prev ? { ...prev, fullName: value } : prev))}
        onPositionChange={(value) => setAddModal((prev) => (prev ? { ...prev, position: value } : prev))}
        onSalaryChange={(value) => setAddModal((prev) => (prev ? { ...prev, salary: value } : prev))}
        saving={saving}
        onClose={() => setAddModal(null)}
        onSubmit={() => void handleAdd()}
      />

      <EditStaffSalaryModal
        open={Boolean(editModal)}
        fullName={editModal?.fullName ?? ''}
        salary={editModal?.salary ?? ''}
        salaryStatus={editModal?.salaryStatus ?? 'UNPAID'}
        salaryBankTransferPaid={editModal?.salaryBankTransferPaid ?? 0}
        salaryCashbox1Paid={editModal?.salaryCashbox1Paid ?? 0}
        salaryCashbox2Paid={editModal?.salaryCashbox2Paid ?? 0}
        onSalaryChange={(value) => setEditModal((prev) => (prev ? { ...prev, salary: value } : prev))}
        onSalaryStatusChange={(nextStatus) =>
          setEditModal((prev) => {
            if (!prev) return prev;
            if (nextStatus === 'UNPAID') return { ...prev, salaryStatus: 'UNPAID' };
            const nextSalary = Number(prev.salary || 0);
            const oldTotal =
              Number(prev.salaryBankTransferPaid ?? 0) +
              Number(prev.salaryCashbox1Paid ?? 0) +
              Number(prev.salaryCashbox2Paid ?? 0);
            if (oldTotal > 0) return { ...prev, salaryStatus: 'PAID' };
            return {
              ...prev,
              salaryStatus: 'PAID',
              salaryBankTransferPaid: nextSalary,
              salaryCashbox1Paid: 0,
              salaryCashbox2Paid: 0,
            };
          })
        }
        onSalaryBankTransferPaidChange={(value) =>
          setEditModal((prev) => (prev ? { ...prev, salaryBankTransferPaid: value } : prev))
        }
        onSalaryCashbox1PaidChange={(value) =>
          setEditModal((prev) => (prev ? { ...prev, salaryCashbox1Paid: value } : prev))
        }
        onSalaryCashbox2PaidChange={(value) =>
          setEditModal((prev) => (prev ? { ...prev, salaryCashbox2Paid: value } : prev))
        }
        saving={saving}
        onDelete={() => {
          if (!editModal) return;
          void handleDelete(editModal.id);
          setEditModal(null);
        }}
        onClose={() => setEditModal(null)}
        onSubmit={() => void handleSaveEdit()}
      />
    </div>
  );
}
