'use client';

import { PavilionLease } from '../pavilion.types';
import { PavilionContractsTable } from './PavilionContractsTable';
import { formatDateKey } from '@/lib/dateTime';

export function PavilionContractsHistoryModal({
  open,
  onClose,
  leaseHistory,
  leaseStatusLabel,
  storeTimeZone,
  apiUrl,
  canDeleteContracts,
  onDeleteContract,
}: {
  open: boolean;
  onClose: () => void;
  leaseHistory: PavilionLease[];
  leaseStatusLabel: Record<string, string>;
  storeTimeZone: string;
  apiUrl?: string;
  canDeleteContracts: boolean;
  onDeleteContract: (contractId: number) => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-[#d8d1cb] bg-white shadow-[0_20px_60px_-30px_rgba(17,17,17,0.45)]">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#e8e1da] bg-white/95 px-6 py-4 backdrop-blur-sm">
          <div>
            <h2 className="text-xl font-extrabold text-[#111111]">Все договоры</h2>
            <p className="mt-1 text-sm text-[#6b6b6b]">
              Полная история договоров по этому павильону, включая прошлые аренды.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-[#f4efeb] hover:text-[#111111]"
            aria-label="Закрыть историю договоров"
          >
            <span aria-hidden>✕</span>
          </button>
        </div>

        <div className="space-y-4 p-6">
          {leaseHistory.length === 0 ? (
            <p className="text-gray-500">История договоров пока отсутствует.</p>
          ) : (
            leaseHistory.map((lease) => (
              <div
                key={lease.id}
                className="rounded-2xl border border-[#e5ddd5] bg-[#fcfaf7] p-4"
              >
                {!lease.contracts || lease.contracts.length === 0 ? (
                  <p className="text-sm text-gray-500">По этой аренде договоры не сохранены</p>
                ) : (
                  <PavilionContractsTable
                    contracts={lease.contracts}
                    storeTimeZone={storeTimeZone}
                    apiUrl={apiUrl}
                    canDeleteContracts={canDeleteContracts}
                    onDeleteContract={onDeleteContract}
                  />
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
