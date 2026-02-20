import { PavilionsController } from './pavilions.controller';
import { PavilionsService } from './pavilions.service';

describe('PavilionsController', () => {
  let controller: PavilionsController;

  beforeEach(() => {
    controller = new PavilionsController({} as PavilionsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
