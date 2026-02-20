import { StoreUserController } from './store-user.controller';
import { StoreUserService } from './store-user.service';

describe('StoreUserController', () => {
  let controller: StoreUserController;

  beforeEach(() => {
    controller = new StoreUserController({} as StoreUserService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
