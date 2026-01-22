import { Test, TestingModule } from '@nestjs/testing';
import { StoreUserController } from './store-user.controller';

describe('StoreUserController', () => {
  let controller: StoreUserController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StoreUserController],
    }).compile();

    controller = module.get<StoreUserController>(StoreUserController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
