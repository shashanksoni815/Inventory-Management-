export interface Franchise {
  _id: string;
  id?: string;
  name: string;
  code: string;
  location: string;
  status?: 'active' | 'inactive';
  stats?: {
    todayRevenue?: number;
    [key: string]: any;
  };
  performance?: number;
  inventoryTurnover?: number;
  customerSatisfaction?: number;
  complianceScore?: number;
  salesToday?: number;
}
