import axios, { type InternalAxiosRequestConfig, type AxiosResponse, type AxiosError } from 'axios';
import type { Product, Sale, DashboardStats, ApiResponse } from '@/types';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for adding auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Response interceptor: unwrap { success, data } so callers get payload directly
api.interceptors.response.use(
  (response: AxiosResponse) => {
    const body = response.data as { success?: boolean; data?: unknown };
    if (body && body.success === true && Object.prototype.hasOwnProperty.call(body, 'data')) {
      return body.data as typeof response.data;
    }
    return response.data;
  },
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    const errPayload = error.response?.data as { message?: string; error?: string } | undefined;
    const message = errPayload?.message ?? errPayload?.error ?? (error as Error).message;
    return Promise.reject(
      typeof errPayload === 'object' && errPayload !== null ? { ...errPayload, message } : { message }
    );
  }
);

export const authApi = {
  login: async (username: string, password: string): Promise<{ token: string; user: unknown }> => {
    return api.post('/auth/login', { username, password }) as Promise<{ token: string; user: unknown }>;
  },

  logout: async () => {
    localStorage.removeItem('token');
  },
};

export const productApi = {
  getAll: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
    status?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    minStock?: number;
    maxStock?: number;
  }): Promise<{ products: Product[]; total: number }> => {
    return api.get('/products', { params }) as Promise<{ products: Product[]; total: number }>;
  },

  getById: async (id: string) => {
    const response = await api.get<ApiResponse<Product>>(`/products/${id}`);
    return response;
  },

  create: async (product: Omit<Product, '_id' | 'createdAt' | 'updatedAt'>) => {
    const response = await api.post<ApiResponse<Product>>('/products', product);
    return response;
  },

  update: async (id: string, product: Partial<Product>) => {
    const response = await api.put<ApiResponse<Product>>(`/products/${id}`, product);
    return response;
  },

  delete: async (id: string) => {
    const response = await api.delete<ApiResponse>(`/products/${id}`);
    return response;
  },

  bulkDelete: async (ids: string[]) => {
    const response = await api.post<ApiResponse>('/products/bulk-delete', { ids });
    return response;
  },

  updateStock: async (id: string, quantity: number, type: string, note?: string) => {
    const response = await api.post<ApiResponse<Product>>(`/products/${id}/stock`, {
      quantity,
      type,
      note,
    });
    return response;
  },
};

export const saleApi = {
  getAll: async (params?: {
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
    type?: 'online' | 'offline';
    paymentMethod?: string;
    status?: string;
  }): Promise<{ sales: Sale[]; total: number; summary?: { totalRevenue: number; totalProfit: number; totalSales: number; avgOrderValue: number } }> => {
    return api.get('/sales', { params }) as Promise<{ sales: Sale[]; total: number; summary?: { totalRevenue: number; totalProfit: number; totalSales: number; avgOrderValue: number } }>;
  },

  create: async (sale: {
    items: Array<{ product: string; sku: string; name: string; quantity: number; buyingPrice: number; sellingPrice: number; discount: number; tax: number; profit: number }>;
    customerName?: string;
    customerEmail?: string;
    paymentMethod: Sale['paymentMethod'];
    saleType: Sale['saleType'];
    notes?: string;
  }) => {
    const response = await api.post<ApiResponse<Sale>>('/sales', sale);
    return response;
  },

  getInvoice: async (id: string): Promise<Blob> => {
    const blob = await api.get(`/sales/${id}/invoice`, { responseType: 'blob' });
    return blob as unknown as Blob;
  },

  refund: async (id: string, amount: number, reason: string) => {
    const response = await api.post<ApiResponse<Sale>>(`/sales/${id}/refund`, {
      amount,
      reason,
    });
    return response;
  },
};

export const dashboardApi = {
  getDashboardStats: async (): Promise<DashboardStats> => {
    return api.get('/dashboard/stats') as Promise<DashboardStats>;
  },

  getSalesAnalytics: async (period: string, type: string) => {
    const data = await api.get<unknown>('/dashboard/analytics', {
      params: { period, type },
    });
    return data;
  },
};

export const reportApi = {
  salesReport: async (params?: { startDate?: string; endDate?: string; format?: string }) => {
    const response = await api.get<ApiResponse>('/reports/sales', { params });
    return response;
  },

  inventoryReport: async (params?: { format?: string }) => {
    const response = await api.get<ApiResponse>('/reports/inventory', { params });
    return response;
  },

  profitLossReport: async (params?: { startDate?: string; endDate?: string }) => {
    const response = await api.get<ApiResponse>('/reports/profit-loss', { params });
    return response;
  },
};

export const exportApi = {
  exportSales: async (params: {
    startDate: string;
    endDate: string;
    format?: string;
  }): Promise<Blob> => {
    const blob = await api.get(`/sales/export`, { params, responseType: 'blob' });
    return blob as unknown as Blob;
  },

  exportInventory: async (params: {
    format?: string;
    includeValuation?: boolean;
  }): Promise<Blob> => {
    const blob = await api.get(`/reports/inventory`, { params, responseType: 'blob' });
    return blob as unknown as Blob;
  },
};

export default api;