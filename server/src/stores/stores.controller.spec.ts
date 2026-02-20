import { StoresController } from './stores.controller';
import { StoresService } from './stores.service';

describe('StoresController', () => {
  let controller: StoresController;

  beforeEach(() => {
    controller = new StoresController({} as StoresService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
