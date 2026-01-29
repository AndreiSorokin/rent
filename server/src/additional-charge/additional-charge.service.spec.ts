import { Test, TestingModule } from '@nestjs/testing';
import { AdditionalChargeService } from './additional-charge.service';

describe('AdditionalChargeService', () => {
  let service: AdditionalChargeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AdditionalChargeService],
    }).compile();

    service = module.get<AdditionalChargeService>(AdditionalChargeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
