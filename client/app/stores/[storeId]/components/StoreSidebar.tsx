'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  ArrowLeft,
  BanknoteArrowDown,
  CheckCheck,
  HandCoins,
  LockKeyhole,
  Menu,
  Sigma,
  SlidersHorizontal,
  Store,
  Toolbox,
  UsersRound,
  X,
  type LucideIcon,
} from 'lucide-react';
import { getCurrencySymbol } from '@/lib/currency';
import { hasPermission } from '@/lib/permissions';
import { LogoutButton } from '@/components/LogoutButton';
import { useToast } from '@/components/toast/ToastProvider';
import { openStoreInvoiceView } from '@/lib/invoices';

type SidebarSection =
  | 'pavilions'
  | 'household'
  | 'other-expenses'
  | 'admin-expenses'
  | 'staff';

type StoreSidebarProps = {
  storeId: number;
  store: {
    name?: string;
    currency?: 'RUB' | 'KZT' | string;
    permissions?: string[];
  };
  active?: SidebarSection;
  onOpenExtraIncome?: () => void;
  enableMobileMenu?: boolean;
};

export function StoreSidebar({
  storeId,
  store,
  active,
  onOpenExtraIncome,
  enableMobileMenu = true,
}: StoreSidebarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const toast = useToast();

  const permissions = store.permissions || [];
  const canManageStore = hasPermission(permissions, 'ASSIGN_PERMISSIONS');
  const canManageMedia = hasPermission(permissions, 'MANAGE_MEDIA');
  const canViewSummary = hasPermission(permissions, 'VIEW_SUMMARY');
  const canViewAccounting = hasPermission(permissions, 'VIEW_PAYMENTS');
  const canPayForService = canManageStore;
  const canOpenUtilities =
    hasPermission(permissions, 'VIEW_PAYMENTS') &&
    hasPermission(permissions, 'EDIT_PAYMENTS');

  const items: Array<{
    key: SidebarSection;
    label: string;
    href: string;
    visible: boolean;
    icon: LucideIcon;
  }> = [
    {
      key: 'pavilions',
      label: 'Павильоны',
      href: `/stores/${storeId}#pavilions`,
      visible: hasPermission(permissions, 'VIEW_PAVILIONS'),
      icon: Store,
    },
    {
      key: 'household',
      label: 'Хоз расходы',
      href: `/stores/${storeId}/household`,
      visible: hasPermission(permissions, 'VIEW_CHARGES'),
      icon: Toolbox,
    },
    {
      key: 'other-expenses',
      label: 'Прочие расходы',
      href: `/stores/${storeId}/other-expenses`,
      visible: hasPermission(permissions, 'VIEW_CHARGES'),
      icon: BanknoteArrowDown,
    },
    {
      key: 'admin-expenses',
      label: 'Административные расходы',
      href: `/stores/${storeId}/admin-expenses`,
      visible: hasPermission(permissions, 'VIEW_CHARGES'),
      icon: LockKeyhole,
    },
    {
      key: 'staff',
      label: 'Штатное расписание',
      href: `/stores/${storeId}/staff`,
      visible: hasPermission(permissions, 'VIEW_STAFF'),
      icon: UsersRound,
    },
  ];

  const renderMenuContent = (isMobile = false) => (
    <>
      <div className="mb-5">
        <p className="text-xs uppercase tracking-[0.12em] text-[#6B6B6B]">Объект</p>
        <h1 className="mt-1 text-xl font-bold text-slate-900">{store.name || 'Объект'}</h1>
        <p className="mt-1 text-sm text-slate-600">
          Валюта: {store.currency} ({getCurrencySymbol((store.currency as any) || 'RUB')})
        </p>
        <Link
          href="/dashboard"
          onClick={() => {
            if (isMobile) setMobileMenuOpen(false);
          }}
          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[#D8D1CB] bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-[#f9f5f0]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Назад к объектам
        </Link>
      </div>

      <div className="space-y-2 border-b border-slate-100 pb-4">
        {canViewSummary && (
          <Link
            href={`/stores/${storeId}/summary`}
            onClick={() => {
              if (isMobile) setMobileMenuOpen(false);
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF6A13] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#E65C00]"
          >
            <Sigma className="h-4 w-4" />
            СВОДКА
          </Link>
        )}

        {canViewAccounting && (
          <Link
            href={`/stores/${storeId}/accounting`}
            onClick={() => {
              if (isMobile) setMobileMenuOpen(false);
            }}
            className="flex items-center justify-center gap-2 rounded-xl bg-[#0F172A] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#020617]"
          >
            <CheckCheck className="h-4 w-4" />
            Открытие/закрытие смены
          </Link>
        )}

        {(canOpenUtilities || canViewAccounting) && (
          <div className="grid grid-cols-2 gap-2 pt-1">
            {canOpenUtilities && (
              <Link
                href={`/stores/${storeId}/utilities`}
                onClick={() => {
                  if (isMobile) setMobileMenuOpen(false);
                }}
                className={`flex items-center justify-center gap-1.5 rounded-lg border border-[#D8D1CB] bg-white px-2 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-[#f9f5f0] ${
                  canViewAccounting ? '' : 'col-span-2'
                }`}
              >
                <HandCoins className="h-3.5 w-3.5" />
                Начисления
              </Link>
            )}
            {canViewAccounting &&
              (onOpenExtraIncome ? (
                <button
                  onClick={() => {
                    onOpenExtraIncome();
                    if (isMobile) setMobileMenuOpen(false);
                  }}
                  className={`flex items-center justify-center gap-1.5 rounded-lg border border-[#D8D1CB] bg-white px-2 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-[#f9f5f0] ${
                    canOpenUtilities ? '' : 'col-span-2'
                  }`}
                >
                  <BanknoteArrowDown className="h-3.5 w-3.5" />
                  Доп приход
                </button>
              ) : (
                <Link
                  href={`/stores/${storeId}`}
                  onClick={() => {
                    if (isMobile) setMobileMenuOpen(false);
                  }}
                  className={`flex items-center justify-center gap-1.5 rounded-lg border border-[#D8D1CB] bg-white px-2 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-[#f9f5f0] ${
                    canOpenUtilities ? '' : 'col-span-2'
                  }`}
                >
                  <BanknoteArrowDown className="h-3.5 w-3.5" />
                  Доп приход
                </Link>
              ))}
          </div>
        )}
      </div>

      <div className="pt-4">
        <p className="mb-2 text-xs uppercase tracking-[0.12em] text-[#6B6B6B]">Навигация</p>
        <nav className="space-y-1">
          {items
            .filter((i) => i.visible)
            .map((item) => (
              <Link
                key={item.key}
                href={item.href}
                onClick={() => {
                  if (isMobile) setMobileMenuOpen(false);
                }}
                className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${
                  active === item.key
                    ? 'bg-[#FFE8DB] text-[#C2410C]'
                    : 'text-slate-600 hover:bg-[#F4EFEB] hover:text-slate-900'
                }`}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="font-medium">{item.label}</span>
              </Link>
            ))}
        </nav>

        {canPayForService && (
          <div className="mt-3 border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={() => {
                void openStoreInvoiceView(storeId)
                  .then(() => {
                    toast.success('Счет открыт в новой вкладке');
                    if (isMobile) setMobileMenuOpen(false);
                  })
                  .catch((err: any) => {
                    toast.error(err?.message || 'Не удалось открыть счет');
                  });
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#D8D1CB] bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-[#F4EFEB]"
            >
              <HandCoins className="h-4 w-4" />
              Оплатить
            </button>
          </div>
        )}

        {(canManageStore || canManageMedia) && (
          <div className="mt-3 border-t border-slate-100 pt-3">
            <Link
              href={`/stores/${storeId}/settings`}
              onClick={() => {
                if (isMobile) setMobileMenuOpen(false);
              }}
              className="flex items-center justify-center gap-2 rounded-xl border border-[#D8D1CB] px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-[#F4EFEB]"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Управление объектом
            </Link>
          </div>
        )}
      </div>

      <div className="mt-4 border-t border-slate-100 pt-4">
        <LogoutButton
          onLoggedOut={() => {
            if (isMobile) setMobileMenuOpen(false);
          }}
          className="w-full rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100"
        />
      </div>
    </>
  );

  return (
    <>
      {enableMobileMenu && (
        <>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="fixed right-3 top-3 z-50 inline-flex items-center gap-1.5 rounded-xl border border-[#d8d1cb] bg-white px-3 py-2 text-sm font-semibold text-[#111111] shadow-sm lg:hidden"
          >
            <Menu className="h-4 w-4" />
            Меню
          </button>

          <div
            className={`fixed inset-0 z-[60] bg-black/40 transition-opacity lg:hidden ${
              mobileMenuOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
            }`}
          >
            <button
              type="button"
              aria-label="Закрыть меню"
              className="absolute inset-0"
              onClick={() => setMobileMenuOpen(false)}
            />
            <aside
              className={`absolute left-0 top-0 h-full w-[86%] max-w-sm overflow-y-auto border-r border-[#D8D1CB] bg-[#F4EFEB] p-5 shadow-xl transition-transform ${
                mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
              }`}
            >
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm font-semibold text-[#111111]">Навигация</p>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-lg border border-[#d8d1cb] bg-white p-1.5 text-[#6b6b6b]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {renderMenuContent(true)}
            </aside>
          </div>
        </>
      )}

      <aside className="sticky top-4 hidden h-[calc(100vh-2rem)] w-[320px] shrink-0 overflow-y-auto rounded-2xl border border-[#D8D1CB] bg-[#F4EFEB] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] lg:block">
        {renderMenuContent()}
      </aside>
    </>
  );
}

