export interface User {
    _id: string;
    username: string;
    role: 'admin';
    settings: UserSettings;
    lastLogin?: string;
  }
  
  export interface UserSettings {
    theme: 'light' | 'dark';
    currency: string;
    taxRate: number;
    lowStockThreshold: number;
    refreshInterval: number;
  }
  
  export interface Product {
    _id: string;
    sku: string;
    name: string;
    category: ProductCategory;
    brand?: string;
    description?: string;
    buyingPrice: number;
    sellingPrice: number;
    profitMargin: number;
    stockQuantity: number;
    minimumStock: number;
    images: ProductImage[];
    status: 'active' | 'inactive';
    lastSold?: string;
    totalSold: number;
    totalRevenue: number;
    totalProfit: number;
    stockHistory: StockHistory[];
    createdAt: string;
    updatedAt: string;
    // Virtuals
    stockStatus?: 'out-of-stock' | 'low-stock' | 'in-stock';
    inventoryValue?: number;
  }
  
  export type ProductCategory = 
    | 'Electronics'
    | 'Clothing'
    | 'Books'
    | 'Home & Kitchen'
    | 'Sports'
    | 'Other';
  
  export interface ProductImage {
    url: string;
    publicId: string;
  }
  
  export interface StockHistory {
    date: string;
    quantity: number;
    type: 'purchase' | 'sale' | 'adjustment' | 'return';
    reference: string;
    note?: string;
  }
  
  export interface SaleItem {
    product: string;
    sku: string;
    name: string;
    quantity: number;
    buyingPrice: number;
    sellingPrice: number;
    discount: number;
    tax: number;
    profit: number;
  }
  
  export interface Sale {
    _id: string;
    invoiceNumber: string;
    items: SaleItem[];
    customerName?: string;
    customerEmail?: string;
    subTotal: number;
    totalDiscount: number;
    totalTax: number;
    grandTotal: number;
    totalProfit: number;
    paymentMethod: 'cash' | 'card' | 'upi' | 'bank_transfer' | 'credit';
    saleType: 'online' | 'offline';
    status: 'completed' | 'pending' | 'refunded' | 'cancelled';
    notes?: string;
    refundedAmount: number;
    refundReason?: string;
    createdAt: string;
    updatedAt: string;
  }
  
  export interface DashboardStats {
    kpis: {
      totalRevenue: number;
      totalProfit: number;
      totalLoss: number;
      inventoryValue: number;
      totalProducts: number;
      lowStockAlerts: number;
      onlineSalesToday: {
        revenue: number;
        count: number;
      };
      offlineSalesToday: {
        revenue: number;
        count: number;
      };
    };
    charts: {
      salesTrend: SalesTrendData[];
      profitByCategory: ProfitCategoryData[];
      topProducts: TopProductData[];
      deadStock: DeadStockData[];
    };
  }
  
  export interface SalesTrendData {
    date: string;
    revenue: number;
    profit: number;
    orders: number;
  }
  
  export interface ProfitCategoryData {
    category: string;
    profit: number;
    revenue: number;
  }
  
  export interface TopProductData {
    name: string;
    sku: string;
    revenue: number;
    profit: number;
    quantitySold: number;
  }
  
  export interface DeadStockData {
    _id: string;
    name: string;
    sku: string;
    category: string;
    stockQuantity: number;
    lastSold?: string;
    buyingPrice: number;
  }
  
  export interface Alert {
    id: string;
    type: 'low-stock' | 'profit-drop' | 'dead-stock' | 'opportunity';
    title: string;
    message: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    productId?: string;
    productName?: string;
    timestamp: string;
    read: boolean;
    action?: {
      label: string;
      onClick: () => void;
    };
  }
  
  export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    message?: string;
    error?: string;
  }