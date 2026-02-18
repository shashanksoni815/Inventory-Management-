/**
 * Orders – list of online orders from backend APIs.
 * Route: /orders
 * Table: Order #, Date, Customer, Payment Method, Order Status, Total Amount, Actions (View)
 * Filters: status, date range, search (Order # / Customer)
 */
import React, { useState, useCallback, useMemo } from 'react';
import { subDays } from 'date-fns';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ShoppingBag,
  Filter,
  RefreshCw,
  Search,
  Eye,
  ChevronLeft,
  ChevronRight,
  Plus,
  Upload,
  Download,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DateRangePicker } from '@/components/Common/DateRangePicker';
import { orderApi } from '@/services/orderApi';
import { apiBaseURL } from '@/services/api';
import { useFranchise } from '@/contexts/FranchiseContext';
import { cn, formatCurrency, formatDate, orderStatusBadgeClass } from '@/lib/utils';
import type { UserRole } from '@/types';
import LoadingSpinner from '@/components/Common/LoadingSpinner';
import { showToast } from '@/services/toast';

const ORDER_STATUSES = [
  { value: '', label: 'All statuses' },
  { value: 'Pending', label: 'Pending' },
  { value: 'Confirmed', label: 'Confirmed' },
  { value: 'Packed', label: 'Packed' },
  { value: 'Shipped', label: 'Shipped' },
  { value: 'Delivered', label: 'Delivered' },
  { value: 'Cancelled', label: 'Cancelled' },
];

interface OrderRow {
  _id: string;
  orderNumber: string;
  createdAt: string;
  customer: { name: string; phone?: string; email?: string };
  payment: { method: string; status: string };
  orderStatus: string;
  totals: { grandTotal: number };
  franchise?: { name?: string; code?: string };
}

const OrdersSkeleton: React.FC = () => (
  <div className="min-h-0 bg-gray-50 p-3 sm:p-4 lg:p-6">
    <div className="mb-4 sm:mb-6 lg:mb-8 h-10 w-40 bg-gray-200 rounded animate-pulse" />
    <div className="mb-4 h-20 bg-gray-200 rounded-xl animate-pulse" />
    <div className="h-64 bg-gray-200 rounded-xl animate-pulse" />
  </div>
);

const ErrorState: React.FC<{ message: string; onRetry?: () => void }> = ({
  message,
  onRetry,
}) => (
  <div className="min-h-0 bg-gray-50 p-3 sm:p-4 lg:p-6">
    <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-red-800">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  </div>
);

const EmptyState: React.FC<{ message: string }> = ({ message }) => (
  <div className="min-h-0 bg-gray-50 p-3 sm:p-4 lg:p-6">
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-12 text-center text-sm text-gray-500">
      <ShoppingBag className="mx-auto mb-2 h-10 w-10 text-gray-300" />
      {message}
    </div>
  </div>
);

const Orders: React.FC = () => {
  const queryClient = useQueryClient();
  const { currentFranchise, franchises } = useFranchise();
  const [dateRange, setDateRange] = useState({
    startDate: subDays(new Date(), 30),
    endDate: new Date(),
  });
  const [statusFilter, setStatusFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [franchiseFilter, setFranchiseFilter] = useState<string>('');
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  const ordersFileRef = React.useRef<HTMLInputElement>(null);

  const userRole: UserRole | null = useMemo(() => {
    try {
      const raw = localStorage.getItem('user');
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { role?: UserRole };
      return parsed.role ?? null;
    } catch {
      return null;
    }
  }, []);

  const isAdminUser = userRole === 'superAdmin' || userRole === 'admin';
  const isStaff = userRole === 'staff';
  const limit = 20;

  const effectiveFranchiseId =
    isAdminUser && franchiseFilter
      ? franchiseFilter
      : currentFranchise?._id || currentFranchise?.id;

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['orders', effectiveFranchiseId, dateRange, statusFilter, search, page, limit],
    queryFn: () =>
      orderApi.getAll({
        franchise: effectiveFranchiseId,
        startDate: dateRange.startDate.toISOString(),
        endDate: dateRange.endDate.toISOString(),
        status: statusFilter || undefined,
        search: search || undefined,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        page,
        limit,
      }),
    retry: 1,
    staleTime: 30 * 1000, // 30 seconds - orders update frequently
    refetchOnWindowFocus: false,
  });

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const applySearch = useCallback(() => {
    setSearch(searchInput.trim());
    setPage(1);
  }, [searchInput]);

  const orders = (data?.orders ?? []) as OrderRow[];
  const pagination = data?.pagination ?? { page: 1, limit: 20, total: 0, totalPages: 0 };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await orderApi.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  const handleDelete = useCallback(
    async (order: OrderRow) => {
      if (isStaff) {
        window.alert('You do not have permission to delete orders.');
        return;
      }
      if (order.orderStatus === 'Delivered') {
        window.alert('Delivered orders cannot be deleted.');
        return;
      }
      const ok = window.confirm(
        `Are you sure you want to delete order ${order.orderNumber}? This is a soft delete and cannot be undone from the UI.`
      );
      if (!ok) return;
      deleteMutation.mutate(order._id);
    },
    [deleteMutation, isStaff]
  );

  const handleExport = useCallback(
    async (format: 'excel' | 'pdf') => {
      try {
        const params = new URLSearchParams();
        params.append('startDate', dateRange.startDate.toISOString());
        params.append('endDate', dateRange.endDate.toISOString());
        if (statusFilter) params.append('status', statusFilter);
        if (effectiveFranchiseId) params.append('franchise', effectiveFranchiseId);
        params.append('format', format === 'excel' ? 'excel' : 'pdf');

        const token = localStorage.getItem('token');
        const response = await fetch(`${apiBaseURL}/orders/export?${params.toString()}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (!response.ok) {
          if (response.status === 403) {
            const errData = await response.json().catch(() => ({}));
            showToast.error(
              errData?.message ||
                'Access denied: You do not have permission to export orders for this franchise'
            );
            return;
          }
          throw new Error('Export failed');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const extension = format === 'excel' ? 'xlsx' : 'pdf';
        const start = dateRange.startDate.toISOString().slice(0, 10);
        const end = dateRange.endDate.toISOString().slice(0, 10);
        link.download = `orders-${start}_to_${end}.${extension}`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);

        showToast.success(`Orders exported successfully as ${format.toUpperCase()}.`);
      } catch (err) {
        console.error('Orders export error:', err);
        showToast.error('Failed to export orders. Please try again.');
      } finally {
        setExportMenuOpen(false);
      }
    },
    [dateRange, statusFilter, effectiveFranchiseId]
  );

  const handleImportClick = useCallback(() => {
    if (isStaff) {
      window.alert('You do not have permission to import orders.');
      return;
    }
    ordersFileRef.current?.click();
  }, [isStaff]);

  const handleOrdersImport = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      try {
        const file = e.target.files?.[0];
        if (!file) return;

        const validTypes = [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          'text/csv',
        ];
        const validExtensions = ['.xlsx', '.xls', '.csv'];
        const isValidType =
          validTypes.includes(file.type) ||
          validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext));

        if (!isValidType) {
          showToast.error('Please select a valid Excel or CSV file (.xlsx, .xls, or .csv)');
          if (ordersFileRef.current) {
            ordersFileRef.current.value = '';
          }
          return;
        }

        if (file.size > 10 * 1024 * 1024) {
          showToast.error('File size exceeds 10MB limit. Please select a smaller file.');
          if (ordersFileRef.current) {
            ordersFileRef.current.value = '';
          }
          return;
        }

        const formData = new FormData();
        formData.append('file', file);

        const loadingToast = showToast.loading('Uploading orders file... Please wait.');

        const result = await orderApi.importOrders(formData);

        showToast.dismiss(loadingToast);

        const importData = result as any;
        const successMessage =
          importData?.failedRows > 0
            ? `Import completed with ${importData.successfulRows || 0} successful, ${importData.failedRows || 0} failed`
            : `Import successful! ${importData.successfulRows || 0} orders imported`;

        showToast.success(successMessage);

        queryClient.invalidateQueries({ queryKey: ['orders'] });
        refetch();

        if (ordersFileRef.current) {
          ordersFileRef.current.value = '';
        }
      } catch (error: any) {
        console.error('Orders import failed', error);
        let errorMessage = 'Failed to import orders. Please try again.';

        if (error?.response?.data?.message) {
          errorMessage = error.response.data.message;
        } else if (error?.response?.data?.error) {
          errorMessage = error.response.data.error;
        } else if (error?.message) {
          errorMessage = error.message;
        }

        showToast.error(errorMessage);

        if (ordersFileRef.current) {
          ordersFileRef.current.value = '';
        }
      }
    },
    [queryClient, refetch]
  );

  // Loading state
  if (isLoading) {
    return <OrdersSkeleton />;
  }

  // Error state
  if (isError) {
    const message =
      error && typeof error === 'object' && 'message' in error
        ? String((error as { message: string }).message)
        : 'Failed to load orders.';
    return <ErrorState message={message} onRetry={() => refetch()} />;
  }

  // Empty state
  if (!orders.length) {
    return (
      <div className="min-h-0 bg-gray-50 p-3 sm:p-4 lg:p-6">
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-12 text-center">
          <ShoppingBag className="mx-auto mb-3 h-10 w-10 text-gray-300" />
          <h2 className="text-base font-semibold text-gray-900 mb-1">
            No orders found
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            When you create orders, they will appear here.
          </p>
          {!isStaff && (
            <Link
              to="/orders/new"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Create First Order
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-0 bg-gray-50 p-3 sm:p-4 lg:p-6">
      <input
        ref={ordersFileRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={handleOrdersImport}
      />
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4 sm:mb-6 lg:mb-8"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Orders</h1>
            <p className="mt-1 text-sm text-gray-500">
              Track online orders: delivery address, payment details, products & status.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {!isStaff && (
              <Link
                to="/orders/new"
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                Add Order
              </Link>
            )}
            {!isStaff && (
              <button
                type="button"
                onClick={handleImportClick}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Upload className="h-4 w-4" />
                Import
              </button>
            )}
            <div className="relative">
              <button
                type="button"
                onClick={() => setExportMenuOpen((open) => !open)}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Download className="h-4 w-4" />
                Export
              </button>
              {exportMenuOpen && (
                <div className="absolute right-0 mt-1 w-32 rounded-md border border-gray-200 bg-white shadow-lg z-10">
                  <button
                    type="button"
                    onClick={() => handleExport('excel')}
                    className="block w-full px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50"
                  >
                    Excel (.xlsx)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExport('pdf')}
                    className="block w-full px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50"
                  >
                    PDF
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={handleRefresh}
              type="button"
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="mb-6 rounded-xl border border-gray-200 bg-white p-4"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-700">Filters</span>
            </div>
            <DateRangePicker value={dateRange} onChange={setDateRange} />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
            >
              {ORDER_STATUSES.map((opt) => (
                <option key={opt.value || 'all'} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isAdminUser && (
              <select
                value={franchiseFilter}
                onChange={(e) => {
                  setFranchiseFilter(e.target.value);
                  setPage(1);
                }}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              >
                <option value="">All franchises</option>
                {franchises.map((f) => (
                  <option key={f._id || f.id} value={f._id || f.id}>
                    {f.name} {f.code ? `(${f.code})` : ''}
                  </option>
                ))}
              </select>
            )}
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                placeholder="Order # or customer..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applySearch()}
                className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <button
              onClick={applySearch}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Search
            </button>
          </div>
        </div>
      </motion.div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="rounded-xl border border-gray-200 bg-white overflow-hidden"
      >
        <>
            <div className="overflow-x-auto -mx-px" aria-label="Orders table">
              <table className="w-full min-w-[640px] divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Order #
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Date
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Customer
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Franchise
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Payment
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Order Status
                    </th>
                    <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Total
                    </th>
                    <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {orders.map((order) => (
                      <tr key={order._id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                          {order.orderNumber}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                          {formatDate(order.createdAt, 'medium')}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          <span className="font-medium text-gray-900">{order.customer?.name ?? '—'}</span>
                          {order.customer?.phone && (
                            <span className="block text-xs text-gray-500">{order.customer.phone}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {order.franchise?.name || order.franchise?.code ? (
                            <>
                              <span className="font-medium text-gray-900">
                                {order.franchise?.name ?? '—'}
                              </span>
                              {order.franchise?.code && (
                                <span className="block text-xs text-gray-500">
                                  {order.franchise.code}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          <span>{order.payment?.method ?? '—'}</span>
                          <span className={cn('ml-1 text-xs', order.payment?.status === 'Paid' ? 'text-green-600' : 'text-amber-600')}>
                            ({order.payment?.status ?? '—'})
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium',
                              orderStatusBadgeClass(order.orderStatus)
                            )}
                          >
                            {order.orderStatus}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-gray-900 whitespace-nowrap">
                          {formatCurrency(order.totals?.grandTotal ?? 0)}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap space-x-2">
                          <Link
                            to={`/orders/${order._id}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                          >
                            <Eye className="h-4 w-4" />
                            View
                          </Link>
                          {!isStaff && (
                            <>
                              <Link
                                to={`/orders/${order._id}/edit`}
                                className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                              >
                                Edit
                              </Link>
                              <button
                                type="button"
                                onClick={() => handleDelete(order)}
                                disabled={order.orderStatus === 'Delivered' || deleteMutation.isLoading}
                                className="inline-flex items-center gap-1 rounded-lg border border-red-300 bg-white px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-60 disabled:cursor-not-allowed"
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50/50 px-4 py-3">
                <p className="text-sm text-gray-600">
                  Showing {(pagination.page - 1) * pagination.limit + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={pagination.page <= 1}
                    className="rounded-lg border border-gray-300 bg-white p-2 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-sm text-gray-600">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                    disabled={pagination.page >= pagination.totalPages}
                    className="rounded-lg border border-gray-300 bg-white p-2 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
      </motion.div>
    </div>
  );
};

export default Orders;
