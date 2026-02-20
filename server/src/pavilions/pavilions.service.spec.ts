import { PavilionsService } from './pavilions.service';

describe('PavilionsService', () => {
  let service: PavilionsService;

  beforeEach(() => {
    service = new PavilionsService({} as any);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
