// pages/FranchiseDashboard.tsx
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Store,
  DollarSign,
  Package,
  ShoppingCart,
  Users,
  TrendingUp,
  Calendar,
  Clock,
  MapPin,
  Phone,
  Mail,
  Settings,
  ArrowLeft
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { franchiseApi, saleApi, productApi } from '../services/api';
import { useFranchise } from '../contexts/FranchiseContext';
import KpiCard from '../components/Dashboard/KpiCard';
import FranchiseSalesChart from '../components/Dashboard/FranchiseSalesChart';
import FranchiseInventoryStatus from '../components/Dashboard/FranchiseInventoryStatus';
import FranchiseTopProducts from '../components/Dashboard/FranchiseTopProducts';

const FranchiseDashboard: React.FC = () => {
  const { franchiseId } = useParams<{ franchiseId: string }>();
  const navigate = useNavigate();
  const { switchToNetworkView } = useFranchise();
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month'>('today');

  // Fetch franchise details
  const { data: franchiseData, isLoading } = useQuery({
    queryKey: ['franchise', franchiseId],
    queryFn: () => franchiseApi.getById(franchiseId!),
    enabled: !!franchiseId,
  });

  // Fetch franchise sales stats
  const { data: salesStats } = useQuery({
    queryKey: ['franchise-sales-stats', franchiseId, timeRange],
    queryFn: () => saleApi.getFranchiseStats(franchiseId!, timeRange),
    enabled: !!franchiseId,
  });

  const franchise = franchiseData?.data;
  const stats = franchise?.stats;
  const salesData = salesStats?.data;

  if (isLoading) {
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
            onClick={() => switchToNetworkView()}
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
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <div className="flex items-center space-x-3">
                <MapPin className="h-5 w-5 text-gray-400" />
                <div>
                  <div className="text-sm text-gray-500">Location</div>
                  <div className="font-medium">{franchise.location}</div>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <Phone className="h-5 w-5 text-gray-400" />
                <div>
                  <div className="text-sm text-gray-500">Contact</div>
                  <div className="font-medium">{franchise.contact.phone}</div>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <Users className="h-5 w-5 text-gray-400" />
                <div>
                  <div className="text-sm text-gray-500">Manager</div>
                  <div className="font-medium">{franchise.manager}</div>
                </div>
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
              onClick={() => switchToNetworkView()}
              className="flex items-center px-4 py-2 bg-white text-gray-700 hover:bg-gray-50 rounded-lg border border-gray-300 transition-colors"
            >
              <Globe className="h-5 w-5 mr-2" />
              Network View
            </button>
          </div>
        </div>
      </div>

      {/* Time Range Selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Performance Overview</h2>
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

      {/* Franchise-specific KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard
          title="Today's Revenue"
          value={stats?.todayRevenue || 0}
          trend={salesData?.summary?.totalRevenue ? 12.5 : 0}
          icon={DollarSign}
          format="currency"
          color="blue"
        />
        <KpiCard
          title="Inventory Value"
          value={stats?.inventoryValue || 0}
          trend={-2.3}
          icon={Package}
          format="currency"
          color="green"
        />
        <KpiCard
          title="Total Products"
          value={stats?.totalProducts || 0}
          trend={5.7}
          icon={Package}
          format="number"
          color="purple"
        />
        <KpiCard
          title="Low Stock"
          value={stats?.lowStockProducts || 0}
          trend={-10.2}
          icon={ShoppingCart}
          format="number"
          color="red"
          alert={stats?.lowStockProducts > 10}
        />
      </div>

      {/* Charts and Data */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Sales Trend</h3>
          <FranchiseSalesChart franchiseId={franchiseId!} timeRange={timeRange} />
        </div>

        {/* Inventory Status */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Inventory Status</h3>
          <FranchiseInventoryStatus franchiseId={franchiseId!} />
        </div>

        {/* Top Products */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Products</h3>
          <FranchiseTopProducts franchiseId={franchiseId!} />
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
          <div className="space-y-4">
            {salesData?.topProducts?.slice(0, 3).map((product: any, index: number) => (
              <div key={index} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                    <Package className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">
                      {product.product?.name || 'Unknown Product'}
                    </div>
                    <div className="text-sm text-gray-500">
                      {product.quantitySold} units sold
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-gray-900">
                    ${product.revenue.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-500">Revenue</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Franchise Settings Summary */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Franchise Settings</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div>
            <div className="text-sm text-gray-500">Currency</div>
            <div className="font-medium">{franchise.settings.currency}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Tax Rate</div>
            <div className="font-medium">{franchise.settings.taxRate}%</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Opening Hours</div>
            <div className="font-medium">{franchise.settings.openingHours}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Timezone</div>
            <div className="font-medium">{franchise.settings.timezone}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FranchiseDashboard;