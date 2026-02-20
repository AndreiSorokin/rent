import { AdditionalChargeService } from './additional-charge.service';

describe('AdditionalChargeService', () => {
  let service: AdditionalChargeService;

  beforeEach(() => {
    service = new AdditionalChargeService({} as any);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
