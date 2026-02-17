import axios, { type InternalAxiosRequestConfig, type AxiosResponse, type AxiosError } from 'axios';
import type { Product, Sale, DashboardStats, ApiResponse, AdminKpis, AdminCharts, FranchisePerformanceRow, AdminTransfersOverview, AdminInsights } from '@/types';

export const api = axios.create({
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
      typeof errPayload === 'object' && errPayload !== null 
        ? { ...errPayload, message, response: error.response } 
        : { message, response: error.response }
    );
  }
);

export const authApi = {
  login: async (email: string, password: string): Promise<{ token: string; user: unknown }> => {
    return api.post('/auth/login', { email, password }) as Promise<{ token: string; user: unknown }>;
  },

  register: async (data: {
    name: string;
    email: string;
    password: string;
    role?: 'admin' | 'manager' | 'sales';
    franchise?: string;
  }): Promise<{ token: string; user: unknown }> => {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/3fc7926a-846a-45b6-a134-1306e0ccfd99',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api.ts:61',message:'authApi.register called',data:{payload:data,hasName:!!data.name,hasEmail:!!data.email,hasPassword:!!data.password,role:data.role,franchise:data.franchise},timestamp:Date.now(),runId:'run1',hypothesisId:'A,B'})}).catch(()=>{});
    // #endregion
    return api.post('/auth/register', data) as Promise<{ token: string; user: unknown }>;
  },

  logout: async () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  getProfile: async () => {
    return api.get('/auth/profile') as Promise<unknown>;
  },

  updateProfile: async (data: { name?: string; email?: string; settings?: unknown }) => {
    return api.put('/auth/profile', data) as Promise<unknown>;
  },

  changePassword: async (currentPassword: string, newPassword: string) => {
    return api.post('/auth/change-password', { currentPassword, newPassword });
  },
};

export const userApi = {
  getAll: async (params?: {
    role?: 'admin' | 'manager' | 'sales';
    franchise?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) => {
    return api.get('/users', { params }) as Promise<{
      users: User[];
      pagination: { page: number; limit: number; total: number; pages: number };
    }>;
  },
  getById: async (id: string) => {
    return api.get(`/users/${id}`) as Promise<User>;
  },
  create: async (data: {
    name: string;
    email: string;
    password: string;
    role: 'manager' | 'sales';
    franchise: string;
  }) => {
    return api.post('/users', data) as Promise<{ data: User; message: string }>;
  },
  update: async (id: string, data: Partial<User>) => {
    return api.put(`/users/${id}`, data) as Promise<{ data: User; message: string }>;
  },
  delete: async (id: string) => {
    return api.delete(`/users/${id}`) as Promise<{ message: string }>;
  },
  toggleStatus: async (id: string) => {
    return api.patch(`/users/${id}/status`) as Promise<{ data: User; message: string }>;
  },
};

export const franchiseApi = {
  getAll: async () => api.get('/franchises'),
  /** id must be MongoDB _id (e.g. 65c9a8e2f...). In Network tab you should see /api/franchises/65c9a8e2f..., not /api/franchises/789456 (code). */
  getById: async (id: string) => api.get(`/franchises/${id}`),
  create: async (data: unknown) => api.post('/franchises', data),
  update: async (id: string, data: unknown) => api.put(`/franchises/${id}`, data),
  getNetworkStats: async () => api.get('/franchises/network/stats'),
  getAdminKpis: async (timeRange: string) =>
    api.get<AdminKpis>('/franchises/admin/kpis', { params: { timeRange } }),
  getAdminCharts: async (timeRange: string) =>
    api.get<AdminCharts>('/franchises/admin/charts', { params: { timeRange } }),
  getAdminPerformance: async (timeRange: string) =>
    api.get<FranchisePerformanceRow[]>('/franchises/admin/performance', { params: { timeRange } }),
  getAdminInsights: async (timeRange: string) =>
    api.get<AdminInsights>('/franchises/admin/insights', { params: { timeRange } }),
  getOrdersSummary: async (franchiseId: string) =>
    api.get<{
      totalOrders: number;
      deliveredOrders: number;
      pendingOrders: number;
      orderRevenue: number;
      recentOrders: Array<{
        _id: string;
        orderNumber: string;
        createdAt: string;
        customer?: { name?: string };
        orderStatus: string;
        grandTotal: number;
      }>;
    }>(`/franchises/${franchiseId}/orders-summary`),
  getDashboard: async (franchiseId: string, params?: { startDate?: string; endDate?: string; period?: string }) =>
    api.get<{
      franchise: { _id: string; name: string; code: string };
      period: { startDate: string | null; endDate: string | null; period: string };
      sales: {
        totalSales: number;
        totalRevenue: number;
        totalProfit: number;
        avgOrderValue: number;
      };
      products: {
        totalProducts: number;
        inventoryValue: number;
      };
      productPerformance: Array<{
        productId: string;
        productName: string;
        productSku: string;
        revenue: number;
        cost: number;
        profit: number;
        quantitySold: number;
        saleCount: number;
        marginPercent: number;
      }>;
      fastMovingProducts: Array<{
        productId: string;
        productName: string;
        productSku: string;
        quantitySold: number;
        saleCount: number;
        revenue: number;
        lastSold: string;
        velocityScore: number;
      }>;
      lowStockProducts: Array<{
        productId: string;
        sku: string;
        name: string;
        category: string;
        stockQuantity: number;
        minimumStock: number;
        buyingPrice: number;
        sellingPrice: number;
        inventoryValue: number;
        lastSold: string | null;
        stockStatus: 'out-of-stock' | 'low-stock';
      }>;
    }>(`/franchises/${franchiseId}/dashboard`, { params }),
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
    franchise?: string;
    isGlobal?: boolean;
  }): Promise<{ products: Product[]; pagination: { page: number; limit: number; total: number; pages: number } }> => {
    return api.get('/products', { params }) as Promise<{ products: Product[]; pagination: { page: number; limit: number; total: number; pages: number } }>;
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
  share: async (id: string, franchiseIds: string[]) => {
    const response = await api.post<ApiResponse>(`/products/${id}/share`, {
      franchiseIds,
    });
    return response;
  },
  transferStock: async (
    id: string,
    payload: { toFranchiseId: string; quantity: number; note?: string }
  ) => {
    const response = await api.post<ApiResponse<Product>>(`/products/${id}/transfer`, payload);
    return response;
  },
  getAnalytics: async (franchiseId: string, period: string = 'month') => {
    const response = await api.get(`/products/franchise/${franchiseId}/analytics`, {
      params: { period },
    });
    return response;
  },
  import: async (formData: FormData) => {
    const response = await api.post('/products/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response;
  },
};

export const transferApi = {
  /** Pass franchise so backend returns only transfers where outlet is source or destination. */
  getAll: async (params?: { franchise?: string; [key: string]: any }) => api.get('/transfers', { params }),
  getById: async (id: string) => api.get(`/transfers/${id}`),
  create: async (data: any) => api.post('/transfers', data),
  update: async (id: string, data: any) => api.put(`/transfers/${id}`, data),
  approve: async (id: string) => api.post(`/transfers/${id}/approve`),
  reject: async (id: string, reason?: string) => api.post(`/transfers/${id}/reject`, { reason }),
  complete: async (id: string) => api.post(`/transfers/${id}/complete`),
  cancel: async (id: string, reason?: string) => api.post(`/transfers/${id}/cancel`, { reason }),
  getStatistics: async (franchiseId: string, period: string = 'month') =>
    api.get(`/transfers/statistics/${franchiseId}`, { params: { period } }),
  getAdminOverview: async (timeRange: string) =>
    api.get<AdminTransfersOverview>('/transfers/admin/overview', { params: { timeRange } }),
};

export const saleApi = {
  /**
   * Get sales. For franchise-scoped views always pass franchise so the backend filters by outlet.
   * Backend filters sales by franchise when franchise is provided; no frontend filtering.
   */
  getAll: async (params?: {
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
    type?: 'online' | 'offline';
    paymentMethod?: string;
    status?: string;
    franchise?: string;
  }): Promise<{ sales: Sale[]; total: number; summary?: { totalRevenue: number; totalProfit: number; totalSales: number; avgOrderValue: number } }> => {
    return api.get('/sales', { params }) as Promise<{ sales: Sale[]; total: number; summary?: { totalRevenue: number; totalProfit: number; totalSales: number; avgOrderValue: number } }>;
  },

  create: async (sale: {
    franchise: string;
    items: Array<{ product: string; sku: string; name: string; quantity: number; buyingPrice: number; sellingPrice: number; discount: number; tax: number; profit: number }>;
    customerName?: string;
    customerEmail?: string;
    paymentMethod: Sale['paymentMethod'];
    saleType: Sale['saleType'];
    notes?: string;
    total?: number;
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

  import: async (formData: FormData) => {
    const response = await api.post('/sales/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response;
  },
};

export const orderApi = {
  getOrders: async (params?: {
    page?: number;
    limit?: number;
    franchise?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ orders: unknown[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> => {
    return api.get('/orders', { params }) as Promise<{ orders: unknown[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>;
  },
  getById: async (id: string) => api.get(`/orders/${id}`),
  create: async (payload: unknown) => api.post('/orders', payload),
  update: async (id: string, payload: unknown) => api.put(`/orders/${id}`, payload),
  delete: async (id: string) => api.delete(`/orders/${id}`),
  updateStatus: async (id: string, orderStatus: string) =>
    api.patch(`/orders/${id}/status`, { orderStatus }),
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

  getAdminDashboard: async () => {
    return api.get<{
      totalFranchises: number;
      totalProducts: number;
      totalRevenue: number;
      totalProfit: number;
      totalOrders: number;
      pendingOrders: number;
      lowStockCount: number;
      todayRevenue: number;
      todayProfit: number;
      todaySales: number;
      revenueTrend: Array<{
        date: string;
        revenue: number;
        profit: number;
        sales: number;
      }>;
      franchisePerformance: Array<{
        franchiseId: string;
        franchiseName: string;
        franchiseCode: string;
        totalRevenue: number;
        totalProfit: number;
        totalSales: number;
        avgOrderValue: number;
        profitMargin: number;
      }>;
      orderStats: {
        total: number;
        pending: number;
        byStatus: Array<{
          status: string;
          count: number;
          totalRevenue: number;
        }>;
        recentOrders: Array<{
          _id: string;
          orderNumber: string;
          orderStatus: string;
          customerName: string;
          grandTotal: number;
          createdAt: string;
        }>;
      };
      categoryBreakdown: Array<{
        category: string;
        revenue: number;
        cost: number;
        profit: number;
        quantitySold: number;
        profitMargin: number;
      }>;
    }>('/dashboard/admin');
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

  getFranchiseProfitLoss: async (params: {
    franchise: string;
    startDate?: string;
    endDate?: string;
  }) => {
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

export const notificationApi = {
  getAll: async (params?: {
    limit?: number;
    offset?: number;
    unreadOnly?: boolean;
    type?: string;
    category?: string;
  }) => {
    return api.get<{
      notifications: Array<{
        _id: string;
        title: string;
        message: string;
        type: string;
        category: string;
        isRead: boolean;
        readAt: string | null;
        link: string | null;
        metadata: Record<string, unknown>;
        priority: string;
        createdAt: string;
        updatedAt: string;
      }>;
      pagination: {
        total: number;
        limit: number;
        offset: number;
        hasMore: boolean;
      };
      unreadCount: number;
    }>('/notifications', { params });
  },

  markAsRead: async (id: string) => {
    return api.patch<{
      notification: {
        _id: string;
        isRead: boolean;
        readAt: string | null;
      };
      unreadCount: number;
    }>(`/notifications/${id}/read`);
  },

  markAllAsRead: async () => {
    return api.patch<{
      updatedCount: number;
    }>('/notifications/read-all');
  },

  delete: async (id: string) => {
    return api.delete(`/notifications/${id}`);
  },
};

export default api;












// services/api.ts - Extended version
// import axios from 'axios';

// const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5002/api';

// const api = axios.create({
//   baseURL: API_URL,
//   headers: {
//     'Content-Type': 'application/json',
//   },
// });

// // Add auth token to requests
// api.interceptors.request.use((config) => {
//   const token = localStorage.getItem('token');
//   if (token) {
//     config.headers.Authorization = `Bearer ${token}`;
//   }
//   return config;
// });

// // Response interceptor for error handling
// api.interceptors.response.use(
//   (response) => response,
//   (error) => {
//     if (error.response?.status === 401) {
//       localStorage.removeItem('token');
//       window.location.href = '/login';
//     }
//     return Promise.reject(error);
//   }
// );

// // Franchise API
// export const franchiseApi = {
//   // ... existing franchise methods ...

//   getSettings: async (id: string) => {
//     const response = await api.get(`/franchises/${id}/settings`);
//     return response.data;
//   },

//   updateSettings: async (id: string, data: any) => {
//     const response = await api.put(`/franchises/${id}/settings`, data);
//     return response.data;
//   },

//   getStaff: async (id: string) => {
//     const response = await api.get(`/franchises/${id}/staff`);
//     return response.data;
//   },

//   getActivityLog: async (id: string, params?: any) => {
//     const response = await api.get(`/franchises/${id}/activity`, { params });
//     return response.data;
//   }
// };

// // Product API (extended)
// export const productApi = {
//   // ... existing product methods ...

//   getAnalytics: async (franchiseId: string, period: string = 'month') => {
//     const response = await api.get(`/products/franchise/${franchiseId}/analytics`, {
//       params: { period }
//     });
//     return response.data;
//   },

//   bulkUpdate: async (franchiseId: string, updates: any[]) => {
//     const response = await api.post('/products/bulk-update', {
//       franchiseId,
//       updates
//     });
//     return response.data;
//   },

//   importProducts: async (franchiseId: string, file: File) => {
//     const formData = new FormData();
//     formData.append('file', file);
//     formData.append('franchiseId', franchiseId);

//     const response = await api.post('/products/import', formData, {
//       headers: {
//         'Content-Type': 'multipart/form-data'
//       }
//     });
//     return response.data;
//   },

//   exportProducts: async (franchiseId: string, format: 'csv' | 'excel' = 'csv') => {
//     const response = await api.get(`/products/export/${franchiseId}`, {
//       params: { format },
//       responseType: 'blob'
//     });
//     return response.data;
//   }
// };

// // Transfer API
// export const transferApi = {
//   getAll: async (params?: any) => {
//     const response = await api.get('/transfers', { params });
//     return response.data;
//   },

//   getById: async (id: string) => {
//     const response = await api.get(`/transfers/${id}`);
//     return response.data;
//   },

//   create: async (data: any) => {
//     const response = await api.post('/transfers', data);
//     return response.data;
//   },

//   update: async (id: string, data: any) => {
//     const response = await api.put(`/transfers/${id}`, data);
//     return response.data;
//   },

//   approve: async (id: string) => {
//     const response = await api.post(`/transfers/${id}/approve`);
//     return response.data;
//   },

//   reject: async (id: string, reason?: string) => {
//     const response = await api.post(`/transfers/${id}/reject`, { reason });
//     return response.data;
//   },

//   complete: async (id: string) => {
//     const response = await api.post(`/transfers/${id}/complete`);
//     return response.data;
//   },

//   cancel: async (id: string, reason?: string) => {
//     const response = await api.post(`/transfers/${id}/cancel`, { reason });
//     return response.data;
//   },

//   getStatistics: async (franchiseId: string, period: string = 'month') => {
//     const response = await api.get(`/transfers/statistics/${franchiseId}`, {
//       params: { period }
//     });
//     return response.data;
//   }
// };

// // Analytics API
// export const analyticsApi = {
//   getNetworkOverview: async () => {
//     const response = await api.get('/analytics/network/overview');
//     return response.data;
//   },

//   getFranchiseComparison: async (metric: string, period: string = 'month') => {
//     const response = await api.get('/analytics/franchises/comparison', {
//       params: { metric, period }
//     });
//     return response.data;
//   },

//   getProductPerformance: async (params?: any) => {
//     const response = await api.get('/analytics/products/performance', { params });
//     return response.data;
//   },

//   getSalesTrends: async (franchiseId?: string, period: string = 'month') => {
//     const response = await api.get('/analytics/sales/trends', {
//       params: { franchise: franchiseId, period }
//     });
//     return response.data;
//   },

//   getInventoryHealth: async (franchiseId?: string) => {
//     const response = await api.get('/analytics/inventory/health', {
//       params: { franchise: franchiseId }
//     });
//     return response.data;
//   }
// };

// // Dashboard API
// export const dashboardApi = {
//   getFranchiseDashboard: async (franchiseId: string) => {
//     const response = await api.get(`/dashboard/franchise/${franchiseId}`);
//     return response.data;
//   },

//   getNetworkDashboard: async () => {
//     const response = await api.get('/dashboard/network');
//     return response.data;
//   },

//   getQuickStats: async (franchiseId?: string) => {
//     const response = await api.get('/dashboard/quick-stats', {
//       params: { franchise: franchiseId }
//     });
//     return response.data;
//   },

//   getRecentActivity: async (franchiseId?: string, limit: number = 10) => {
//     const response = await api.get('/dashboard/recent-activity', {
//       params: { franchise: franchiseId, limit }
//     });
//     return response.data;
//   }
// };

// export default api;