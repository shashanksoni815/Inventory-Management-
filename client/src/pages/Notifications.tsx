import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Filter,
  Package,
  ShoppingCart,
  Store,
  User,
  Info,
  CheckCircle,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationApi } from '@/services/api';
import type { Notification } from '@/services/notificationApi';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import LoadingSpinner from '@/components/Common/LoadingSpinner';
import { showToast } from '@/services/toast';

const TYPES = [
  { value: '', label: 'All types' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'order', label: 'Order' },
  { value: 'sale', label: 'Sale' },
  { value: 'user', label: 'User' },
  { value: 'franchise', label: 'Franchise' },
  { value: 'system', label: 'System' },
];

const READ_FILTERS = [
  { value: '', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'read', label: 'Read' },
];

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
  return date.toLocaleDateString();
}

function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'high':
      return 'bg-red-100 text-red-700 border-red-200';
    case 'medium':
      return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'low':
      return 'bg-blue-100 text-blue-700 border-blue-200';
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200';
  }
}

function getNotificationIcon(type: string) {
  switch (type) {
    case 'order':
      return ShoppingCart;
    case 'sale':
      return CheckCircle;
    case 'inventory':
      return Package;
    case 'franchise':
      return Store;
    case 'user':
      return User;
    default:
      return Info;
  }
}

const Notifications: React.FC = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState('');
  const [readFilter, setReadFilter] = useState('');

  const limit = 20;

  const { data, isPending, error, refetch } = useQuery({
    queryKey: ['notifications', 'page', page, typeFilter, readFilter],
    queryFn: () =>
      notificationApi.getAll({
        limit,
        page,
        type: typeFilter || undefined,
        unread: readFilter === 'unread' ? true : undefined,
        read: readFilter === 'read' ? true : undefined,
      }),
    staleTime: 15 * 1000,
  });

  const markAsReadMutation = useMutation({
    mutationFn: (id: string) => notificationApi.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (err: { message?: string }) => {
      showToast.error(err?.message ?? 'Failed to mark as read');
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: () => notificationApi.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      showToast.success('All notifications marked as read');
    },
    onError: (err: { message?: string }) => {
      showToast.error(err?.message ?? 'Failed to mark all as read');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => notificationApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      showToast.success('Notification deleted');
    },
    onError: (err: { message?: string }) => {
      showToast.error(err?.message ?? 'Failed to delete');
    },
  });

  const deleteAllMutation = useMutation({
    mutationFn: () => notificationApi.deleteAll(),
    onSuccess: (res: { deletedCount?: number } | unknown) => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      const count = (res && typeof res === 'object' && 'deletedCount' in res)
        ? (res as { deletedCount: number }).deletedCount
        : 0;
      showToast.success(`${count} notifications deleted`);
    },
    onError: (err: { message?: string }) => {
      showToast.error(err?.message ?? 'Failed to delete all');
    },
  });

  const notifications: Notification[] = data?.notifications ?? [];
  const pagination = data?.pagination ?? { page: 1, limit: 20, total: 0, pages: 1 };
  const unreadCount = data?.unreadCount ?? 0;

  return (
    <div className="min-h-0 bg-white p-3 sm:p-4 lg:p-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Notifications</h1>
            <p className="text-sm text-gray-500 mt-1">
              {unreadCount > 0
                ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`
                : 'All caught up'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={() => markAllAsReadMutation.mutate()}
                disabled={markAllAsReadMutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                <CheckCheck className="h-4 w-4" />
                Mark all as read
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => {
                  if (window.confirm('Delete all notifications? This cannot be undone.')) {
                    deleteAllMutation.mutate();
                  }
                }}
                disabled={deleteAllMutation.isPending || notifications.length === 0}
                className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="h-4 w-4" />
                Delete all
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Filters:</span>
          </div>
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            {TYPES.map((t) => (
              <option key={t.value || 'all'} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <select
            value={readFilter}
            onChange={(e) => {
              setReadFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            {READ_FILTERS.map((f) => (
              <option key={f.value || 'all'} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        {/* List */}
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          {isPending ? (
            <div className="flex items-center justify-center py-16">
              <LoadingSpinner />
            </div>
          ) : error ? (
            <div className="p-8 text-center text-red-600">
              <p>Failed to load notifications.</p>
              <button
                onClick={() => refetch()}
                className="mt-2 text-sm text-blue-600 hover:underline"
              >
                Retry
              </button>
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <Bell className="h-12 w-12 mx-auto mb-3 text-gray-400" />
              <p className="text-sm">No notifications</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {notifications.map((n) => {
                const Icon = getNotificationIcon(n.type);
                const priorityColor = getPriorityColor(n.priority ?? 'medium');
                return (
                  <li
                    key={n._id}
                    className={cn(
                      'relative flex items-start gap-4 p-4 transition-colors',
                      n.read ? 'bg-white hover:bg-gray-50' : 'bg-blue-50/50 hover:bg-blue-50'
                    )}
                  >
                    <div
                      className={cn(
                        'absolute left-0 top-0 bottom-0 w-1 rounded-l-lg',
                        n.priority === 'high' && 'bg-red-500',
                        n.priority === 'medium' && 'bg-amber-500',
                        n.priority === 'low' && 'bg-blue-500',
                        !n.priority && 'bg-gray-300'
                      )}
                    />
                    <div
                      className={cn(
                        'shrink-0 rounded-lg p-2 border',
                        priorityColor
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p
                            className={cn(
                              'text-sm font-medium text-gray-900',
                              !n.read && 'font-semibold'
                            )}
                          >
                            {n.title}
                          </p>
                          <p className="text-sm text-gray-600 mt-1">{n.message}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            {timeAgo(n.createdAt)} • {n.type} • {n.priority}
                          </p>
                        </div>
                        {!n.read && (
                          <div className="h-2 w-2 shrink-0 rounded-full bg-blue-600 mt-1.5" />
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {!n.read && (
                        <button
                          onClick={() => markAsReadMutation.mutate(n._id)}
                          disabled={markAsReadMutation.isPending}
                          className="rounded-lg p-2 text-gray-500 hover:bg-gray-200"
                          title="Mark as read"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                      )}
                      {(isAdmin || user?.role === 'manager') && (
                        <button
                          onClick={() => deleteMutation.mutate(n._id)}
                          disabled={deleteMutation.isPending}
                          className="rounded-lg p-2 text-gray-500 hover:bg-red-100 hover:text-red-600"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
              <p className="text-sm text-gray-500">
                Page {pagination.page} of {pagination.pages} • {pagination.total} total
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={pagination.page <= 1}
                  className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm text-gray-700">
                  {pagination.page} / {pagination.pages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                  disabled={pagination.page >= pagination.pages}
                  className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default Notifications;
