import React, { useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Plus,
  Filter,
  Download,
  Upload,
  RefreshCw,
  ShoppingCart,
  Store,
  CreditCard,
  Banknote,
  Receipt,
  TrendingUp,
  BarChart3,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DateRangePicker } from '@/components/Common/DateRangePicker';
import { saleApi } from '@/services/api';
import { useFranchise } from '@/contexts/FranchiseContext';
import type { Sale } from '@/types';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import NewSaleModal from '@/components/Sales/NewSaleModal';
import { showToast } from '@/services/toast';

const Sales: React.FC = () => {
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    endDate: new Date(),
  });
  const [filters, setFilters] = useState({
    type: 'all',
    paymentMethod: 'all',
    status: 'completed',
  });
  const [showNewSale, setShowNewSale] = useState(false);

  const queryClient = useQueryClient();
  const { currentFranchise } = useFranchise();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['sales', dateRange, filters],
    queryFn: async () => {
      const result = await saleApi.getAll({
        startDate: dateRange.startDate.toISOString(),
        endDate: dateRange.endDate.toISOString(),
        type: filters.type !== 'all' ? (filters.type as 'online' | 'offline') : undefined,
        paymentMethod: filters.paymentMethod !== 'all' ? filters.paymentMethod : undefined,
        status: filters.status,
        page: 1,
        limit: 50,
      });
      return result;
    },
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleExport = useCallback(async (format: 'excel' | 'pdf' = 'excel') => {
    try {
      const params = new URLSearchParams();
      params.append('startDate', dateRange.startDate.toISOString());
      params.append('endDate', dateRange.endDate.toISOString());
      params.append('format', format);
      if (filters.type !== 'all') params.append('type', filters.type);
      if (filters.paymentMethod !== 'all') params.append('paymentMethod', filters.paymentMethod);

      const response = await fetch(`/api/sales/export?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        if (response.status === 403) {
          const errorData = await response.json().catch(() => ({}));
          showToast.error(errorData.message || 'Access denied: You do not have permission to export sales from this franchise');
          return;
        }
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const extension = format === 'excel' ? 'xlsx' : 'pdf';
      link.download = `sales-${dateRange.startDate.toISOString().slice(0, 10)}_to_${dateRange.endDate.toISOString().slice(0, 10)}.${extension}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      showToast.success(`Sales exported successfully as ${format.toUpperCase()}.`);
    } catch (error) {
      console.error('Export error:', error);
      showToast.error(error instanceof Error ? error.message : 'Failed to export sales. Please try again.');
    }
  }, [dateRange, filters]);

  const salesFileRef = React.useRef<HTMLInputElement>(null);

  const handleImport = useCallback(() => {
    // Trigger file picker using native input element (avoids browser extension interference)
    salesFileRef.current?.click();
  }, []);

  const handleSalesImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = e.target.files?.[0];
      if (!file) return;

      // Validate file type
      const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'text/csv',
      ];
      const validExtensions = ['.xlsx', '.xls', '.csv'];
      const isValidType = validTypes.includes(file.type) || 
                         validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));

      if (!isValidType) {
        showToast.error('Please select a valid Excel or CSV file (.xlsx, .xls, or .csv)');
        // Reset input
        if (salesFileRef.current) {
          salesFileRef.current.value = '';
        }
        return;
      }

      // Validate file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        showToast.error('File size exceeds 10MB limit. Please select a smaller file.');
        // Reset input
        if (salesFileRef.current) {
          salesFileRef.current.value = '';
        }
        return;
      }

      // Create FormData
      const formData = new FormData();
      formData.append('file', file);
      
      // Add franchise ID if available from context
      if (currentFranchise?._id || currentFranchise?.id) {
        const franchiseId = currentFranchise._id || currentFranchise.id;
        formData.append('franchise', franchiseId);
      }

      // Show loading state
      const loadingToast = showToast.loading('Uploading file... Please wait.');

      // Call import API using saleApi
      const result = await saleApi.import(formData);

      // Dismiss loading toast
      showToast.dismiss(loadingToast);

      // Success - result is already unwrapped by axios interceptor
      const importData = result as any;
      
      // Show success toast with detailed information
      const successMessage = importData?.failedSales > 0 || importData?.failedRows > 0
        ? `Import completed with ${importData.successfulSales || importData.successfulRows || 0} successful, ${importData.failedSales || importData.failedRows || 0} failed`
        : `Import successful! ${importData.successfulSales || importData.successfulRows || 0} sales imported`;
      
      showToast.success(successMessage);

      // Refresh sales list
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      refetch();

      // Reset input
      if (salesFileRef.current) {
        salesFileRef.current.value = '';
      }
    } catch (error: any) {
      console.error('Sales import failed', error);
      
      // Extract error message from various possible sources
      let errorMessage = 'Failed to import sales. Please try again.';
      
      if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error?.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      // Show validation error message
      showToast.error(errorMessage);
      
      // Reset input
      if (salesFileRef.current) {
        salesFileRef.current.value = '';
      }
    }
  }, [queryClient, refetch, currentFranchise]);

  const handleSaleCreated = useCallback(() => {
    // Refresh sales list and dashboard stats when a new sale is created
    queryClient.invalidateQueries({ queryKey: ['sales'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
  }, [queryClient]);

  const rawData = data && typeof data === 'object' && 'sales' in data ? data : null;
  const sales = Array.isArray(rawData?.sales) ? rawData.sales : [];
  const summaryObj = rawData?.summary && typeof rawData.summary === 'object' ? rawData.summary : null;
  const summary = {
    totalRevenue: Number(summaryObj?.totalRevenue) || 0,
    totalProfit: Number(summaryObj?.totalProfit) || 0,
    totalSales: Number(summaryObj?.totalSales) ?? 0,
    avgOrderValue: Number(summaryObj?.avgOrderValue) || 0,
  };

  const salesByType = useMemo(() => {
    const online = sales.filter((s: Sale) => s.saleType === 'online');
    const offline = sales.filter((s: Sale) => s.saleType === 'offline');
    return {
      online: {
        count: online.length,
        revenue: online.reduce((sum: number, s: Sale) => sum + s.grandTotal, 0),
        profit: online.reduce((sum: number, s: Sale) => sum + s.totalProfit, 0),
      },
      offline: {
        count: offline.length,
        revenue: offline.reduce((sum: number, s: Sale) => sum + s.grandTotal, 0),
        profit: offline.reduce((sum: number, s: Sale) => sum + s.totalProfit, 0),
      },
    };
  }, [sales]);

  const handleRefund = useCallback(async (saleId: string) => {
    if (confirm('Are you sure you want to process refund?')) {
      try {
        // Call refund API
        console.log('Processing refund for sale:', saleId);
      } catch (error) {
        console.error('Refund failed:', error);
      }
    }
  }, []);

  const handleInvoice = useCallback(async (saleId: string) => {
    try {
      const blob = await saleApi.getInvoice(saleId);
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (error) {
      console.error('Failed to generate invoice:', error);
    }
  }, []);

  return (
    <div className="min-h-0 bg-white p-3 sm:p-4 lg:p-6">
      {/* Hidden file input for import */}
      <input
        type="file"
        accept=".xlsx,.csv"
        ref={salesFileRef}
        className="hidden"
        onChange={handleSalesImport}
      />
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4 sm:mb-6 lg:mb-8"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Sales Management
            </h1>
            <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600">
              Track and manage all sales transactions
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button
              onClick={handleRefresh}
              className="flex items-center space-x-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Refresh</span>
            </button>
            <button
              onClick={handleImport}
              className="flex items-center space-x-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Upload className="h-4 w-4" />
              <span>Import</span>
            </button>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleExport('excel')}
                className="flex items-center space-x-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                title="Export to Excel"
              >
                <Download className="h-4 w-4" />
                <span>Excel</span>
              </button>
              <button
                onClick={() => handleExport('pdf')}
                className="flex items-center space-x-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                title="Export to PDF"
              >
                <Download className="h-4 w-4" />
                <span>PDF</span>
              </button>
            </div>
            <button
              onClick={() => setShowNewSale(true)}
              className="flex items-center space-x-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              <span>New Sale</span>
            </button>
          </div>
        </div>
      </motion.div>

      {/* Summary Cards - responsive */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="mb-6 lg:mb-8 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4"
      >
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Revenue</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">
                {formatCurrency(summary.totalRevenue)}
              </p>
            </div>
            <div className="rounded-lg bg-blue-100 p-3">
              <TrendingUp className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Avg Order</span>
              <span className="font-medium">{formatCurrency(summary.avgOrderValue)}</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Profit</p>
              <p className="mt-2 text-2xl font-bold text-green-600">
                {formatCurrency(summary.totalProfit)}
              </p>
            </div>
            <div className="rounded-lg bg-green-100 p-3">
              <BarChart3 className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Margin</span>
              <span className="font-medium">
                {summary.totalRevenue > 0
                  ? ((summary.totalProfit / summary.totalRevenue) * 100).toFixed(1)
                  : 0}%
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Online Sales</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">
                {salesByType.online.count}
              </p>
            </div>
            <div className="rounded-lg bg-purple-100 p-3">
              <ShoppingCart className="h-6 w-6 text-purple-600" />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Revenue</span>
              <span className="font-medium">{formatCurrency(salesByType.online.revenue)}</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Offline Sales</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">
                {salesByType.offline.count}
              </p>
            </div>
            <div className="rounded-lg bg-amber-100 p-3">
              <Store className="h-6 w-6 text-amber-600" />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Revenue</span>
              <span className="font-medium">{formatCurrency(salesByType.offline.revenue)}</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* API Error */}
      {isError && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-red-800">
              {error && typeof error === 'object' && 'message' in error
                ? String((error as { message: string }).message)
                : 'Failed to load sales. Ensure the backend is running on port 5002 and try again.'}
            </p>
            <button
              onClick={() => refetch()}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </motion.div>
      )}

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="mb-6 rounded-xl border border-gray-200 bg-white p-6"
      >
        <div className="flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-700">
                Filters:
              </span>
            </div>
            <div className="flex flex-wrap gap-3">
              <DateRangePicker
                value={dateRange}
                onChange={setDateRange}
              />
              <select
                value={filters.type}
                onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value }))}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm"
              >
                <option value="all">All Types</option>
                <option value="online">Online</option>
                <option value="offline">Offline</option>
              </select>
              <select
                value={filters.paymentMethod}
                onChange={(e) => setFilters(prev => ({ ...prev, paymentMethod: e.target.value }))}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm"
              >
                <option value="all">All Payments</option>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="upi">UPI</option>
                <option value="bank_transfer">Bank Transfer</option>
              </select>
              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm"
              >
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
                <option value="refunded">Refunded</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
          <button
            onClick={() => setFilters({
              type: 'all',
              paymentMethod: 'all',
              status: 'completed',
            })}
            className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200"
          >
            Clear Filters
          </button>
        </div>
      </motion.div>

      {/* Sales Table */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="rounded-xl border border-gray-200 bg-white"
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Invoice
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Payment
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Profit
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(9)].map((_, j) => (
                      <td key={j} className="px-6 py-4">
                        <div className="h-4 bg-gray-200 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : sales.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center">
                    <ShoppingCart className="mx-auto h-12 w-12 text-gray-300" />
                    <p className="mt-2 text-gray-500">
                      No sales found
                    </p>
                  </td>
                </tr>
              ) : (
                sales.map((sale: Sale, index: number) => (
                  <motion.tr
                    key={sale._id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="hover:bg-gray-50"
                  >
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="font-mono text-sm font-medium text-gray-900">
                        {sale.invoiceNumber}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {formatDate(sale.createdAt, 'short')}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatDate(sale.createdAt, 'relative')}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {sale.customerName || 'Walk-in Customer'}
                      </div>
                      {sale.customerEmail && (
                        <div className="text-xs text-gray-500">
                          {sale.customerEmail}
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                          sale.saleType === 'online'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-amber-100 text-amber-800'
                        )}
                      >
                        {sale.saleType === 'online' ? (
                          <>
                            <ShoppingCart className="mr-1 h-3 w-3" />
                            Online
                          </>
                        ) : (
                          <>
                            <Store className="mr-1 h-3 w-3" />
                            Offline
                          </>
                        )}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="flex items-center">
                        {sale.paymentMethod === 'cash' ? (
                          <Banknote className="mr-2 h-4 w-4 text-gray-400" />
                        ) : sale.paymentMethod === 'card' ? (
                          <CreditCard className="mr-2 h-4 w-4 text-gray-400" />
                        ) : (
                          <Receipt className="mr-2 h-4 w-4 text-gray-400" />
                        )}
                        <span className="text-sm capitalize">
                          {sale.paymentMethod.replace('_', ' ')}
                        </span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="text-sm font-bold text-gray-900">
                        {formatCurrency(sale.grandTotal)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {sale.items.length} item{sale.items.length !== 1 ? 's' : ''}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div
                        className={cn(
                          'text-sm font-bold',
                          sale.totalProfit >= 0
                            ? 'text-green-600'
                            : 'text-red-600'
                        )}
                      >
                        {formatCurrency(sale.totalProfit)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {sale.grandTotal > 0
                          ? ((sale.totalProfit / sale.grandTotal) * 100).toFixed(1)
                          : 0}%
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                          sale.status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : sale.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : sale.status === 'refunded'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-800'
                        )}
                      >
                        {sale.status.charAt(0).toUpperCase() + sale.status.slice(1)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleInvoice(sale._id)}
                          className="rounded-lg p-2 text-blue-600 hover:bg-blue-50"
                          title="View Invoice"
                        >
                          <Receipt className="h-4 w-4" />
                        </button>
                        {sale.status === 'completed' && (
                          <button
                            onClick={() => handleRefund(sale._id)}
                            className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                            title="Refund"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {sales.length > 0 && (
          <div className="border-t border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-500">
                Showing {sales.length} of {summary.totalSales} sales
              </div>
              <div className="flex items-center space-x-2">
                <button className="rounded-lg border border-gray-300 px-3 py-1 text-sm disabled:opacity-50">
                  Previous
                </button>
                <span className="text-sm">
                  Page 1 of {Math.ceil(summary.totalSales / 50)}
                </span>
                <button className="rounded-lg border border-gray-300 px-3 py-1 text-sm disabled:opacity-50">
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </motion.div>
      <NewSaleModal
        isOpen={showNewSale}
        onClose={() => setShowNewSale(false)}
        onSuccess={handleSaleCreated}
      />
    </div>
  );
};

export default Sales;