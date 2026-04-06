import { PavilionStatus, PrismaClient } from '@prisma/client';
import { addMonths, endOfMonth, startOfMonth } from 'date-fns';

const prisma = new PrismaClient();

function hasApplyFlag() {
  return process.argv.includes('--apply');
}

function formatAmount(value: number) {
  return value.toFixed(2);
}

function getMonthlyDiscountTotal(
  discounts: Array<{ amount: number; startsAt: Date; endsAt: Date | null }>,
  period: Date,
) {
  const monthStart = startOfMonth(period);
  const monthEnd = endOfMonth(period);

  return discounts.reduce((sum, discount) => {
    const startsBeforeMonthEnds = discount.startsAt <= monthEnd;
    const endsAfterMonthStarts =
      discount.endsAt === null || discount.endsAt >= monthStart;

    if (startsBeforeMonthEnds && endsAfterMonthStarts) {
      return sum + Number(discount.amount ?? 0);
    }

    return sum;
  }, 0);
}

async function refreshMonthlyLedger(pavilionId: number, period: Date) {
  const normalizedPeriod = startOfMonth(period);
  const monthStart = startOfMonth(normalizedPeriod);
  const monthEnd = endOfMonth(normalizedPeriod);

  const pavilion = await prisma.pavilion.findUnique({
    where: { id: pavilionId },
    include: {
      discounts: true,
      payments: {
        where: { period: normalizedPeriod },
      },
      additionalCharges: {
        where: {
          createdAt: {
            gte: monthStart,
            lte: monthEnd,
          },
        },
        include: {
          payments: {
            where: {
              paidAt: {
                gte: monthStart,
                lte: monthEnd,
              },
            },
          },
        },
      },
    },
  });

  if (!pavilion) return;

  const previousPeriod = startOfMonth(
    new Date(normalizedPeriod.getFullYear(), normalizedPeriod.getMonth() - 1, 1),
  );
  const previousLedger = await prisma.pavilionMonthlyLedger.findUnique({
    where: {
      pavilionId_period: {
        pavilionId,
        period: previousPeriod,
      },
    },
    select: { closingDebt: true },
  });
  const openingDebt = Number(previousLedger?.closingDebt ?? 0);

  const baseRent = Number(
    pavilion.rentAmount ?? pavilion.squareMeters * pavilion.pricePerSqM,
  );
  const monthlyDiscount =
    pavilion.status === PavilionStatus.PREPAID
      ? 0
      : getMonthlyDiscountTotal(pavilion.discounts, normalizedPeriod);
  const expectedRent =
    pavilion.status === PavilionStatus.PREPAID
      ? baseRent
      : pavilion.status === PavilionStatus.RENTED
        ? Math.max(baseRent - monthlyDiscount, 0)
        : 0;
  const expectedUtilities =
    pavilion.status === PavilionStatus.RENTED
      ? Number(pavilion.utilitiesAmount ?? 0)
      : 0;
  const expectedAdvertising =
    pavilion.status === PavilionStatus.RENTED
      ? Number(pavilion.advertisingAmount ?? 0)
      : 0;
  const expectedAdditional =
    pavilion.status === PavilionStatus.RENTED
      ? pavilion.additionalCharges.reduce(
          (sum, charge) => sum + Number(charge.amount ?? 0),
          0,
        )
      : 0;
  const expectedTotal =
    expectedRent + expectedUtilities + expectedAdvertising + expectedAdditional;

  const actualBase = pavilion.payments.reduce((sum, payment) => {
    const rentRaw = Number(payment.rentPaid ?? 0);
    const rentChannels =
      Number(payment.rentBankTransferPaid ?? 0) +
      Number(payment.rentCashbox1Paid ?? 0) +
      Number(payment.rentCashbox2Paid ?? 0);
    const utilitiesRaw = Number(payment.utilitiesPaid ?? 0);
    const utilitiesChannels =
      Number(payment.utilitiesBankTransferPaid ?? 0) +
      Number(payment.utilitiesCashbox1Paid ?? 0) +
      Number(payment.utilitiesCashbox2Paid ?? 0);
    const advertisingRaw = Number(payment.advertisingPaid ?? 0);
    const advertisingChannels =
      Number(payment.advertisingBankTransferPaid ?? 0) +
      Number(payment.advertisingCashbox1Paid ?? 0) +
      Number(payment.advertisingCashbox2Paid ?? 0);

    const rent = rentRaw > 0 ? rentRaw : rentChannels;
    const utilities = utilitiesRaw > 0 ? utilitiesRaw : utilitiesChannels;
    const advertising = advertisingRaw > 0 ? advertisingRaw : advertisingChannels;
    return sum + rent + utilities + advertising;
  }, 0);

  const actualAdditional = pavilion.additionalCharges.reduce(
    (sum, charge) =>
      sum +
      charge.payments.reduce(
        (paymentSum, payment) => paymentSum + Number(payment.amountPaid ?? 0),
        0,
      ),
    0,
  );

  const actualTotal = actualBase + actualAdditional;
  const monthDelta = expectedTotal - actualTotal;
  const closingDebt = openingDebt + monthDelta;

  await prisma.pavilionMonthlyLedger.upsert({
    where: {
      pavilionId_period: {
        pavilionId,
        period: normalizedPeriod,
      },
    },
    update: {
      expectedRent,
      expectedUtilities,
      expectedAdvertising,
      expectedAdditional,
      expectedTotal,
      actualTotal,
      openingDebt,
      monthDelta,
      closingDebt,
    },
    create: {
      pavilionId,
      period: normalizedPeriod,
      expectedRent,
      expectedUtilities,
      expectedAdvertising,
      expectedAdditional,
      expectedTotal,
      actualTotal,
      openingDebt,
      monthDelta,
      closingDebt,
    },
  });
}

async function main() {
  const apply = hasApplyFlag();
  const discounts = await prisma.pavilionDiscount.findMany({
    include: {
      pavilion: {
        select: {
          id: true,
          number: true,
          squareMeters: true,
        },
      },
    },
    orderBy: [{ pavilionId: 'asc' }, { id: 'asc' }],
  });

  if (discounts.length === 0) {
    console.log('No discounts found. Nothing to migrate.');
    return;
  }

  const plan = discounts.map((discount) => {
    const squareMeters = Number(discount.pavilion.squareMeters ?? 0);
    const oldAmount = Number(discount.amount ?? 0);
    const newAmount = Number((oldAmount * squareMeters).toFixed(2));
    return {
      discountId: discount.id,
      pavilionId: discount.pavilionId,
      pavilionNumber: discount.pavilion.number,
      squareMeters,
      oldAmount,
      newAmount,
      startsAt: discount.startsAt,
    };
  });

  console.log(`Found ${plan.length} discount(s) to convert.`);
  for (const item of plan.slice(0, 20)) {
    console.log(
      `discount #${item.discountId} pavilion ${item.pavilionNumber}: ${formatAmount(item.oldAmount)} x ${formatAmount(item.squareMeters)} = ${formatAmount(item.newAmount)}`,
    );
  }
  if (plan.length > 20) {
    console.log(`...and ${plan.length - 20} more.`);
  }

  if (!apply) {
    console.log('');
    console.log('Dry run only. No data was changed.');
    console.log('Run again with --apply to update discounts and recalculate ledgers.');
    return;
  }

  const earliestAffectedPeriodByPavilion = new Map<number, Date>();

  await prisma.$transaction(
    plan.map((item) => {
      const affectedPeriod = startOfMonth(item.startsAt);
      const existing = earliestAffectedPeriodByPavilion.get(item.pavilionId);
      if (!existing || affectedPeriod < existing) {
        earliestAffectedPeriodByPavilion.set(item.pavilionId, affectedPeriod);
      }

      return prisma.pavilionDiscount.update({
        where: { id: item.discountId },
        data: { amount: item.newAmount },
      });
    }),
  );

  console.log('Discount amounts updated. Recalculating pavilion ledgers...');

  const currentPeriod = startOfMonth(new Date());
  for (const [pavilionId, firstPeriod] of earliestAffectedPeriodByPavilion.entries()) {
    let period = startOfMonth(firstPeriod);
    while (period <= currentPeriod) {
      await refreshMonthlyLedger(pavilionId, period);
      period = addMonths(period, 1);
    }
    console.log(`Recalculated ledgers for pavilion #${pavilionId} начиная с ${firstPeriod.toISOString().slice(0, 10)}.`);
  }

  console.log('Done.');
}

main()
  .catch((error) => {
    console.error('Migration failed.');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
