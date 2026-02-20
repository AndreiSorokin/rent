import { StoreUserService } from './store-user.service';

describe('StoreUserService', () => {
  let service: StoreUserService;

  beforeEach(() => {
    service = new StoreUserService({} as any);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
