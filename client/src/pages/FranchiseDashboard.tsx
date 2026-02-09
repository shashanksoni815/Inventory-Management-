/**
 * Franchise Overview Dashboard
 * Route: /franchise/:franchiseId
 *
 * Includes:
 * - Revenue, Profit, Sales KPIs (Total Revenue, Total Profit, Total Sales, Profit Margin, Avg Order, Cost, Gross Profit)
 * - Sales trend chart (revenue & profit over time)
 * - Profit by category chart
 * - Quick action buttons (Create Sale, P&L Report, Imports)
 * - Recent sales table
 * - Inventory summary (products, stock, value, low stock)
 *
 * STRICT FRANCHISE SCOPING:
 * - All sales data is filtered by franchiseId on the backend
 * - All product analytics are scoped to this franchise
 * - No data leakage between franchises
 */
import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Store,
  DollarSign,
  Package,
  ShoppingCart,
  Settings,
  ArrowLeft,
  Globe,
  TrendingUp,
  Download,
  FileText,
  BarChart3,
  ArrowRight,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { franchiseApi, saleApi, productApi } from '../services/api';
import { useFranchise } from '../contexts/FranchiseContext';
import KpiCard from '../components/Dashboard/KpiCard';
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

/** Shape returned by franchiseApi.getById (after response interceptor unwraps { success, data }) */
interface FranchiseDetail {
  _id: string;
  name: string;
  code: string;
  location: string;
  status: string;
  stats?: {
    totalProducts?: number;
    lowStockProducts?: number;
    todaySales?: number;
    todayRevenue?: number;
    inventoryValue?: number;
  };
  [key: string]: unknown;
}

const FranchiseDashboard: React.FC = () => {
  const { franchiseId } = useParams<{ franchiseId: string }>();
  const navigate = useNavigate();
  const { switchToNetworkView } = useFranchise();
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');

  const handleNetworkView = () => {
    switchToNetworkView();
    navigate('/franchises');
  };

  function getStartDate(range: string): string {
    const now = new Date();
    const days = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : 365;
    const start = new Date(now);
    start.setDate(start.getDate() - days);
    return start.toISOString();
  }

  // Fetch franchise details — use franchiseId from URL as-is (do NOT parse or transform)
  const {
    data: franchiseData,
    isLoading: franchiseLoading,
    isError: franchiseError,
    error: franchiseErrorData,
  } = useQuery<FranchiseDetail>({
    queryKey: ['franchise', franchiseId],
    queryFn: async () => {
      const data = await franchiseApi.getById(franchiseId as string);
      return data as unknown as FranchiseDetail;
    },
    enabled: !!franchiseId,
    retry: false, // Do not retry 404/unauthorized
  });

  // Fetch sales data filtered by franchise (outlet)
  const { data: salesData } = useQuery({
    queryKey: ['franchise-sales', franchiseId, timeRange],
    queryFn: () => saleApi.getAll({
      startDate: getStartDate(timeRange),
      endDate: new Date().toISOString(),
      franchise: franchiseId,
    }),
    enabled: !!franchiseId,
  });

  // Fetch product analytics
  const { data: productAnalytics } = useQuery({
    queryKey: ['franchise-product-analytics', franchiseId, timeRange],
    queryFn: () => productApi.getAnalytics(franchiseId!, timeRange),
    enabled: !!franchiseId,
  });

  // API interceptor returns the franchise object directly (no .data wrapper)
  const franchise = franchiseData;
  const sales = Array.isArray(salesData) ? salesData : (salesData as { sales?: any[] })?.sales || [];
  const analytics = (productAnalytics && typeof productAnalytics === 'object' && 'data' in productAnalytics)
    ? (productAnalytics as { data?: any }).data
    : (productAnalytics || {});

  // Calculate sales summary
  const salesSummary = useMemo(() => {
    const totalRevenue = sales.reduce((sum, sale) => sum + (sale.grandTotal || 0), 0);
    const totalProfit = sales.reduce((sum, sale) => sum + (sale.totalProfit || 0), 0);
    const totalCost = sales.reduce((sum, sale) => {
      const saleCost = sale.items?.reduce((itemSum: number, item: any) => 
        itemSum + ((item.buyingPrice || 0) * (item.quantity || 0)), 0) || 0;
      return sum + saleCost;
    }, 0);
    const totalSales = sales.length;
    const avgOrderValue = totalSales > 0 ? totalRevenue / totalSales : 0;
    const profitMargin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100) : 0;
    
    return { totalRevenue, totalProfit, totalCost, totalSales, avgOrderValue, profitMargin };
  }, [sales]);

  // Prepare sales trend data
  const salesTrendData = useMemo(() => {
    const grouped = sales.reduce((acc: any, sale: any) => {
      const date = new Date(sale.createdAt).toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = { date, revenue: 0, profit: 0, cost: 0, orders: 0 };
      }
      acc[date].revenue += sale.grandTotal || 0;
      acc[date].profit += sale.totalProfit || 0;
      const saleCost = sale.items?.reduce((sum: number, item: any) => 
        sum + ((item.buyingPrice || 0) * (item.quantity || 0)), 0) || 0;
      acc[date].cost += saleCost;
      acc[date].orders += 1;
      return acc;
    }, {});
    return Object.values(grouped).sort((a: any, b: any) => a.date.localeCompare(b.date));
  }, [sales]);

  // Profit/Loss by category
  const profitByCategory = useMemo(() => {
    const categoryMap: Record<string, { profit: number; revenue: number; cost: number }> = {};
    sales.forEach((sale: any) => {
      sale.items?.forEach((item: any) => {
        const category = item.category || 'Other';
        if (!categoryMap[category]) {
          categoryMap[category] = { profit: 0, revenue: 0, cost: 0 };
        }
        categoryMap[category].profit += item.profit || 0;
        categoryMap[category].revenue += (item.sellingPrice || 0) * (item.quantity || 0);
        categoryMap[category].cost += (item.buyingPrice || 0) * (item.quantity || 0);
      });
    });
    return Object.entries(categoryMap).map(([category, data]) => ({
      category,
      profit: data.profit,
      revenue: data.revenue,
      cost: data.cost,
      margin: data.revenue > 0 ? ((data.profit / data.revenue) * 100) : 0,
    }));
  }, [sales]);

  // Profit & Loss Statement
  const profitLossStatement = useMemo(() => {
    const revenue = salesSummary.totalRevenue;
    const costOfGoodsSold = salesSummary.totalCost;
    const grossProfit = revenue - costOfGoodsSold;
    const operatingExpenses = 0;
    const netProfit = grossProfit - operatingExpenses;
    const grossMargin = revenue > 0 ? ((grossProfit / revenue) * 100) : 0;
    const netMargin = revenue > 0 ? ((netProfit / revenue) * 100) : 0;

    return {
      revenue,
      costOfGoodsSold,
      grossProfit,
      operatingExpenses,
      netProfit,
      grossMargin,
      netMargin,
    };
  }, [salesSummary]);

  // Loading state
  if (franchiseLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4" />
          <div className="h-32 bg-gray-200 rounded mb-6" />
          <div className="grid grid-cols-4 gap-6 mb-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-gray-200 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Missing franchiseId in URL
  if (!franchiseId) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <Store className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">Invalid link</h3>
          <p className="text-gray-600 mt-1">No franchise was specified.</p>
          <button
            onClick={handleNetworkView}
            className="mt-4 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Network View
          </button>
        </div>
      </div>
    );
  }

  // 404 / unauthorized state (API error or no data)
  if (franchiseError || !franchise) {
    const errorMessage =
      franchiseErrorData && typeof franchiseErrorData === 'object' && 'message' in franchiseErrorData
        ? String((franchiseErrorData as { message?: string }).message)
        : null;
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <Store className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">Franchise not found</h3>
          <p className="text-gray-600 mt-1">
            The requested franchise does not exist or you don&apos;t have access.
          </p>
          {errorMessage && (
            <p className="text-sm text-gray-500 mt-2 max-w-md mx-auto">{errorMessage}</p>
          )}
          <button
            onClick={handleNetworkView}
            className="mt-4 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Network View
          </button>
        </div>
      </div>
    );
  }

  // Success state — render dashboard

  return (
    <div className="p-6 space-y-6">
      {/* Franchise Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
          <div className="mb-4 lg:mb-0">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-white rounded-xl shadow-sm">
                <Store className="h-8 w-8 text-blue-600" />
              </div>
              <div>
                <div className="flex items-center space-x-3">
                  <h1 className="text-2xl font-bold text-gray-900">{franchise.name}</h1>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full
                    ${franchise.status === 'active' 
                      ? 'bg-green-100 text-green-800' 
                      : franchise.status === 'maintenance'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-red-100 text-red-800'
                    }`}>
                    {franchise.status.toUpperCase()}
                  </span>
                </div>
                <p className="text-gray-600 mt-1">
                  {franchise.code} • {franchise.location}
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate(`/franchise/${franchiseId}/settings`)}
              className="flex items-center px-4 py-2 text-gray-700 hover:text-gray-900 hover:bg-white rounded-lg transition-colors"
            >
              <Settings className="h-5 w-5 mr-2" />
              Settings
            </button>
            <button
              onClick={handleNetworkView}
              className="flex items-center px-4 py-2 bg-white text-gray-700 hover:bg-gray-50 rounded-lg border border-gray-300 transition-colors"
            >
              <Globe className="h-5 w-5 mr-2" />
              Network View
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-gray-700">Quick Navigation:</span>
          <button
            onClick={() => navigate(`/franchise/${franchiseId}/sales`)}
            className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-2"
          >
            <ShoppingCart className="h-4 w-4" />
            Sales Dashboard
          </button>
          <button
            onClick={() => navigate(`/franchise/${franchiseId}/imports`)}
            className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Import/Export
          </button>
          <button
            onClick={() => navigate(`/franchise/${franchiseId}/profit-loss`)}
            className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-2"
          >
            <FileText className="h-4 w-4" />
            Profit & Loss
          </button>
        </div>
        <div className="flex items-center space-x-2">
          {(['7d', '30d', '90d', '1y'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors
                ${timeRange === range
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              {range === '7d' ? '7D' : range === '30d' ? '30D' : range === '90d' ? '90D' : '1Y'}
            </button>
          ))}
        </div>
      </div>

      {/* Overview Dashboard */}
      <div className="space-y-6">
        {/* Key Performance Indicators */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            title="Total Revenue"
            value={salesSummary.totalRevenue}
            icon={DollarSign}
            format="currency"
            color="default"
          />
          <KpiCard
            title="Total Profit"
            value={salesSummary.totalProfit}
            icon={TrendingUp}
            format="currency"
            color={salesSummary.totalProfit >= 0 ? 'profit' : 'loss'}
          />
          <KpiCard
            title="Total Sales"
            value={salesSummary.totalSales}
            icon={ShoppingCart}
            format="number"
            color="default"
          />
          <KpiCard
            title="Profit Margin"
            value={salesSummary.profitMargin}
            icon={BarChart3}
            format="percent"
            color={salesSummary.profitMargin >= 20 ? 'profit' : salesSummary.profitMargin >= 10 ? 'default' : 'loss'}
          />
        </div>

        {/* Secondary Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KpiCard
            title="Avg Order Value"
            value={salesSummary.avgOrderValue}
            icon={Package}
            format="currency"
            color="default"
          />
          <KpiCard
            title="Total Cost"
            value={salesSummary.totalCost}
            icon={Package}
            format="currency"
            color="default"
          />
          <KpiCard
            title="Gross Profit"
            value={salesSummary.totalRevenue - salesSummary.totalCost}
            icon={TrendingUp}
            format="currency"
            color={(salesSummary.totalRevenue - salesSummary.totalCost) >= 0 ? 'profit' : 'loss'}
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sales Trend Chart */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Sales Trend</h3>
              <button
                onClick={() => navigate(`/franchise/${franchiseId}/sales`)}
                className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                View Details
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            {salesTrendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300} minWidth={0} minHeight={0}>
                <AreaChart data={salesTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(value: any) => `$${Number(value).toLocaleString()}`}
                    labelFormatter={(label) => new Date(label).toLocaleDateString()}
                  />
                  <Legend />
                  <Area type="monotone" dataKey="revenue" stackId="1" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.6} name="Revenue" />
                  <Area type="monotone" dataKey="profit" stackId="2" stroke="#10B981" fill="#10B981" fillOpacity={0.6} name="Profit" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <BarChart3 className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                  <p>No sales data available</p>
                </div>
              </div>
            )}
          </div>

          {/* Profit by Category Chart */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Profit by Category</h3>
              <button
                onClick={() => navigate(`/franchise/${franchiseId}/profit-loss`)}
                className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                View Details
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            {profitByCategory.length > 0 ? (
              <ResponsiveContainer width="100%" height={300} minWidth={0} minHeight={0}>
                <BarChart data={profitByCategory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="category" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value: any) => `$${Number(value).toLocaleString()}`} />
                  <Legend />
                  <Bar dataKey="profit" fill="#10B981" name="Profit" />
                  <Bar dataKey="revenue" fill="#3B82F6" name="Revenue" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <BarChart3 className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                  <p>No category data available</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions & Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quick Actions */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <button
                onClick={() => navigate('/sales')}
                className="w-full flex items-center justify-between p-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
              >
                <div className="flex items-center gap-3">
                  <ShoppingCart className="w-5 h-5 text-blue-600" />
                  <span className="font-medium text-gray-900">Create Sale</span>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400" />
              </button>
              <button
                onClick={() => navigate(`/franchise/${franchiseId}/profit-loss`)}
                className="w-full flex items-center justify-between p-3 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-green-600" />
                  <span className="font-medium text-gray-900">View P&L Report</span>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400" />
              </button>
              <button
                onClick={() => navigate(`/franchise/${franchiseId}/profit-loss`)}
                className="w-full flex items-center justify-between p-3 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
              >
                <div className="flex items-center gap-3">
                  <BarChart3 className="w-5 h-5 text-purple-600" />
                  <span className="font-medium text-gray-900">Detailed P&L</span>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400" />
              </button>
              <button
                onClick={() => navigate(`/franchise/${franchiseId}/imports`)}
                className="w-full flex items-center justify-between p-3 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Download className="w-5 h-5 text-orange-600" />
                  <span className="font-medium text-gray-900">Manage Imports</span>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>

          {/* Recent Sales */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Recent Sales</h3>
              <button
                onClick={() => navigate(`/franchise/${franchiseId}/sales`)}
                className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                View All
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-700 uppercase">Invoice</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-700 uppercase">Date</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-700 uppercase">Customer</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-700 uppercase text-right">Amount</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-700 uppercase text-right">Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {sales.slice(0, 5).map((sale: any) => (
                    <tr key={sale._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{sale.invoiceNumber || 'N/A'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {sale.createdAt ? new Date(sale.createdAt).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{sale.customerName || 'Walk-in'}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-green-600 text-right">
                        ${(sale.grandTotal || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-blue-600 text-right">
                        ${(sale.totalProfit || 0).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  {sales.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                        No sales found for this period
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Profit & Loss Summary */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Profit & Loss Summary</h3>
              <FileText className="w-6 h-6 text-green-600" />
            </div>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Revenue</span>
                <span className="font-semibold text-gray-900">
                  ${profitLossStatement.revenue.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">COGS</span>
                <span className="font-semibold text-gray-900">
                  ${profitLossStatement.costOfGoodsSold.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-green-200">
                <span className="text-gray-700 font-medium">Gross Profit</span>
                <span className={`font-bold ${profitLossStatement.grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${profitLossStatement.grossProfit.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Net Profit</span>
                <span className={`font-bold ${profitLossStatement.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${profitLossStatement.netProfit.toLocaleString()}
                </span>
              </div>
              <button
                onClick={() => navigate(`/franchise/${franchiseId}/profit-loss`)}
                className="w-full mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
              >
                View Full P&L Report
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Inventory Summary */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Inventory Summary</h3>
              <Package className="w-6 h-6 text-blue-600" />
            </div>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Products</span>
                <span className="font-semibold text-gray-900">
                  {franchise.stats?.totalProducts ?? analytics?.summary?.totalProducts ?? 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total Stock</span>
                <span className="font-semibold text-gray-900">
                  {analytics?.summary?.totalStock ?? 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Inventory Value</span>
                <span className="font-semibold text-gray-900">
                  ${((franchise.stats?.inventoryValue ?? analytics?.summary?.inventoryValue ?? 0) / 1000).toFixed(1)}k
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-blue-200">
                <span className="text-gray-700 font-medium">Low Stock Items</span>
                <span className={`font-bold ${(franchise.stats?.lowStockProducts ?? analytics?.summary?.lowStockCount ?? 0) > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                  {franchise.stats?.lowStockProducts ?? analytics?.summary?.lowStockCount ?? 0}
                </span>
              </div>
              <button
                onClick={() => navigate('/products')}
                className="w-full mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                Manage Inventory
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FranchiseDashboard;
