import { Test, TestingModule } from '@nestjs/testing';
import { PavilionsController } from './pavilions.controller';

describe('PavilionsController', () => {
  let controller: PavilionsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PavilionsController],
    }).compile();

    controller = module.get<PavilionsController>(PavilionsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
