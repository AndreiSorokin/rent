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
  | 'DELETE_CHARGES';

export interface Pavilion {
  id: number;
  number: string;
  status: 'AVAILABLE' | 'RENTED';
}

export interface Store {
  id: number;
  name: string;
  pavilions: Pavilion[];
  permissions: Permission[];
}
