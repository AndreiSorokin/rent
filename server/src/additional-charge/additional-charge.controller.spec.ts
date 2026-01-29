import { Test, TestingModule } from '@nestjs/testing';
import { AdditionalChargeController } from './additional-charge.controller';

describe('AdditionalChargeController', () => {
  let controller: AdditionalChargeController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdditionalChargeController],
    }).compile();

    controller = module.get<AdditionalChargeController>(AdditionalChargeController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
