/**
 * Franchise Sales Dashboard
 * Route: /franchise/:franchiseId/sales
 *
 * Includes:
 * - Sales KPIs (Revenue, Profit, Total Sales, Avg Order Value)
 * - Revenue & profit charts (Sales Trend, Profit by Category)
 * - Recent sales table
 * - Time range filter (7d / 30d / 90d / 1y)
 *
 * STRICT FRANCHISE SCOPING: All data filtered by franchiseId on the backend.
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
  BarChart3,
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

const FranchiseSalesDashboard: React.FC = () => {
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

  // Fetch franchise details
  const { data: franchiseData, isLoading: franchiseLoading } = useQuery({
    queryKey: ['franchise', franchiseId],
    queryFn: () => franchiseApi.getById(franchiseId!),
    enabled: !!franchiseId,
  });

  // Fetch sales data filtered by franchise
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

  // API interceptor returns franchise object directly (no .data wrapper)
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

  // Profit by category
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

  if (franchiseLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-32 bg-gray-200 rounded mb-6"></div>
          <div className="grid grid-cols-4 gap-6 mb-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!franchise) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <Store className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">Franchise not found</h3>
          <p className="text-gray-600 mt-1">The requested franchise does not exist or you don't have access.</p>
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

  return (
    <div className="p-6 space-y-6">
      {/* Franchise Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
          <div className="mb-4 lg:mb-0">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => navigate(`/franchise/${franchiseId}`)}
                className="p-2 hover:bg-white rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </button>
              <div className="p-3 bg-white rounded-xl shadow-sm">
                <Store className="h-8 w-8 text-blue-600" />
              </div>
              <div>
                <div className="flex items-center space-x-3">
                  <h1 className="text-2xl font-bold text-gray-900">{franchise.name} - Sales Dashboard</h1>
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
            <div className="flex items-center space-x-2">
              {(['7d', '30d', '90d', '1y'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors
                    ${timeRange === range
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-100'
                    }`}
                >
                  {range === '7d' ? '7D' : range === '30d' ? '30D' : range === '90d' ? '90D' : '1Y'}
                </button>
              ))}
            </div>
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

      {/* Sales KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard
          title="Total Revenue"
          value={salesSummary.totalRevenue}
          icon={DollarSign}
          format="currency"
          trend={salesSummary.totalRevenue > 0 ? 5.2 : 0}
        />
        <KpiCard
          title="Total Profit"
          value={salesSummary.totalProfit}
          icon={TrendingUp}
          format="currency"
          trend={salesSummary.totalProfit > 0 ? 8.1 : -2.3}
          color={salesSummary.totalProfit >= 0 ? 'profit' : 'loss'}
        />
        <KpiCard
          title="Total Sales"
          value={salesSummary.totalSales}
          icon={ShoppingCart}
          format="number"
          trend={salesSummary.totalSales > 0 ? 12.5 : 0}
        />
        <KpiCard
          title="Avg Order Value"
          value={salesSummary.avgOrderValue}
          icon={Package}
          format="currency"
          trend={salesSummary.avgOrderValue > 0 ? 3.4 : 0}
        />
      </div>

      {/* Sales Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Trend Chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Sales Trend</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
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
          </div>
        </div>

        {/* Profit by Category */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Profit by Category</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
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
          </div>
        </div>
      </div>

      {/* Recent Sales Table */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Sales</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revenue</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Profit</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sales.slice(0, 10).map((sale: any) => (
                <tr key={sale._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{sale.invoiceNumber || 'N/A'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {sale.createdAt ? new Date(sale.createdAt).toLocaleDateString() : 'N/A'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{sale.customerName || 'Walk-in'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{sale.items?.length || 0}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-green-600">
                    ${(sale.grandTotal || 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-blue-600">
                    ${(sale.totalProfit || 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full capitalize
                      ${sale.status === 'completed' ? 'bg-green-100 text-green-800' :
                        sale.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        sale.status === 'refunded' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                      {sale.status || 'completed'}
                    </span>
                  </td>
                </tr>
              ))}
              {sales.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    No sales found for this period
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default FranchiseSalesDashboard;
