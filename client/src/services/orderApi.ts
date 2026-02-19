import { api } from './api';

export interface GetOrdersParams {
  franchise?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface OrdersListResponse {
  orders: unknown[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const orderApi = {
  getAll: async (params?: GetOrdersParams): Promise<OrdersListResponse> => {
    return api.get('/orders', { params }) as Promise<OrdersListResponse>;
  },
  getById: async (id: string): Promise<any> => {
    return api.get(`/orders/${id}`);
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/orders/${id}`);
  },
  importOrders: async (formData: FormData): Promise<any> => {
    const response = await api.post('/orders/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response;
  },
};

