import { authorizedFetch } from './session';

export type ContractFile = {
  id: number;
  fileName: string;
  filePath: string;
  fileType: string;
  contractNumber?: string | null;
  expiresOn?: string | null;
  uploadedAt: string;
  pavilionId: number;
};

export type ContractUploadMeta = {
  contractNumber: string;
  expiresOn: string;
};

async function toErrorMessage(response: Response, fallback = 'API error') {
  const raw = await response.text();
  try {
    const parsed = JSON.parse(raw) as { message?: string | string[] };
    return Array.isArray(parsed.message)
      ? parsed.message.join(', ')
      : parsed.message || fallback;
  } catch {
    return raw || fallback;
  }
}

export function validateContractUploadMeta(
  meta: ContractUploadMeta,
  todayDateKey: string,
): string | null {
  const contractNumber = meta.contractNumber.trim();
  const expiresOn = meta.expiresOn.trim();

  if (!contractNumber) return 'Укажите номер договора';
  if (!expiresOn) return 'Укажите дату окончания договора';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expiresOn)) {
    return 'Укажите корректную дату окончания договора';
  }
  if (expiresOn < todayDateKey) {
    return 'Дата окончания договора не может быть в прошлом';
  }

  return null;
}

export async function getContracts(
  storeId: number,
  pavilionId: number,
): Promise<ContractFile[]> {
  const res = await authorizedFetch(
    `${process.env.NEXT_PUBLIC_API_URL}/stores/${storeId}/pavilions/${pavilionId}/contracts`,
  );

  if (!res.ok) {
    throw new Error(await toErrorMessage(res));
  }

  return res.json();
}

export async function uploadContract(
  storeId: number,
  pavilionId: number,
  file: File,
  meta: ContractUploadMeta,
): Promise<ContractFile> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('contractNumber', meta.contractNumber.trim());
  formData.append('expiresOn', meta.expiresOn.trim());

  const res = await authorizedFetch(
    `${process.env.NEXT_PUBLIC_API_URL}/stores/${storeId}/pavilions/${pavilionId}/contracts`,
    {
      method: 'POST',
      body: formData,
    },
  );

  if (!res.ok) {
    throw new Error(await toErrorMessage(res));
  }

  return res.json();
}

export async function deleteContract(
  storeId: number,
  pavilionId: number,
  contractId: number,
) {
  const res = await authorizedFetch(
    `${process.env.NEXT_PUBLIC_API_URL}/stores/${storeId}/pavilions/${pavilionId}/contracts/${contractId}`,
    {
      method: 'DELETE',
    },
  );

  if (!res.ok) {
    throw new Error(await toErrorMessage(res));
  }

  return res.json();
}
