'use client';

import { useTranslations } from 'next-intl';
import { PavilionContract } from '../pavilion.types';
import { formatDateKey, formatDateInTimeZone } from '@/lib/dateTime';

export function PavilionContractsTable({
  contracts,
  storeTimeZone,
  apiUrl,
  canDeleteContracts,
  onDeleteContract,
}: {
  contracts: PavilionContract[];
  storeTimeZone: string;
  apiUrl?: string;
  canDeleteContracts: boolean;
  onDeleteContract: (contractId: number) => void;
}) {
  const t = useTranslations('PavilionContractsTable');
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-[#f4efeb]">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">{t('fileHeader')}</th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">{t('numberHeader')}</th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">{t('expiresHeader')}</th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">{t('typeHeader')}</th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">{t('uploadedHeader')}</th>
            <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">{t('actionsHeader')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {contracts.map((contract) => (
            <tr key={contract.id}>
              <td className="px-6 py-4 text-sm">
                <a
                  href={`${apiUrl}${contract.filePath}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {contract.fileName}
                </a>
              </td>
              <td className="px-6 py-4 text-sm">{contract.contractNumber || '—'}</td>
              <td className="px-6 py-4 text-sm">{formatDateKey(contract.expiresOn)}</td>
              <td className="px-6 py-4 text-sm">{contract.fileType}</td>
              <td className="px-6 py-4 text-sm">
                {formatDateInTimeZone(contract.uploadedAt, storeTimeZone)}
              </td>
              <td className="px-6 py-4 text-right text-sm">
                {canDeleteContracts && (
                  <button
                    onClick={() => onDeleteContract(contract.id)}
                    className="text-red-600 hover:underline"
                  >
                    {t('delete')}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
