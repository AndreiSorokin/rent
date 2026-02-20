import { AdditionalChargeController } from './additional-charge.controller';
import { AdditionalChargeService } from './additional-charge.service';

describe('AdditionalChargeController', () => {
  let controller: AdditionalChargeController;

  beforeEach(() => {
    controller = new AdditionalChargeController({} as AdditionalChargeService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
