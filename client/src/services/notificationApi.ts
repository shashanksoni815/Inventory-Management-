import { api } from './api';

export interface Notification {
  _id: string;
  title: string;
  message: string;
  type: 'inventory' | 'order' | 'sale' | 'user' | 'franchise' | 'system';
  priority: 'low' | 'medium' | 'high';
  franchise?: { _id: string; name: string; code: string } | null;
  user?: string | null;
  read: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GetAllResponse {
  notifications: Notification[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
  unreadCount: number;
}

export interface MarkAsReadResponse {
  notification: Notification;
  unreadCount: number;
}

/**
 * Get all notifications (respects role: admin sees all, manager/sales see their franchise)
 */
export const getAll = async (params?: {
  unread?: boolean;
  unreadOnly?: boolean;
  read?: boolean;
  type?: string;
  limit?: number;
  page?: number;
}): Promise<GetAllResponse> => {
  const { unreadOnly, ...rest } = params ?? {};
  const query: Record<string, unknown> = { ...rest };
  if (unreadOnly !== undefined) query.unread = unreadOnly;
  if (rest.read !== undefined) query.read = rest.read;
  return api.get('/notifications', { params: query }) as Promise<GetAllResponse>;
};

/**
 * Mark a notification as read
 */
export const markAsRead = async (id: string): Promise<MarkAsReadResponse> => {
  return api.patch(`/notifications/${id}/read`) as Promise<MarkAsReadResponse>;
};

/**
 * Delete a notification (admin or manager only)
 */
export const deleteNotification = async (id: string): Promise<{ message: string }> => {
  return api.delete(`/notifications/${id}`) as Promise<{ message: string }>;
};

/**
 * Mark all notifications as read
 */
export const markAllAsRead = async (): Promise<{ updatedCount: number; unreadCount: number }> => {
  return api.patch('/notifications/read-all') as Promise<{
    updatedCount: number;
    unreadCount: number;
  }>;
};

/**
 * Delete all notifications (admin only)
 */
export const deleteAll = async (): Promise<{ deletedCount: number }> => {
  const res = await api.delete<{ deletedCount: number }>('/notifications/all');
  return res as unknown as Promise<{ deletedCount: number }>;
};

/** Notification API - use existing axios instance (api) */
export const notificationApi = {
  getAll,
  markAsRead,
  markAllAsRead,
  delete: deleteNotification,
  deleteAll,
};
