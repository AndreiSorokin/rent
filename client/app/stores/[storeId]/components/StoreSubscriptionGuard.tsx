'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AlertTriangle, Clock3, CreditCard, LockKeyhole } from 'lucide-react';
import { getCurrencySymbol } from '@/lib/currency';
import { startStoreSubscriptionCheckout } from '@/lib/invoices';
import { hasPermission } from '@/lib/permissions';
import { useToast } from '@/components/toast/ToastProvider';

type SubscriptionBilling = {
  status?: 'PAID' | 'UNPAID';
  amountRub?: number;
  currentPeriod?: string;
  hasChargeForCurrentMonth?: boolean;
  hasBillingDetails?: boolean;
  isFirstMonthFree?: boolean;
  showPaymentReminder?: boolean;
  isFrozen?: boolean;
  canManageSubscription?: boolean;
  gracePeriodDays?: number;
  graceStartsAt?: string | null;
  graceEndsAt?: string | null;
  daysUntilFreeze?: number | null;
};

type StoreSubscriptionGuardProps = {
  storeId: number;
  store: {
    currency?: 'RUB' | 'KZT' | string;
    permissions?: string[];
    subscriptionBilling?: SubscriptionBilling | null;
  };
};

function formatDaysLeft(days: number) {
  const mod10 = days % 10;
  const mod100 = days % 100;

  if (mod10 === 1 && mod100 !== 11) return `${days} день`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${days} дня`;
  }

  return `${days} дней`;
}

export function StoreSubscriptionGuard({
  storeId,
  store,
}: StoreSubscriptionGuardProps) {
  const toast = useToast();
  const [paymentLoading, setPaymentLoading] = useState(false);

  const subscriptionBilling = store.subscriptionBilling ?? null;
  const permissions = store.permissions ?? [];
  const canManageStore = hasPermission(permissions, 'ASSIGN_PERMISSIONS');

  if (
    !subscriptionBilling ||
    subscriptionBilling.status === 'PAID' ||
    subscriptionBilling.isFirstMonthFree ||
    !subscriptionBilling.hasChargeForCurrentMonth
  ) {
    return null;
  }

  const amountLabel = `${Number(subscriptionBilling.amountRub ?? 0).toLocaleString(
    'ru-RU',
  )} ${getCurrencySymbol((store.currency as any) || 'RUB')}`;
  const daysUntilFreeze = Number(subscriptionBilling.daysUntilFreeze ?? 0);
  const canStartCheckout = Boolean(
    canManageStore && subscriptionBilling.canManageSubscription,
  );
  const needsBillingDetails = !subscriptionBilling.hasBillingDetails;

  const handleStartPayment = async () => {
    try {
      setPaymentLoading(true);
      const result = await startStoreSubscriptionCheckout(storeId);

      if (result.mode === 'REDIRECT' && result.paymentUrl) {
        window.location.href = result.paymentUrl;
        return;
      }

      toast.success(result.message);
    } catch (err: any) {
      toast.error(err?.message || 'Не удалось подготовить оплату');
    } finally {
      setPaymentLoading(false);
    }
  };

  if (subscriptionBilling.isFrozen) {
    return (
      <div className="fixed inset-0 z-[90] bg-[#f6f1eb]/92 backdrop-blur-sm">
        <div className="flex min-h-screen items-start justify-center px-4 pt-16">
          <div className="w-full max-w-2xl rounded-[28px] border border-[#f3c6a8] bg-white p-6 shadow-[0_24px_80px_rgba(0,0,0,0.14)]">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-[#fff1e8] p-3 text-[#c2410c]">
                <LockKeyhole className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#c2410c]">
                  Подписка не оплачена
                </p>
                <h2 className="mt-1 text-2xl font-bold text-[#111111]">
                  Работа с объектом временно заморожена
                </h2>
                <p className="mt-2 text-sm leading-6 text-[#5f5f5f]">
                  Данные объекта сохранены. Чтобы снова пользоваться платформой, нужно
                  оплатить подписку за текущий месяц.
                </p>
                <div className="mt-4 rounded-2xl border border-[#e7ddd4] bg-[#faf7f3] px-4 py-3 text-sm text-[#3f3f46]">
                  К оплате: <span className="font-semibold text-[#111111]">{amountLabel}</span>
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  {canStartCheckout ? (
                    <button
                      type="button"
                      onClick={handleStartPayment}
                      disabled={paymentLoading}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#FF6A13] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#E65C00] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      <CreditCard className="h-4 w-4" />
                      {paymentLoading ? 'Переходим к оплате...' : 'Оплатить подписку'}
                    </button>
                  ) : needsBillingDetails && canManageStore ? (
                    <Link
                      href={`/stores/${storeId}/settings`}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#FF6A13] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#E65C00]"
                    >
                      <CreditCard className="h-4 w-4" />
                      Заполнить реквизиты для оплаты
                    </Link>
                  ) : null}
                </div>

                {!canManageStore && (
                  <p className="mt-4 text-sm text-[#6b6b6b]">
                    Если у вас нет доступа к оплате, обратитесь к администратору объекта.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!subscriptionBilling.showPaymentReminder) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[80] flex justify-center px-3">
      <div className="pointer-events-auto w-full max-w-5xl rounded-2xl border border-[#f3c6a8] bg-[#fff1e8]/95 px-4 py-3 text-[#111111] shadow-[0_14px_40px_rgba(194,65,12,0.16)] backdrop-blur">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[#c2410c]">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span className="text-xs font-semibold uppercase tracking-[0.14em]">
                Напоминание об оплате
              </span>
            </div>
            <p className="mt-1 text-sm font-semibold text-[#111111]">
              Подписка по объекту не оплачена. К оплате: {amountLabel}.
            </p>
            <p className="mt-1 flex items-center gap-2 text-sm text-[#6b4b38]">
              <Clock3 className="h-4 w-4 shrink-0" />
              Через {formatDaysLeft(Math.max(1, daysUntilFreeze))} дней доступ будет ограничен.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {canStartCheckout ? (
              <button
                type="button"
                onClick={handleStartPayment}
                disabled={paymentLoading}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#FF6A13] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#E65C00] disabled:cursor-not-allowed disabled:opacity-70"
              >
                <CreditCard className="h-4 w-4" />
                {paymentLoading ? 'Переходим к оплате...' : 'Оплатить'}
              </button>
            ) : needsBillingDetails && canManageStore ? (
              <Link
                href={`/stores/${storeId}/settings`}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#FF6A13] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#E65C00]"
              >
                <CreditCard className="h-4 w-4" />
                Заполнить реквизиты
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
