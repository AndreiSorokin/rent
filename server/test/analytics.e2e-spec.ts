import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AnalyticsController } from '../src/analytics/analytics.controller';
import { AnalyticsService } from '../src/analytics/analytics.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../src/auth/guards/permissions.guard';

describe('AnalyticsController (e2e)', () => {
  let app: INestApplication<App>;
  const analyticsServiceMock = {
    getStoreAnalytics: jest.fn(),
  };

  beforeEach(async () => {
    analyticsServiceMock.getStoreAnalytics.mockReset();
    analyticsServiceMock.getStoreAnalytics.mockResolvedValue({
      summaryPage: {
        income: { total: 1000 },
        expenses: { totals: { actual: 400 } },
        saldo: 600,
      },
    });

    const moduleBuilder = Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [
        { provide: AnalyticsService, useValue: analyticsServiceMock },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true });

    const moduleFixture: TestingModule = await moduleBuilder.compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('GET /stores/:storeId/analytics returns analytics payload', async () => {
    await request(app.getHttpServer())
      .get('/stores/42/analytics')
      .expect(200)
      .expect((res) => {
        expect(res.body).toMatchObject({
          summaryPage: {
            income: { total: 1000 },
            expenses: { totals: { actual: 400 } },
            saldo: 600,
          },
        });
      });

    expect(analyticsServiceMock.getStoreAnalytics).toHaveBeenCalledWith(42);
  });
});
