export type ContractFile = {
  id: number;
  fileName: string;
  filePath: string;
  fileType: string;
  uploadedAt: string;
  pavilionId: number;
};

export async function getContracts(
  storeId: number,
  pavilionId: number,
): Promise<ContractFile[]> {
  const token = localStorage.getItem('token');
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/stores/${storeId}/pavilions/${pavilionId}/contracts`,
    {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    },
  );

  if (!res.ok) {
    throw new Error(await res.text());
  }

  return res.json();
}

export async function uploadContract(
  storeId: number,
  pavilionId: number,
  file: File,
): Promise<ContractFile> {
  const token = localStorage.getItem('token');
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/stores/${storeId}/pavilions/${pavilionId}/contracts`,
    {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    },
  );

  if (!res.ok) {
    throw new Error(await res.text());
  }

  return res.json();
}

export async function deleteContract(
  storeId: number,
  pavilionId: number,
  contractId: number,
) {
  const token = localStorage.getItem('token');
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/stores/${storeId}/pavilions/${pavilionId}/contracts/${contractId}`,
    {
      method: 'DELETE',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    },
  );

  if (!res.ok) {
    throw new Error(await res.text());
  }

  return res.json();
}
