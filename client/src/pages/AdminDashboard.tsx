/**
 * Admin Master Dashboard
 * Route: /admin/dashboard
 * 
 * Access: Admin/SuperAdmin only
 * 
 * Features:
 * - KPI cards grid
 * - Revenue area chart (Recharts)
 * - Franchise performance bar chart
 * - Orders summary section
 * - Inventory alerts table
 * - Recent activity feed
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield,
  DollarSign,
  TrendingUp,
  ShoppingCart,
  Package,
  Store,
  AlertTriangle,
  Clock,
  CheckCircle,
  Activity,
  ArrowRight,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/services/api';
import KpiCard from '@/components/Dashboard/KpiCard';
import { cn, orderStatusBadgeClass } from '@/lib/utils';

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();

  // Fetch admin dashboard data
  const { data: dashboardData, isPending, error } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => dashboardApi.getAdminDashboard(),
    staleTime: 2 * 60 * 1000, // 2 minutes - cache dashboard data
    refetchInterval: 60000, // Refetch every minute in background
    refetchOnWindowFocus: false, // Don't refetch on window focus
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800">
          Error loading dashboard: {(error as Error).message}
        </div>
      </div>
    );
  }

  // API interceptor unwraps { success, data } so dashboardData is the data object directly
  // Type assertion needed because interceptor returns unwrapped data
  const data: {
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
    revenueTrend: Array<{ date: string; revenue: number; profit: number; sales: number }>;
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
      byStatus: Array<{ status: string; count: number; totalRevenue: number }>;
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
  } = (dashboardData as any) || {
    totalFranchises: 0,
    totalProducts: 0,
    totalRevenue: 0,
    totalProfit: 0,
    totalOrders: 0,
    pendingOrders: 0,
    lowStockCount: 0,
    todayRevenue: 0,
    todayProfit: 0,
    todaySales: 0,
    revenueTrend: [],
    franchisePerformance: [],
    orderStats: {
      total: 0,
      pending: 0,
      byStatus: [],
      recentOrders: [],
    },
    categoryBreakdown: [],
  };

  return (
    <div className="w-full overflow-x-hidden p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-200 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-white shadow-sm">
              <Shield className="h-8 w-8 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Admin Master Dashboard</h1>
              <p className="text-gray-600 text-sm mt-0.5">Network-wide overview and analytics</p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
        <KpiCard
          title="Total Franchises"
          value={data.totalFranchises}
          icon={Store}
          format="number"
          color="default"
          loading={isPending}
        />
        <KpiCard
          title="Total Products"
          value={data.totalProducts}
          icon={Package}
          format="number"
          color="default"
          loading={isPending}
        />
        <KpiCard
          title="Total Revenue"
          value={data.totalRevenue}
          icon={DollarSign}
          format="currency"
          color="default"
          loading={isPending}
        />
        <KpiCard
          title="Total Profit"
          value={data.totalProfit}
          icon={TrendingUp}
          format="currency"
          color={data.totalProfit >= 0 ? 'profit' : 'loss'}
          loading={isPending}
        />
        <KpiCard
          title="Total Orders"
          value={data.totalOrders}
          icon={ShoppingCart}
          format="number"
          color="default"
          loading={isPending}
        />
        <KpiCard
          title="Pending Orders"
          value={data.pendingOrders}
          icon={Clock}
          format="number"
          color={data.pendingOrders > 0 ? 'warning' : 'default'}
          loading={isPending}
        />
        <KpiCard
          title="Low Stock Alerts"
          value={data.lowStockCount}
          icon={AlertTriangle}
          format="number"
          color={data.lowStockCount > 0 ? 'warning' : 'default'}
          loading={isPending}
        />
        <KpiCard
          title="Today's Revenue"
          value={data.todayRevenue}
          icon={DollarSign}
          format="currency"
          color="default"
          loading={isPending}
          description={`${data.todaySales} sales today`}
        />
      </div>

      {/* Revenue Area Chart */}
      <div className="w-full min-w-0 bg-white rounded-xl border border-gray-200 p-4 sm:p-6 overflow-x-hidden">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Trend (Last 30 Days)</h3>
        {isPending ? (
          <div className="h-80 flex items-center justify-center text-gray-400">
            <div className="animate-pulse">Loading chart...</div>
          </div>
        ) : data.revenueTrend.length > 0 ? (
          <div className="h-[280px] sm:h-[350px] lg:h-[400px] w-full overflow-x-hidden">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.revenueTrend} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return `${date.getMonth() + 1}/${date.getDate()}`;
                }}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip
                formatter={(value: number | undefined) => formatCurrency(value ?? 0)}
                labelFormatter={(label) => formatDate(label)}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#3B82F6"
                fillOpacity={1}
                fill="url(#colorRevenue)"
                name="Revenue"
              />
              <Area
                type="monotone"
                dataKey="profit"
                stroke="#10B981"
                fillOpacity={1}
                fill="url(#colorProfit)"
                name="Profit"
              />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-80 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <Activity className="w-12 h-12 mx-auto mb-2 text-gray-400" />
              <p>No revenue data available</p>
            </div>
          </div>
        )}
      </div>

      {/* Franchise Performance Bar Chart */}
      <div className="w-full min-w-0 bg-white rounded-xl border border-gray-200 p-4 sm:p-6 overflow-x-hidden">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Franchise Performance</h3>
          <button
            onClick={() => navigate('/franchises')}
            className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            View All
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
        {isPending ? (
          <div className="h-80 flex items-center justify-center text-gray-400">
            <div className="animate-pulse">Loading chart...</div>
          </div>
        ) : data.franchisePerformance.length > 0 ? (
          <div className="h-[280px] sm:h-[350px] lg:h-[400px] w-full overflow-x-hidden">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.franchisePerformance.slice(0, 10)}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
              >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`} />
              <YAxis
                type="category"
                dataKey="franchiseName"
                width={90}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                formatter={(value: number | undefined, name: string | undefined) => [
                  formatCurrency(value ?? 0),
                  name === 'totalRevenue' ? 'Revenue' : name === 'totalProfit' ? 'Profit' : name || '',
                ]}
              />
              <Legend />
              <Bar dataKey="totalRevenue" fill="#3B82F6" name="Revenue" radius={[0, 4, 4, 0]} />
              <Bar dataKey="totalProfit" fill="#10B981" name="Profit" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-80 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <Store className="w-12 h-12 mx-auto mb-2 text-gray-400" />
              <p>No franchise performance data</p>
            </div>
          </div>
        )}
      </div>

      {/* Orders Summary Section */}
      <div className="w-full min-w-0 bg-white rounded-xl border border-gray-200 p-4 sm:p-6 overflow-x-hidden">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Orders Summary</h3>
          <button
            onClick={() => navigate('/orders')}
            className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            View All Orders
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 mb-6">
          {data.orderStats.byStatus.map((stat: any) => (
            <div
              key={stat.status}
              className="rounded-lg border border-gray-200 bg-gray-50 p-4"
            >
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                {stat.status}
              </p>
              <p className="text-2xl font-bold text-gray-900">{stat.count}</p>
              {stat.totalRevenue > 0 && (
                <p className="text-sm text-gray-600 mt-1">{formatCurrency(stat.totalRevenue)}</p>
              )}
            </div>
          ))}
        </div>
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Recent Orders</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-600 font-medium">
                  <th className="py-3 px-4">Order #</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.orderStats.recentOrders.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-500">
                      No recent orders
                    </td>
                  </tr>
                ) : (
                  data.orderStats.recentOrders.map((order: any) => (
                    <tr
                      key={order._id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => navigate(`/orders/${order._id}`)}
                    >
                      <td className="py-3 px-4 font-medium text-gray-900">{order.orderNumber}</td>
                      <td className="py-3 px-4 text-gray-600">{order.customerName}</td>
                      <td className="py-3 px-4">
                        <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', orderStatusBadgeClass(order.orderStatus))}>
                          {order.orderStatus}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-gray-900">
                        {formatCurrency(order.grandTotal)}
                      </td>
                      <td className="py-3 px-4 text-gray-500">{formatDateTime(order.createdAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Inventory Alerts Table */}
      <div className="w-full min-w-0 bg-white rounded-xl border border-gray-200 p-4 sm:p-6 overflow-x-hidden">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <h3 className="text-lg font-semibold text-gray-900">Inventory Alerts</h3>
          </div>
          <button
            onClick={() => navigate('/products')}
            className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            Manage Products
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
        {isPending ? (
          <div className="h-32 flex items-center justify-center text-gray-400">
            <div className="animate-pulse">Loading alerts...</div>
          </div>
        ) : data.lowStockCount > 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <p className="font-semibold text-amber-900">
                {data.lowStockCount} product{data.lowStockCount !== 1 ? 's' : ''} need attention
              </p>
            </div>
            <p className="text-sm text-amber-700">
              Products are running low on stock and may need to be reordered soon.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <p className="font-semibold text-green-900">All products have sufficient stock</p>
            </div>
          </div>
        )}
      </div>

      {/* Recent Activity Feed */}
      <div className="w-full min-w-0 bg-white rounded-xl border border-gray-200 p-4 sm:p-6 overflow-x-hidden">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-500" />
            <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
          </div>
        </div>
        <div className="space-y-4">
          {/* Today's Sales Activity */}
          {data.todaySales > 0 && (
            <div className="flex items-start gap-3 p-4 rounded-lg border border-gray-200 bg-blue-50">
              <div className="p-2 rounded-lg bg-blue-100">
                <ShoppingCart className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">
                  {data.todaySales} sale{data.todaySales !== 1 ? 's' : ''} completed today
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  Total revenue: {formatCurrency(data.todayRevenue)} • Profit: {formatCurrency(data.todayProfit)}
                </p>
                <p className="text-xs text-gray-500 mt-1">{formatDateTime(new Date().toISOString())}</p>
              </div>
            </div>
          )}

          {/* Pending Orders Alert */}
          {data.pendingOrders > 0 && (
            <div className="flex items-start gap-3 p-4 rounded-lg border border-amber-200 bg-amber-50">
              <div className="p-2 rounded-lg bg-amber-100">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">
                  {data.pendingOrders} pending order{data.pendingOrders !== 1 ? 's' : ''} require attention
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  Orders are waiting to be processed, packed, or shipped.
                </p>
                <button
                  onClick={() => navigate('/orders')}
                  className="text-xs text-blue-600 hover:text-blue-800 mt-2 flex items-center gap-1"
                >
                  View Orders
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          {/* Low Stock Alert */}
          {data.lowStockCount > 0 && (
            <div className="flex items-start gap-3 p-4 rounded-lg border border-red-200 bg-red-50">
              <div className="p-2 rounded-lg bg-red-100">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">
                  {data.lowStockCount} product{data.lowStockCount !== 1 ? 's' : ''} running low on stock
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  These products may need to be reordered soon to avoid stockouts.
                </p>
                <button
                  onClick={() => navigate('/products')}
                  className="text-xs text-blue-600 hover:text-blue-800 mt-2 flex items-center gap-1"
                >
                  Manage Inventory
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          {/* No Activity Message */}
          {data.todaySales === 0 && data.pendingOrders === 0 && data.lowStockCount === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Activity className="w-12 h-12 mx-auto mb-2 text-gray-400" />
              <p>No recent activity to display</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
