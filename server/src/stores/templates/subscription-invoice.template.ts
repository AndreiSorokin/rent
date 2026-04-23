type InvoiceTemplateData = {
  invoiceNumber: string;
  invoiceDate: string;
  amountRub: number;
  rentedPavilionsCount: number;
  currency?: 'RUB' | 'KZT' | string | null;
  customerCompanyName: string;
  customerLegalAddress: string;
  customerInn: string;
  offerUrl: string;
};

const formatMoney = (value: number) =>
  new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));

const escapeHtml = (value: string) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

export function renderSubscriptionInvoiceTemplate(data: InvoiceTemplateData) {
  const invoiceNumber = escapeHtml(data.invoiceNumber);
  const invoiceDate = escapeHtml(data.invoiceDate);
  const offerUrl = escapeHtml(data.offerUrl);
  const customerCompanyName = escapeHtml(data.customerCompanyName);
  const customerLegalAddress = escapeHtml(data.customerLegalAddress);
  const customerInn = escapeHtml(data.customerInn);
  const amountRub = formatMoney(data.amountRub);
  const currencyLabel = data.currency === 'KZT' ? 'тг.' : 'руб.';
  const rentedPavilionsCount = String(Number(data.rentedPavilionsCount ?? 0));

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Счет на оплату</title>
  <style>
    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      background: #ffffff;
      font-family: Arial, Helvetica, sans-serif;
      color: #000;
    }

    .page {
      width: 958px;
      margin: 0 auto;
      padding: 8px 10px 20px;
      background: #fff;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    .bank-table td,
    .goods-table th,
    .goods-table td {
      border: 2px solid #222;
    }

    .bank-table {
      font-size: 18px;
      line-height: 1.1;
    }

    .bank-table td {
      padding: 6px 10px;
      vertical-align: middle;
    }

    .bank-left {
      width: 56%;
    }

    .bank-mid {
      width: 13%;
      text-align: left;
      white-space: nowrap;
    }

    .bank-right {
      width: 31%;
      text-align: left;
      white-space: nowrap;
    }

    .muted {
      font-size: 16px;
      font-weight: 400;
    }

    .strong {
      font-weight: 700;
    }

    .title {
      margin: 28px 0 8px;
      font-size: 28px;
      font-weight: 800;
    }

    .divider {
      border-top: 3px solid #222;
      margin-bottom: 15px;
    }

    .party-row {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      font-size: 18px;
      margin-bottom: 28px;
    }

    .party-label {
      min-width: 120px;
      font-weight: 400;
    }

    .party-value {
      font-weight: 800;
      text-transform: uppercase;
      line-height: 1.2;
    }

    .buyer {
      font-size: 18px;
      margin: 8px 0 12px;
    }

    .goods-table {
      font-size: 18px;
    }

    .goods-table th,
    .goods-table td {
      padding: 5px 8px;
    }

    .goods-table th {
      font-weight: 700;
      text-align: center;
    }

    .goods-table td {
      vertical-align: middle;
    }

    .col-num {
      width: 52px;
      text-align: center;
    }

    .col-name {
      width: 420px;
    }

    .col-qty {
      width: 75px;
      text-align: center;
    }

    .col-unit {
      width: 70px;
      text-align: center;
    }

    .col-vat {
      width: 80px;
      text-align: center;
    }

    .col-price,
    .col-sum {
      width: 140px;
      text-align: right;
      white-space: nowrap;
    }

    .summary {
      margin-top: 10px;
      font-size: 18px;
      line-height: 1.45;
    }

    .summary-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
    }

    .summary-left {
      flex: 1;
    }

    .summary-right {
      min-width: 300px;
      display: flex;
      justify-content: space-between;
      gap: 20px;
      font-weight: 800;
    }

    .amount-words {
      font-size: 18px;
      font-weight: 800;
      margin-top: 2px;
    }

    .bottom-line {
      border-top: 2px solid #222;
      margin-top: 34px;
      padding-top: 72px;
    }

    .signatures {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      font-size: 18px;
      font-weight: 700;
      padding: 0 25px;
    }

    .signature-item {
      display: flex;
      align-items: flex-end;
      gap: 8px;
      min-width: 320px;
    }

    .signature-line {
      flex: 1;
      border-bottom: 2px solid #222;
      height: 20px;
    }

    .toolbar {
      width: 210mm;
      margin: 20px auto 20px;
      display: flex;
      justify-content: flex-end;
      gap: 12px;
    }
    .toolbar button {
      border: 1px solid #d6d3d1;
      background: #ffffff;
      border-radius: 999px;
      padding: 10px 18px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
    }
    .footnote {
      border-top: 1px solid var(--line);
      padding-top: 16px;
      margin-top: 16px;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.6;
    }
    .footnote a {
      color: #2563eb;
      word-break: break-word;
    }
    @media print {
      body {
        background: #ffffff;
      }
      .toolbar {
        display: none;
      }
      .page {
        margin: 0;
        width: auto;
        min-height: auto;
        box-shadow: none;
        padding: 12mm 10mm 14mm;
      }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="toolbar">
      <button type="button" onclick="window.print()">Печать / Сохранить в PDF</button>
    </div>
    <table class="bank-table">
      <tr>
        <td class="bank-left strong">
          <div>АО «ТБанк»</div>

        </td>
        <td class="bank-mid strong">БИК</td>
        <td class="bank-right strong">044525974</td>
      </tr>
      <tr>
        <td class="bank-left muted">Банк получателя</td>
        <td class="bank-mid strong">Сч. №</td>
        <td class="bank-right strong">30101810145250000974</td>
      </tr>
      <tr>
        <td class="bank-left">
          <span class="muted">ИНН</span>
          <span class="strong" style="margin-left: 12px;">366112533269</span>
        </td>
        <td class="bank-mid strong">Сч. №</td>
        <td class="bank-right strong">40802810100009476923</td>
      </tr>
      <tr>
        <td class="bank-left strong">
          <div>
            <div>ИП ФЕДОРОВ ВЛАДИМИР СЕРГЕЕВИЧ</div>
            <div>Получатель</div>
          </div>
        </td>
        <td class="bank-mid"></td>
        <td class="bank-right"></td>
      </tr>
    </table>

    <div class="title">Счет на оплату №${invoiceNumber} от ${invoiceDate} г.</div>
    <div class="divider"></div>

    <div class="party-row">
      <div class="party-label">Исполнитель:</div>
      <div class="party-value">
        ИП ФЕДОРОВ ВЛАДИМИР СЕРГЕЕВИЧ, ИНН 366112533269, 125212, РОССИЯ, Г<br />
        МОСКВА, УЛ АДМИРАЛА МАКАРОВА, Д 6Б, КОРП 2, КВ 102
      </div>
    </div>

    <div class="party-row">
      <div class="party-label">Заказчик:</div>
        <div class="party-value">
          ${customerCompanyName}, ИНН ${customerInn}, ${customerLegalAddress}
        </div>
    </div>

    <table class="goods-table">
      <thead>
        <tr>
          <th class="col-num">№</th>
          <th class="col-name">Товары (работы, услуги)</th>
          <th class="col-qty">кол-во</th>
          <th class="col-unit">Ед.</th>
          <th class="col-vat">НДС</th>
          <th class="col-price">Цена</th>
          <th class="col-sum">Сумма</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="col-num">1</td>
          <td class="col-name">
            Оплата по счету №${invoiceNumber} от ${invoiceDate} за доступ к сервису Palaci
          </td>
          <td class="col-qty">1</td>
          <td class="col-unit">мес</td>
          <td class="col-vat">Без НДС</td>
          <td class="col-price">${amountRub}</td>
          <td class="col-sum">${amountRub}</td>
        </tr>
      </tbody>
    </table>

    <div class="summary">
      <div class="summary-row">
        <div class="summary-left">Всего наименований на сумму ${amountRub} ${currencyLabel}</div>
        <div class="summary-right">
          <span>Итого к оплате:</span>
          <span>${amountRub}</span>
        </div>
      </div>
    </div>

    <div class="bottom-line">
      <div class="signatures">
        <div class="signature-item">
          <span>Руководитель</span>
          <span class="signature-line"></span>
        </div>
        <div class="signature-item" style="justify-content: flex-end;">
          <span>Бухгалтер</span>
          <span class="signature-line"></span>
        </div>
      </div>
    </div>
    <section class="footnote">
      Оплачивая настоящий счет, вы присоединяетесь к Оферте на оказание услуг сервиса Palaci, размещенной по адресу:
      <a href="${offerUrl}" target="_blank" rel="noreferrer">${offerUrl}</a>
    </section>
  </div>
</body>
</html>`;
}
