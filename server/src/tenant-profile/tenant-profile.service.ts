import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  TenantLeaseStatus,
  TenantOrganizationType,
  TenantProfileType,
} from '@prisma/client';
import { subYears } from 'date-fns';
import { PrismaService } from '../prisma/prisma.service';

type UpdateTenantProfileInput = {
  fullName?: string | null;
  phone?: string | null;
  requisites?: string | null;
};

type CreateTenantOrganizationInput = {
  type: TenantOrganizationType;
  name: string;
  taxId?: string | null;
  registrationNumber?: string | null;
  legalAddress?: string | null;
};

type UpdateTenantOrganizationInput = {
  type?: TenantOrganizationType;
  name?: string | null;
  taxId?: string | null;
  registrationNumber?: string | null;
  legalAddress?: string | null;
};

@Injectable()
export class TenantProfileService {
  constructor(private readonly prisma: PrismaService) {}

  private trimNullable(value: string | null | undefined) {
    const normalized = String(value ?? '').trim();
    return normalized ? normalized : null;
  }

  private validateOrganizationType(value: string): TenantOrganizationType {
    if (value === TenantOrganizationType.IE || value === TenantOrganizationType.LLC) {
      return value;
    }
    throw new BadRequestException('Допустимые типы организации: IE или LLC');
  }

  private async ensureTenantProfile(userId: number) {
    const existing = await this.prisma.tenantProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (existing) return existing.id;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true },
    });

    if (!user) {
      throw new NotFoundException('Пользователь не найден');
    }

    const created = await this.prisma.tenantProfile.create({
      data: {
        userId,
        type: TenantProfileType.INDIVIDUAL,
        fullName: this.trimNullable(user.name),
      },
      select: { id: true },
    });

    return created.id;
  }

  private normalizeOrganizationInput(input: CreateTenantOrganizationInput) {
    const name = this.trimNullable(input.name);
    if (!name) {
      throw new BadRequestException('Укажите название организации');
    }

    return {
      type: this.validateOrganizationType(String(input.type)),
      name,
      taxId: this.trimNullable(input.taxId),
      registrationNumber: this.trimNullable(input.registrationNumber),
      legalAddress: this.trimNullable(input.legalAddress),
    };
  }

  async getMyProfile(userId: number) {
    await this.ensureTenantProfile(userId);

    const oneYearAgo = subYears(new Date(), 1);
    const debtHistoryFrom = subYears(new Date(), 1);

    const profile = await this.prisma.tenantProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            createdAt: true,
          },
        },
        organizations: {
          orderBy: { createdAt: 'desc' },
        },
        pavilionLeases: {
          where: {
            status: TenantLeaseStatus.ACTIVE,
          },
          orderBy: { startedAt: 'desc' },
          include: {
            pavilion: {
              select: {
                id: true,
                number: true,
                status: true,
                prepaidUntil: true,
                tenantName: true,
                rentAmount: true,
                utilitiesAmount: true,
                advertisingAmount: true,
                store: {
                  select: {
                    id: true,
                    name: true,
                    currency: true,
                    timeZone: true,
                  },
                },
                contracts: {
                  orderBy: { uploadedAt: 'desc' },
                  select: {
                    id: true,
                    fileName: true,
                    contractNumber: true,
                    expiresOn: true,
                    uploadedAt: true,
                  },
                },
              },
            },
          },
        },
        applications: {
          where: {
            createdAt: {
              gte: oneYearAgo,
            },
          },
          orderBy: { createdAt: 'desc' },
          include: {
            store: {
              select: {
                id: true,
                name: true,
              },
            },
            pavilion: {
              select: {
                id: true,
                number: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!profile) {
      throw new NotFoundException('Профиль арендатора не найден');
    }

    const pavilionIds = Array.from(
      new Set(profile.pavilionLeases.map((lease) => lease.pavilionId)),
    );

    const [paymentTransactions, monthlyLedgers] = await Promise.all([
      pavilionIds.length
        ? this.prisma.paymentTransaction.findMany({
            where: {
              pavilionId: { in: pavilionIds },
              createdAt: { gte: oneYearAgo },
            },
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              pavilionId: true,
              period: true,
              createdAt: true,
              rentPaid: true,
              utilitiesPaid: true,
              advertisingPaid: true,
              bankTransferPaid: true,
              cashbox1Paid: true,
              cashbox2Paid: true,
              pavilion: {
                select: {
                  id: true,
                  number: true,
                  store: {
                    select: {
                      id: true,
                      name: true,
                      currency: true,
                    },
                  },
                },
              },
            },
          })
        : Promise.resolve([]),
      pavilionIds.length
        ? this.prisma.pavilionMonthlyLedger.findMany({
            where: {
              pavilionId: { in: pavilionIds },
              period: { gte: debtHistoryFrom },
            },
            orderBy: [{ pavilionId: 'asc' }, { period: 'desc' }],
            select: {
              id: true,
              pavilionId: true,
              period: true,
              openingDebt: true,
              monthDelta: true,
              closingDebt: true,
              pavilion: {
                select: {
                  id: true,
                  number: true,
                  store: {
                    select: {
                      id: true,
                      name: true,
                      currency: true,
                    },
                  },
                },
              },
            },
          })
        : Promise.resolve([]),
    ]);

    const debtHistoryByPavilion = new Map<number, typeof monthlyLedgers>();
    for (const entry of monthlyLedgers) {
      const existing = debtHistoryByPavilion.get(entry.pavilionId) ?? [];
      existing.push(entry);
      debtHistoryByPavilion.set(entry.pavilionId, existing);
    }

    return {
      id: profile.id,
      userId: profile.userId,
      email: profile.user.email,
      fullName: profile.fullName,
      phone: profile.phone,
      requisites: profile.requisites,
      type: profile.type,
      createdAt: profile.createdAt,
      organizations: profile.organizations,
      pavilions: profile.pavilionLeases.map((lease) => ({
        leaseId: lease.id,
        status: lease.status,
        startedAt: lease.startedAt,
        endedAt: lease.endedAt,
        pavilion: lease.pavilion,
      })),
      applicationHistory: profile.applications.map((application) => ({
        id: application.id,
        status: application.status,
        note: application.note,
        createdAt: application.createdAt,
        reviewedAt: application.reviewedAt,
        store: application.store,
        pavilion: application.pavilion,
      })),
      payments: paymentTransactions.map((payment) => ({
        id: payment.id,
        type: 'PAYMENT',
        pavilionId: payment.pavilionId,
        pavilionNumber: payment.pavilion.number,
        store: payment.pavilion.store,
        period: payment.period,
        createdAt: payment.createdAt,
        amount: Number(payment.rentPaid ?? 0) +
          Number(payment.utilitiesPaid ?? 0) +
          Number(payment.advertisingPaid ?? 0),
        rentPaid: payment.rentPaid,
        utilitiesPaid: payment.utilitiesPaid,
        advertisingPaid: payment.advertisingPaid,
        bankTransferPaid: payment.bankTransferPaid,
        cashbox1Paid: payment.cashbox1Paid,
        cashbox2Paid: payment.cashbox2Paid,
      })),
      debts: profile.pavilionLeases.map((lease) => {
        const history = debtHistoryByPavilion.get(lease.pavilionId) ?? [];
        return {
          pavilionId: lease.pavilionId,
          pavilionNumber: lease.pavilion.number,
          store: lease.pavilion.store,
          currentDebt: history[0]?.closingDebt ?? 0,
          history: history.map((entry) => ({
            id: entry.id,
            period: entry.period,
            openingDebt: entry.openingDebt,
            monthDelta: entry.monthDelta,
            closingDebt: entry.closingDebt,
          })),
        };
      }),
    };
  }

  async updateMyProfile(userId: number, input: UpdateTenantProfileInput) {
    await this.ensureTenantProfile(userId);

    return this.prisma.tenantProfile.update({
      where: { userId },
      data: {
        fullName: input.fullName !== undefined ? this.trimNullable(input.fullName) : undefined,
        phone: input.phone !== undefined ? this.trimNullable(input.phone) : undefined,
        requisites:
          input.requisites !== undefined ? this.trimNullable(input.requisites) : undefined,
      },
      select: {
        id: true,
        userId: true,
        type: true,
        fullName: true,
        phone: true,
        requisites: true,
        updatedAt: true,
      },
    });
  }

  async createOrganization(userId: number, input: CreateTenantOrganizationInput) {
    const tenantProfileId = await this.ensureTenantProfile(userId);
    const normalized = this.normalizeOrganizationInput(input);

    return this.prisma.tenantOrganization.create({
      data: {
        tenantProfileId,
        ...normalized,
      },
    });
  }

  async updateOrganization(
    userId: number,
    organizationId: number,
    input: UpdateTenantOrganizationInput,
  ) {
    const tenantProfileId = await this.ensureTenantProfile(userId);

    const organization = await this.prisma.tenantOrganization.findUnique({
      where: { id: organizationId },
      select: { id: true, tenantProfileId: true },
    });

    if (!organization || organization.tenantProfileId !== tenantProfileId) {
      throw new NotFoundException('Организация не найдена');
    }

    const data: {
      type?: TenantOrganizationType;
      name?: string;
      taxId?: string | null;
      registrationNumber?: string | null;
      legalAddress?: string | null;
    } = {};

    if (input.type !== undefined) {
      data.type = this.validateOrganizationType(String(input.type));
    }
    if (input.name !== undefined) {
      const name = this.trimNullable(input.name);
      if (!name) {
        throw new BadRequestException('Укажите название организации');
      }
      data.name = name;
    }
    if (input.taxId !== undefined) {
      data.taxId = this.trimNullable(input.taxId);
    }
    if (input.registrationNumber !== undefined) {
      data.registrationNumber = this.trimNullable(input.registrationNumber);
    }
    if (input.legalAddress !== undefined) {
      data.legalAddress = this.trimNullable(input.legalAddress);
    }

    return this.prisma.tenantOrganization.update({
      where: { id: organizationId },
      data,
    });
  }

  async deleteOrganization(userId: number, organizationId: number) {
    const tenantProfileId = await this.ensureTenantProfile(userId);

    const organization = await this.prisma.tenantOrganization.findUnique({
      where: { id: organizationId },
      select: { id: true, tenantProfileId: true },
    });

    if (!organization || organization.tenantProfileId !== tenantProfileId) {
      throw new NotFoundException('Организация не найдена');
    }

    await this.prisma.tenantOrganization.delete({
      where: { id: organizationId },
    });

    return { success: true };
  }
}
