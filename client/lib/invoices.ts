import { authorizedFetch } from './session';

export async function openStoreInvoiceView(storeId: number) {
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

  const invoiceWindow = window.open('about:blank', '_blank');
  if (!invoiceWindow) {
    throw new Error('Браузер заблокировал новую вкладку для счета');
  }
  try {
    invoiceWindow.opener = null;
  } catch {
    // Ignore browsers that disallow changing opener.
  }

  const createResponse = await authorizedFetch(`${baseUrl}/stores/${storeId}/invoices`, {
    method: 'POST',
  });

  if (!createResponse.ok) {
    invoiceWindow.close();
    throw new Error(await toMessage(createResponse, 'Не удалось выставить счет'));
  }

  const createdInvoice = (await createResponse.json()) as { id: number };
  const viewResponse = await authorizedFetch(
    `${baseUrl}/stores/${storeId}/invoices/${createdInvoice.id}/view`,
  );

  if (!viewResponse.ok) {
    invoiceWindow.close();
    throw new Error(await toMessage(viewResponse, 'Не удалось открыть счет'));
  }

  const html = await viewResponse.text();
  invoiceWindow.document.open();
  invoiceWindow.document.write(html);
  invoiceWindow.document.close();
}
