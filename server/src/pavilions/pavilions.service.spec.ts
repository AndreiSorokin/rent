import { Test, TestingModule } from '@nestjs/testing';
import { PavilionsService } from './pavilions.service';

describe('PavilionsService', () => {
  let service: PavilionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PavilionsService],
    }).compile();

    service = module.get<PavilionsService>(PavilionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
