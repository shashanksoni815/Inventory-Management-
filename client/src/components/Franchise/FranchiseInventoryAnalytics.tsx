import React, { useState } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Package,
  DollarSign,
  AlertTriangle,
  Download
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { productApi } from '../../services/api';
import { useFranchise } from '../../contexts/FranchiseContext';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

const FranchiseInventoryAnalytics: React.FC = () => {
  const { currentFranchise } = useFranchise();
  const [timeRange, setTimeRange] = useState('month');
  
  const { data: analytics, isLoading } = useQuery({
    queryKey: ['product-analytics', currentFranchise?._id, timeRange],
    queryFn: () => productApi.getAnalytics(currentFranchise?._id!, timeRange),
    enabled: !!currentFranchise?._id,
  });

  const summary = analytics?.data?.summary || {};
  const topProducts = analytics?.data?.topProducts || [];
  const categoryDistribution = analytics?.data?.categoryDistribution || [];

  // Prepare data for charts
  const stockStatusData = [
    { name: 'In Stock', value: summary.totalProducts - summary.lowStockCount - summary.outOfStockCount, color: '#10B981' },
    { name: 'Low Stock', value: summary.lowStockCount, color: '#F59E0B' },
    { name: 'Out of Stock', value: summary.outOfStockCount, color: '#EF4444' }
  ];

  const categoryData = categoryDistribution.map((cat: any) => ({
    name: cat._id,
    count: cat.count,
    value: cat.inventoryValue,
    color: getCategoryColor(cat._id)
  }));

  const topProductsData = topProducts.slice(0, 5).map((product: any) => ({
    name: product.name.substring(0, 15) + (product.name.length > 15 ? '...' : ''),
    sales: product.totalSold,
    revenue: product.totalRevenue,
    profit: product.totalProfit
  }));

  function getCategoryColor(category: string) {
    const colors: Record<string, string> = {
      'Electronics': '#3B82F6',
      'Clothing': '#8B5CF6',
      'Books': '#10B981',
      'Home & Kitchen': '#F59E0B',
      'Sports': '#EF4444',
      'Other': '#6B7280'
    };
    return colors[category] || '#6B7280';
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
              <div className="h-32 bg-gray-200 rounded"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Inventory Analytics</h3>
          <p className="text-sm text-gray-600">Performance insights for {currentFranchise?.name}</p>
        </div>
        <div className="flex items-center space-x-3">
          <select
            className="w-40 rounded-md border border-gray-300 bg-white py-1.5 px-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
          >
            <option value="today">Today</option>
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
            <option value="quarter">Last Quarter</option>
            <option value="year">Last Year</option>
          </select>
          <button
            type="button"
            className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Package className="h-6 w-6 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Products</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {summary.totalProducts?.toLocaleString() || 0}
          </div>
          <div className="flex items-center mt-2">
            <div className="text-sm text-gray-600">
              ${summary.inventoryValue?.toLocaleString() || 0} total value
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Stock Alerts</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {((summary.lowStockCount || 0) + (summary.outOfStockCount || 0)).toLocaleString()}
          </div>
          <div className="flex items-center mt-2 space-x-4">
            <div className="text-sm">
              <span className="text-yellow-600 font-medium">{summary.lowStockCount || 0}</span>
              <span className="text-gray-600 ml-1">Low</span>
            </div>
            <div className="text-sm">
              <span className="text-red-600 font-medium">{summary.outOfStockCount || 0}</span>
              <span className="text-gray-600 ml-1">Out</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Revenue</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">
            ${summary.totalRevenue?.toLocaleString() || 0}
          </div>
          <div className="flex items-center mt-2">
            <div className="text-sm text-gray-600">
              Profit: ${summary.totalProfit?.toLocaleString() || 0}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-purple-100 rounded-lg">
              <BarChart3 className="h-6 w-6 text-purple-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Margin</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {(summary.averageProfitMargin || 0).toFixed(1)}%
          </div>
          <div className="flex items-center mt-2">
            {summary.averageProfitMargin >= 20 ? (
              <TrendingUp className="h-4 w-4 text-green-600 mr-1" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600 mr-1" />
            )}
            <span className={`text-sm font-medium ${
              summary.averageProfitMargin >= 20 ? 'text-green-600' : 'text-red-600'
            }`}>
              {summary.averageProfitMargin >= 20 ? 'Healthy' : 'Needs Attention'}
            </span>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stock Status Distribution */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h4 className="text-lg font-semibold text-gray-900 mb-4">Stock Status</h4>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <PieChart>
                <Pie
                  data={stockStatusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {stockStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [value, 'Products']} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Distribution */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h4 className="text-lg font-semibold text-gray-900 mb-4">Category Distribution</h4>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <BarChart data={categoryData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => [value, 'Products']} />
                <Legend />
                <Bar dataKey="count" name="Product Count" fill="#8884d8" />
                <Bar dataKey="value" name="Inventory Value ($)" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Products */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 lg:col-span-2">
          <h4 className="text-lg font-semibold text-gray-900 mb-4">Top Performing Products</h4>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <BarChart data={topProductsData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip formatter={(value, name) => {
                  const num = typeof value === 'number' ? value : Number(value) || 0;
                  if (name === 'sales') return [num, 'Units Sold'];
                  if (name === 'revenue') return [`$${num.toLocaleString()}`, 'Revenue'];
                  if (name === 'profit') return [`$${num.toLocaleString()}`, 'Profit'];
                  return [num, name];
                }} />
                <Legend />
                <Bar yAxisId="left" dataKey="sales" name="Units Sold" fill="#3B82F6" />
                <Bar yAxisId="right" dataKey="revenue" name="Revenue ($)" fill="#10B981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top Products Table */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h4 className="text-lg font-semibold text-gray-900 mb-4">Top Products Details</h4>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Units Sold</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revenue</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Profit</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Current Stock</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {topProducts.slice(0, 10).map((product: any) => (
                <tr key={product._id} className="hover:bg-gray-50">
                  <td className="px-4 py-4">
                    <div className="font-medium text-gray-900">{product.name}</div>
                    <div className="text-sm text-gray-500">SKU: {product.sku}</div>
                  </td>
                  <td className="px-4 py-4">
                    <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">
                      {product.category}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="font-bold text-gray-900">{product.totalSold}</div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="font-bold text-green-600">
                      ${product.totalRevenue?.toLocaleString()}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="font-bold text-blue-600">
                      ${product.totalProfit?.toLocaleString()}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="font-bold text-gray-900">{product.stockQuantity}</div>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                      ${product.stockStatus === 'in-stock' ? 'bg-green-100 text-green-800' :
                        product.stockStatus === 'low-stock' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                      {product.stockStatus === 'in-stock' ? 'In Stock' :
                       product.stockStatus === 'low-stock' ? 'Low Stock' : 'Out of Stock'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default FranchiseInventoryAnalytics;