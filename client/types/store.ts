export type Permission =
  | 'VIEW_PAVILIONS'
  | 'CREATE_PAVILIONS'
  | 'EDIT_PAVILIONS'
  | 'DELETE_PAVILIONS'
  | 'VIEW_PAYMENTS'
  | 'CREATE_PAYMENTS'
  | 'EDIT_PAYMENTS'
  | 'CALCULATE_PAYMENTS'
  | 'VIEW_CHARGES'
  | 'CREATE_CHARGES'
  | 'EDIT_CHARGES'
  | 'DELETE_CHARGES'
  | 'VIEW_CONTRACTS'
  | 'UPLOAD_CONTRACTS'
  | 'DELETE_CONTRACTS'
  | 'INVITE_USERS'
  | 'ASSIGN_PERMISSIONS';

export type Currency = 'RUB' | 'KZT';

export interface Pavilion {
  id: number;
  number: string;
  category?: string | null;
  tenantName?: string | null;
  status: 'AVAILABLE' | 'RENTED' | 'PREPAID';
}

export interface Store {
  id: number;
  name: string;
  currency: Currency;
  pavilions: Pavilion[];
  permissions: Permission[];
}
