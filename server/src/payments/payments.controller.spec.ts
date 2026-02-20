import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

describe('PaymentsController', () => {
  let controller: PaymentsController;

  beforeEach(() => {
    controller = new PaymentsController({} as PaymentsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
