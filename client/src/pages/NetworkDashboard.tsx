// pages/NetworkDashboard.tsx
import React, { useState } from 'react';

interface NetworkStats {
  franchiseCount?: number;
  activeFranchises?: number;
  todayRevenue?: number;
  weekRevenue?: number;
  monthRevenue?: number;
  todayProfit?: number;
  weekProfit?: number;
  monthProfit?: number;
  prevTodayRevenue?: number;
  prevWeekRevenue?: number;
  prevMonthRevenue?: number;
  revenueTrendToday?: number;
  revenueTrendWeek?: number;
  revenueTrendMonth?: number;
  profitTrendToday?: number;
  profitTrendWeek?: number;
  profitTrendMonth?: number;
  topProducts?: Array<{ _id: string; product?: { name?: string; sku?: string; franchise?: { name?: string } }; quantitySold?: number; totalSold?: number; revenue?: number; totalRevenue?: number }>;
  franchisePerformance?: Array<{ franchise?: { name?: string; code?: string }; totalRevenue?: number; totalProfit?: number; salesCount?: number }>;
}
import {
  Globe,
  Store,
  TrendingUp,
  IndianRupee,
  Package,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { franchiseApi } from '../services/api';
import { useFranchise } from '../contexts/FranchiseContext';
import toast from 'react-hot-toast';
import NetworkComparisonChart from '../components/Franchise/NetworkComparisonChart';
import KpiCard from '../components/Dashboard/KpiCard';

const NetworkDashboard: React.FC = () => {
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month'>('today');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newFranchise, setNewFranchise] = useState({
    name: '',
    code: '',
    location: '',
    manager: '',
    email: '',
    phone: '',
    address: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { refreshFranchises } = useFranchise();

  // Fetch network statistics
  const { data: networkStats } = useQuery({
    queryKey: ['network-stats', timeRange],
    queryFn: () => franchiseApi.getNetworkStats(),
  });

  const stats: NetworkStats = (networkStats && typeof networkStats === 'object' ? networkStats : {}) as NetworkStats;
  const franchisePerformance = stats.franchisePerformance ?? [];

  const revenue = (timeRange === 'today' ? stats.todayRevenue : timeRange === 'week' ? stats.weekRevenue : stats.monthRevenue) ?? 0;
  const profit = (timeRange === 'today' ? stats.todayProfit : timeRange === 'week' ? stats.weekProfit : stats.monthProfit) ?? 0;
  const prevRevenue = (timeRange === 'today' ? stats.prevTodayRevenue : timeRange === 'week' ? stats.prevWeekRevenue : stats.prevMonthRevenue) ?? 0;
  const revenueTrend = timeRange === 'today' ? (stats.revenueTrendToday ?? 0) : timeRange === 'week' ? (stats.revenueTrendWeek ?? 0) : (stats.revenueTrendMonth ?? 0);
  const profitTrend = timeRange === 'today' ? (stats.profitTrendToday ?? 0) : timeRange === 'week' ? (stats.profitTrendWeek ?? 0) : (stats.profitTrendMonth ?? 0);
  const activeFranchises = stats.activeFranchises ?? 0;
  const avgPerformance = activeFranchises > 0 ? revenue / activeFranchises : 0;
  const prevAvg = activeFranchises > 0 ? prevRevenue / activeFranchises : 0;
  const avgTrend = prevAvg > 0 ? (((avgPerformance - prevAvg) / prevAvg) * 100) : 0;
  const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0;

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const { name, value } = e.target;
    setNewFranchise((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreateFranchise = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFranchise.name || !newFranchise.code || !newFranchise.location || !newFranchise.address) {
      toast.error('Please fill in all required fields.');
      return;
    }

    setIsSubmitting(true);
    try {
      await franchiseApi.create({
        name: newFranchise.name,
        code: newFranchise.code.toUpperCase(),
        location: newFranchise.location,
        manager: newFranchise.manager || 'Manager',
        contact: {
          email: newFranchise.email || 'info@example.com',
          phone: newFranchise.phone || '0000000000',
          address: newFranchise.address,
        },
      });

      toast.success('Franchise created successfully.');
      setIsAddModalOpen(false);
      setNewFranchise({
        name: '',
        code: '',
        location: '',
        manager: '',
        email: '',
        phone: '',
        address: '',
      });
      await refreshFranchises();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create franchise.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full overflow-x-hidden p-4 sm:p-6 space-y-4 sm:space-y-6">
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
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="ml-3 inline-flex items-center px-3 py-1.5 rounded-lg bg-blue-600 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Add Franchise
          </button>
        </div>
      </div>

      {/* Consolidated KPIs - fully dynamic */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
        <KpiCard
          title="Total Network Revenue"
          value={revenue || 0}
          trend={revenueTrend}
          icon={Globe}
          format="currency"
          description={
            timeRange === 'today'
              ? "Today's revenue across all franchises"
              : timeRange === 'week'
              ? "This week's revenue across all franchises"
              : "This month's revenue across all franchises"
          }
        />
        <KpiCard
          title="Active Franchises"
          value={activeFranchises}
          trend={undefined}
          icon={Store}
          format="number"
          description="Active locations"
        />
        <KpiCard
          title="Average Performance"
          value={avgPerformance}
          trend={avgTrend}
          icon={TrendingUp}
          format="currency"
          description="Average revenue per franchise"
        />
        <KpiCard
          title="Network Profit"
          value={profit || 0}
          trend={profitTrend}
          
          icon={IndianRupee}
          format="currency"
          description={`Profit${profitMargin > 0 ? ` (${profitMargin.toFixed(1)}% margin)` : ''}`}
        />
      </div>

      {/* Performance Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-500">Revenue</div>
                  <div className="text-2xl font-bold text-gray-900">
                    ₹{(franchisePerformance[0].totalRevenue || 0).toLocaleString('en-IN')}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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

      {/* Comparison Charts */}
      <NetworkComparisonChart />

      {/* Top Products Across Franchises */}
      <div className="w-full min-w-0 bg-white rounded-xl border border-gray-200 p-4 sm:p-6 overflow-x-hidden">
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
              {(stats.topProducts ?? []).slice(0, 5).map((product: { _id: string; product?: { name?: string; sku?: string; franchise?: { name?: string } }; quantitySold?: number; totalSold?: number; revenue?: number; totalRevenue?: number }) => (
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
                      {product.quantitySold ?? product.totalSold ?? 0}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="font-bold text-gray-900">
                      ₹{(product.revenue ?? product.totalRevenue ?? 0).toLocaleString('en-IN')}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-sm text-gray-900">
                      {product.product?.franchise?.name || 'N/A'}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center">
                      <div className="w-full max-w-24 bg-gray-200 rounded-full h-2">
                        <div
                          className="h-2 rounded-full bg-green-600"
                          style={{ 
                            width: `${Math.min(100, ((product.quantitySold ?? product.totalSold ?? 0) / Math.max(1, Math.max(...(stats.topProducts ?? []).map((p: any) => p.quantitySold ?? p.totalSold ?? 0))) * 100))}%` 
                          }}
                        />
                      </div>
                      <span className="ml-2 text-sm font-medium text-gray-700">
                        {Math.round(((product.quantitySold ?? product.totalSold ?? 0) / Math.max(1, Math.max(...(stats.topProducts ?? []).map((p: any) => p.quantitySold ?? p.totalSold ?? 0))) * 100))}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Franchise Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full min-w-0 bg-white rounded-xl shadow-xl max-w-lg p-4 sm:p-6 overflow-x-hidden">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Add New Franchise
            </h2>
            <form onSubmit={handleCreateFranchise} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name *
                  </label>
                  <input
                    name="name"
                    value={newFranchise.name}
                    onChange={handleInputChange}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Franchise Name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Code *
                  </label>
                  <input
                    name="code"
                    value={newFranchise.code}
                    onChange={handleInputChange}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. FR-001"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Location *
                </label>
                <input
                  name="location"
                  value={newFranchise.location}
                  onChange={handleInputChange}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="City / Area"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address *
                </label>
                <input
                  name="address"
                  value={newFranchise.address}
                  onChange={handleInputChange}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Full address"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Manager
                  </label>
                  <input
                    name="manager"
                    value={newFranchise.manager}
                    onChange={handleInputChange}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Manager name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone
                  </label>
                  <input
                    name="phone"
                    value={newFranchise.phone}
                    onChange={handleInputChange}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Contact number"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  name="email"
                  value={newFranchise.email}
                  onChange={handleInputChange}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Contact email"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 rounded-lg border border-gray-300 hover:bg-gray-50"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Adding...' : 'Add Franchise'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default NetworkDashboard;