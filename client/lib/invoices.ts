export async function downloadStoreInvoicePdf(storeId: number) {
  const token = localStorage.getItem('token');
  const baseUrl = process.env.NEXT_PUBLIC_API_URL;
  const toMessage = async (response: Response, fallback: string) => {
    const errorText = await response.text();
    try {
      const parsed = JSON.parse(errorText) as { message?: string | string[] };
      const message = Array.isArray(parsed.message)
        ? parsed.message.join(', ')
        : parsed.message;
      return message || fallback;
    } catch {
      return errorText || fallback;
    }
  };

  const createResponse = await fetch(`${baseUrl}/stores/${storeId}/invoices`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!createResponse.ok) {
    throw new Error(await toMessage(createResponse, 'Не удалось выставить счет'));
  }

  const createdInvoice = (await createResponse.json()) as { id: number };
  const pdfResponse = await fetch(
    `${baseUrl}/stores/${storeId}/invoices/${createdInvoice.id}/pdf`,
    {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    },
  );

  if (!pdfResponse.ok) {
    throw new Error(await toMessage(pdfResponse, 'Не удалось скачать счет'));
  }

  const blob = await pdfResponse.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = `invoice-${storeId}-${createdInvoice.id}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}
