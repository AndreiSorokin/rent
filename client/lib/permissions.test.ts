import { hasPermission } from './permissions';

describe('hasPermission', () => {
  it('returns true when permission exists in list', () => {
    expect(hasPermission(['VIEW_PAVILIONS', 'EDIT_PAVILIONS'], 'EDIT_PAVILIONS')).toBe(
      true,
    );
  });

  it('returns false when permission does not exist', () => {
    expect(hasPermission(['VIEW_PAVILIONS'], 'DELETE_PAVILIONS')).toBe(false);
  });
});
