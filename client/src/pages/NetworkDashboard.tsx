// pages/NetworkDashboard.tsx
import React, { useState } from 'react';
import { 
  Globe, 
  Store, 
  TrendingUp, 
  DollarSign, 
  Package,
  Users,
  MapPin,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { franchiseApi } from '../services/api';
import FranchisePerformanceTable from '../components/Dashboard/FranchisePerformanceTable';
import FranchiseComparisonChart from '../components/Dashboard/FranchiseComparisonChart';
import KpiCard from '../components/Dashboard/KpiCard';

const NetworkDashboard: React.FC = () => {
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month'>('today');

  // Fetch network statistics
  const { data: networkStats, isLoading } = useQuery({
    queryKey: ['network-stats', timeRange],
    queryFn: () => franchiseApi.getNetworkStats(),
  });

  const stats = networkStats?.data || {};
  const franchisePerformance = stats.franchisePerformance || [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Franchise Network Dashboard</h1>
          <p className="text-gray-600">Overview of all franchise locations and performance</p>
        </div>
        <div className="flex items-center space-x-2">
          {['today', 'week', 'month'].map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range as any)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors
                ${timeRange === range
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              {range.charAt(0).toUpperCase() + range.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Consolidated KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard
          title="Total Network Revenue"
          value={stats.todayRevenue || 0}
          trend={12.5}
          icon={Globe}
          format="currency"
          description="Today's revenue across all franchises"
        />
        <KpiCard
          title="Active Franchises"
          value={stats.activeFranchises || 0}
          trend={0}
          icon={Store}
          format="number"
          description="Active locations"
        />
        <KpiCard
          title="Average Performance"
          value={franchisePerformance.length > 0 
            ? franchisePerformance.reduce((acc: number, fp: any) => acc + (fp.totalRevenue || 0), 0) / franchisePerformance.length
            : 0
          }
          trend={2.3}
          icon={TrendingUp}
          format="currency"
          description="Average revenue per franchise"
        />
        <KpiCard
          title="Network Profit"
          value={(stats.todayRevenue || 0) * 0.35} // Example calculation
          trend={8.2}
          icon={DollarSign}
          format="currency"
          description="Estimated profit margin"
        />
      </div>

      {/* Performance Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Performing Franchise */}
        <div className="lg:col-span-1 bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Performer</h3>
          {franchisePerformance.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-yellow-100 rounded-xl">
                  <Store className="h-8 w-8 text-yellow-600" />
                </div>
                <div>
                  <div className="font-bold text-gray-900 text-xl">
                    {franchisePerformance[0].franchise?.name || 'N/A'}
                  </div>
                  <div className="text-sm text-gray-500">
                    {franchisePerformance[0].franchise?.code || ''}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-500">Revenue</div>
                  <div className="text-2xl font-bold text-gray-900">
                    ${(franchisePerformance[0].totalRevenue || 0).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Sales Count</div>
                  <div className="text-2xl font-bold text-gray-900">
                    {franchisePerformance[0].salesCount || 0}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No performance data available
            </div>
          )}
        </div>

        {/* Network Health */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Network Health</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {franchisePerformance.filter((fp: any) => (fp.totalRevenue || 0) > 10000).length}
                </div>
                <div className="text-sm text-gray-600">High Performers</div>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">
                  {franchisePerformance.filter((fp: any) => (fp.totalRevenue || 0) >= 5000 && (fp.totalRevenue || 0) <= 10000).length}
                </div>
                <div className="text-sm text-gray-600">Average Performers</div>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">
                  {franchisePerformance.filter((fp: any) => (fp.totalRevenue || 0) < 5000).length}
                </div>
                <div className="text-sm text-gray-600">Needs Attention</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Franchise Performance Table */}
      <FranchisePerformanceTable />

      {/* Comparison Chart */}
      <FranchiseComparisonChart />

      {/* Top Products Across Franchises */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Top Products Network-wide</h3>
          <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
            View All Products →
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Sold</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revenue</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Top Franchise</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Performance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {stats.topProducts?.slice(0, 5).map((product: any, index: number) => (
                <tr key={product._id} className="hover:bg-gray-50">
                  <td className="px-4 py-4">
                    <div className="flex items-center space-x-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
                        <Package className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">
                          {product.product?.name || 'Unknown Product'}
                        </div>
                        <div className="text-sm text-gray-500">
                          SKU: {product.product?.sku || 'N/A'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-lg font-bold text-gray-900">
                      {product.quantitySold}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="font-bold text-gray-900">
                      ${product.revenue.toLocaleString()}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-sm text-gray-900">
                      {product.product?.franchise?.name || 'N/A'}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div
                          className="h-2 rounded-full bg-green-600"
                          style={{ 
                            width: `${Math.min(100, (product.quantitySold / 100) * 100)}%` 
                          }}
                        />
                      </div>
                      <span className="ml-2 text-sm font-medium text-gray-700">
                        {Math.round((product.quantitySold / 100) * 100)}%
                      </span>
                    </div>
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

export default NetworkDashboard;