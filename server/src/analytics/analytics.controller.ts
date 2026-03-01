import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { Permission } from '@prisma/client';
import type { Response } from 'express';
import { existsSync } from 'fs';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit');

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('stores/:storeId/analytics')
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}

  @Get()
  @Permissions(Permission.VIEW_PAYMENTS)
  get(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Query('period') period?: string,
  ) {
    return this.service.getStoreAnalytics(storeId, period);
  }

  @Get('summary-view')
  @Permissions('VIEW_SUMMARY' as Permission)
  getSummaryView(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Query('period') period?: string,
  ) {
    return this.service.getStoreAnalytics(storeId, period);
  }

  @Get('income-forecast-breakdown')
  @Permissions(Permission.VIEW_PAYMENTS)
  getIncomeForecastBreakdown(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Query('period') period?: string,
  ) {
    return this.service.getIncomeForecastBreakdown(storeId, period);
  }

  @Get('summary-view/pdf')
  @Permissions('VIEW_SUMMARY' as Permission)
  async downloadSummaryPdf(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Query('period') period: string | undefined,
    @Res() res: Response,
  ) {
    const analytics = await this.service.getStoreAnalytics(storeId, period);
    const storeName = await this.service.getStoreName(storeId);

    const summary = analytics?.summaryPage ?? {};
    const income = summary?.income ?? {};
    const expenses = summary?.expenses ?? {};
    const byType = expenses?.byType ?? {};
    const tradeArea = summary?.tradeArea ?? {};

    const periodLabel = period ?? this.formatPeriod(new Date());
    const fileName = `svodka-${storeId}-${periodLabel}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    const doc = new PDFDocument({ margin: 48, size: 'A4' });
    doc.pipe(res);

    this.registerPdfFonts(doc);

    const line = (label: string, value: string | number) => {
      doc.font('Main').fontSize(11).fillColor('#111827').text(`${label}: ${value}`);
    };
    const money = (value: unknown) => Number(value ?? 0).toFixed(2);

    doc.font('MainBold').fontSize(18).text('Сводка по объекту');
    doc.moveDown(0.5);
    line('Название объекта', storeName);
    line('Период', periodLabel);
    doc.moveDown(1);

    doc.font('MainBold').fontSize(14).text('1. Общий доход');
    doc.moveDown(0.4);
    line('Остаток с прошлого месяца', money(income?.previousMonthBalance));
    line('Аренда', money(income?.rent));
    line('Коммунальные', money(income?.facilities));
    line('Реклама', money(income?.advertising));
    line('Дополнительные начисления', money(income?.additional));
    line('Итого доход', money(income?.total));
    line('Безналичные', money(income?.channels?.bankTransfer));
    line('Наличные касса 1', money(income?.channels?.cashbox1));
    line('Наличные касса 2', money(income?.channels?.cashbox2));
    doc.moveDown(1);

    doc.font('MainBold').fontSize(14).text('2. Общий расход');
    doc.moveDown(0.4);
    line('Зарплаты', money(byType?.salaries));
    line('Налоги с зарплаты', money(byType?.payrollTax));
    line('Налог на прибыль', money(byType?.profitTax));
    line('Коммуналка объекта', money(byType?.facilities));
    line('Дивиденды', money(byType?.dividends));
    line('Услуги банка', money(byType?.bankServices));
    line('Хозяйственные расходы', money(byType?.household));
    line('НДС', money(byType?.vat));
    line('Аренда земли', money(byType?.landRent));
    line('Прочие расходы', money(byType?.other));
    line('Итого прогноз', money(expenses?.totals?.forecast));
    line('Итого факт', money(expenses?.totals?.actual));
    doc.moveDown(1);

    doc.font('MainBold').fontSize(14).text('3. Сальдо');
    doc.moveDown(0.4);
    line('Сальдо', money(summary?.saldo));
    doc.moveDown(1);

    doc.font('MainBold').fontSize(14).text('4. Торговая площадь');
    doc.moveDown(0.4);
    line('Павильонов всего', Number(tradeArea?.pavilionsTotal ?? 0));
    line('Павильонов занято', Number(tradeArea?.pavilionsRented ?? 0));
    line('Павильонов свободно', Number(tradeArea?.pavilionsAvailable ?? 0));
    line('Площадь всего', Number(tradeArea?.squareTotal ?? 0));
    line('Площадь в аренде', Number(tradeArea?.squareRented ?? 0));
    line('Свободная площадь', Number(tradeArea?.squareAvailable ?? 0));

    doc.end();
  }

  private formatPeriod(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  private registerPdfFonts(doc: InstanceType<typeof PDFDocument>) {
    const regularCandidates = [
      '/usr/share/fonts/TTF/DejaVuSans.ttf',
      '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
      'C:\\Windows\\Fonts\\arial.ttf',
    ];
    const boldCandidates = [
      '/usr/share/fonts/TTF/DejaVuSans-Bold.ttf',
      '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
      'C:\\Windows\\Fonts\\arialbd.ttf',
    ];

    const regularPath = regularCandidates.find((path) => existsSync(path));
    const boldPath = boldCandidates.find((path) => existsSync(path));

    if (regularPath && boldPath) {
      doc.registerFont('Main', regularPath);
      doc.registerFont('MainBold', boldPath);
      return;
    }

    doc.registerFont('Main', 'Helvetica');
    doc.registerFont('MainBold', 'Helvetica-Bold');
  }
}
