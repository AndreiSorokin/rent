'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { formatMoney } from '@/lib/currency';
import { hasPermission } from '@/lib/permissions';
import { AddStaffModal, EditStaffSalaryModal } from '../components/StaffModals';
import { StoreSidebar } from '../components/StoreSidebar';

type StaffMember = {
  id: number;
  position: string;
  fullName: string;
  salary: number;
  salaryStatus: 'UNPAID' | 'PAID';
  salaryBankTransferPaid?: number;
  salaryCashbox1Paid?: number;
  salaryCashbox2Paid?: number;
};

export default function StoreStaffPage() {
  const params = useParams();
  const router = useRouter();
  const storeId = Number(params.storeId);

  const [store, setStore] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [addModal, setAddModal] = useState<{ fullName: string; position: string; salary: string } | null>(null);
  const [editModal, setEditModal] = useState<{
    id: number;
    fullName: string;
    salary: string;
    salaryStatus: 'UNPAID' | 'PAID';
    salaryBankTransferPaid: number;
    salaryCashbox1Paid: number;
    salaryCashbox2Paid: number;
  } | null>(null);

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

  const staff: StaffMember[] = useMemo(() => (store?.staff || []) as StaffMember[], [store]);

  const handleAdd = async () => {
    if (!addModal) return;
    if (!addModal.fullName.trim() || !addModal.position.trim() || !addModal.salary) {
      alert('Заполните все поля');
      return;
    }
    const salary = Number(addModal.salary);
    if (!Number.isFinite(salary) || salary < 0) {
      alert('Зарплата должна быть неотрицательным числом');
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
      alert('Не удалось добавить сотрудника');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Удалить сотрудника?')) return;
    try {
      setSaving(true);
      await apiFetch(`/stores/${storeId}/staff/${id}`, { method: 'DELETE' });
      await fetchData();
    } catch (err) {
      console.error(err);
      alert('Не удалось удалить сотрудника');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editModal) return;
    const nextSalary = Number(editModal.salary);
    if (!Number.isFinite(nextSalary) || nextSalary < 0) {
      alert('Зарплата должна быть неотрицательным числом');
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
        alert('Каналы оплаты должны быть неотрицательными');
        return;
      }
      if (Math.abs(bank + cash1 + cash2 - nextSalary) > 0.01) {
        alert('Сумма каналов оплаты должна быть равна зарплате');
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
      alert('Не удалось обновить сотрудника');
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
        <main className="min-w-0 flex-1">
          <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="mt-2 text-2xl font-bold text-[#111111] md:text-3xl">
                  Штатное расписание
                </h1>
              </div>
              {canManage && (
                <button
                  onClick={() => setAddModal({ fullName: '', position: '', salary: '' })}
                  className="rounded-xl bg-[#ff6a13] px-4 py-2.5 font-semibold text-white transition hover:bg-[#e85a0c]"
                >
                  Добавить
                </button>
              )}
            </div>

            <section className="rounded-2xl border border-[#d8d1cb] bg-white p-6 shadow-[0_12px_36px_-20px_rgba(17,17,17,0.2)] md:p-8">
              {!staff.length ? (
                <p className="text-[#6b6b6b]">Сотрудников пока нет</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-[#d8d1cb]">
                  <table className="min-w-full divide-y divide-[#e7e0d9]">
                    <thead className="bg-[#f4efeb]">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#6b6b6b]">
                          Должность
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#6b6b6b]">
                          Имя фамилия
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#6b6b6b]">
                          Зарплата
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#6b6b6b]">
                          Статус оплаты
                        </th>
                        {canManage && (
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#6b6b6b]">
                            Действия
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f1ebe4] bg-white">
                      {staff.map((s) => (
                        <tr key={s.id}>
                          <td className="px-4 py-3 text-sm">{s.position}</td>
                          <td className="px-4 py-3 text-sm">{s.fullName}</td>
                          <td className="px-4 py-3 text-sm">
                            {formatMoney(Number(s.salary ?? 0), store.currency)}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span
                              className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${
                                (s.salaryStatus ?? 'UNPAID') === 'PAID'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-amber-100 text-amber-700'
                              }`}
                            >
                              {(s.salaryStatus ?? 'UNPAID') === 'PAID'
                                ? 'Оплачено'
                                : 'Не оплачено'}
                            </span>
                          </td>
                          {canManage && (
                            <td className="px-4 py-3 text-sm">
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
                                className="rounded-lg border border-[#d8d1cb] bg-white px-3 py-1.5 text-xs font-semibold text-[#111111] hover:bg-[#f4efeb]"
                              >
                                Оплатить/Изменить
                              </button>
                            </td>
                          )}
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
