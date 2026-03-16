export type Permission =
  | 'VIEW_PAVILIONS'
  | 'VIEW_STAFF'
  | 'MANAGE_STAFF'
  | 'CREATE_PAVILIONS'
  | 'EXPORT_STORE_DATA'
  | 'MANAGE_MEDIA'
  | 'EDIT_PAVILIONS'
  | 'DELETE_PAVILIONS'
  | 'VIEW_PAYMENTS'
  | 'VIEW_SUMMARY'
  | 'VIEW_ACTIVITY'
  | 'CREATE_PAYMENTS'
  | 'EDIT_PAYMENTS'
  | 'VIEW_CHARGES'
  | 'CREATE_CHARGES'
  | 'EDIT_CHARGES'
  | 'DELETE_CHARGES'
  | 'VIEW_CONTRACTS'
  | 'UPLOAD_CONTRACTS'
  | 'DELETE_CONTRACTS'
  | 'INVITE_USERS'
  | 'REMOVE_USERS'
  | 'ASSIGN_PERMISSIONS';

export type Currency = 'RUB' | 'KZT';

export interface Pavilion {
  id: number;
  number: string;
  category?: string | null;
  tenantName?: string | null;
  status: 'AVAILABLE' | 'RENTED' | 'PREPAID';
  additionalCharges?: Array<{
    id: number;
    name: string;
    amount: number;
  }>;
}

export interface Store {
  id: number;
  name: string;
  currency: Currency;
  pavilions: Pavilion[];
  permissions: Permission[];
}
