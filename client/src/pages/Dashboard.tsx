import React from 'react';
import { motion } from 'framer-motion';
import { 
  IndianRupee, 
  TrendingUp, 
  TrendingDown, 
  Package, 
  AlertTriangle,
  ShoppingCart,
  Store,
  BarChart3,
  PieChart
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import KpiCard from '@/components/Dashboard/KpiCard';
import { SalesChart, ProfitChart, TopProductsChart } from '@/components/Dashboard/SalesChart';
import AlertPanel from '@/components/Dashboard/AlertPanel';
import DeadStockTable from '@/components/Dashboard/DeadStockTable';
import { dashboardApi } from '@/services/api';
import { useRefresh } from '@/contexts/RefreshContext';
import type { DashboardStats } from '@/types';

<IndianRupee />

const Dashboard: React.FC = () => {
  const { refreshKey } = useRefresh();
  const { data: dashboardData, isPending } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats', refreshKey],
    queryFn: dashboardApi.getDashboardStats,
    staleTime: 1 * 60 * 1000, // 1 minute - cache dashboard stats
    refetchInterval: 30000, // Auto-refresh every 30 seconds in background
    refetchOnWindowFocus: false,
  });

  const kpis: Array<{
    title: string;
    value: number;
    icon: typeof IndianRupee;
    format: 'currency' | 'number' | 'percent';
    color: 'default' | 'profit' | 'loss' | 'warning';
    trend?: number;
    description?: string;
  }> = [
    {
      title: 'Total Revenue',
      value: dashboardData?.kpis?.totalRevenue ?? 0,
      icon: IndianRupee,
      format: 'currency',
      color: 'default',
      trend: 12.5,
    },
    {
      title: 'Total Profit',
      value: dashboardData?.kpis?.totalProfit ?? 0,
      icon: TrendingUp,
      format: 'currency',
      color: 'profit',
      trend: 8.2,
    },
    {
      title: 'Total Loss',
      value: dashboardData?.kpis?.totalLoss ?? 0,
      icon: TrendingDown,
      format: 'currency',
      color: 'loss',
      trend: -3.1,
    },
    {
      title: 'Inventory Value',
      value: dashboardData?.kpis?.inventoryValue ?? 0,
      icon: Package,
      format: 'currency',
      color: 'default',
    },
    {
      title: 'Total Products',
      value: dashboardData?.kpis?.totalProducts ?? 0,
      icon: Package,
      format: 'number',
      color: 'default',
    },
    {
      title: 'Low Stock Alerts',
      value: dashboardData?.kpis?.lowStockAlerts ?? 0,
      icon: AlertTriangle,
      format: 'number',
      color: 'warning',
      description: 'Products below minimum stock',
    },
    {
      title: 'Online Sales Today',
      value: dashboardData?.kpis?.onlineSalesToday?.revenue ?? 0,
      icon: ShoppingCart,
      format: 'currency',
      color: 'default',
      description: `${dashboardData?.kpis?.onlineSalesToday?.count ?? 0} orders`,
    },
    {
      title: 'Offline Sales Today',
      value: dashboardData?.kpis?.offlineSalesToday?.revenue ?? 0,
      icon: Store,
      format: 'currency',
      color: 'default',
      description: `${dashboardData?.kpis?.offlineSalesToday?.count ?? 0} sales`,
    },
  ];

  return (
    <div className="min-h-0 w-full bg-white overflow-x-hidden p-3 sm:p-4 lg:p-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4 sm:mb-6 lg:mb-8"
      >
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
          Inventory Dashboard
        </h1>
        <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600 dark:text-gray-400">
          Real-time business insights and analytics
        </p>
      </motion.div>

      {/* KPI Grid - responsive */}
      <div className="mb-6 lg:mb-8 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
        {kpis.map((kpi, index) => (
          <motion.div
            key={kpi.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <KpiCard {...kpi} loading={isPending} />
          </motion.div>
        ))}
      </div>

      {/* Charts Grid - responsive */}
      <div className="mb-6 lg:mb-8 grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <SalesChart
            data={dashboardData?.charts?.salesTrend ?? []}
            type="line"
            title="Sales Trend (Last 30 Days)"
            loading={isPending}
          />
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
        >
          <ProfitChart
            data={dashboardData?.charts.profitByCategory || []}
            title="Profit by Category"
            loading={isPending}
          />
        </motion.div>
      </div>

      {/* Bottom Row - responsive */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="lg:col-span-1"
        >
          <TopProductsChart
            data={dashboardData?.charts?.topProducts ?? []}
            title="Top 5 Products by Revenue"
            loading={isPending}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="lg:col-span-1"
        >
          <DeadStockTable
            data={dashboardData?.charts?.deadStock ?? []}
            loading={isPending}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="lg:col-span-1"
        >
          <AlertPanel />
        </motion.div>
      </div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="mt-8"
      >
        <div className="rounded-xl border border-gray-200 bg-pink-50 p-6 ">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">
            Quick Actions
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 md:grid-cols-4">
            <button className="flex flex-col items-center justify-center rounded-lg border border-gray-300 p-4 transition-colors hover:bg-gray-50">
              <BarChart3 className="mb-2 h-6 w-6 text-blue-600" />
              <span className="text-sm font-medium">Generate Report</span>
            </button>
            <button className="flex flex-col items-center justify-center rounded-lg border border-gray-300 p-4 transition-colors hover:bg-gray-50">
              <PieChart className="mb-2 h-6 w-6 text-green-600" />
              <span className="text-sm font-medium">Export Data</span>
            </button>
            <button className="flex flex-col items-center justify-center rounded-lg border border-gray-300 p-4 transition-colors hover:bg-gray-50">
              <Package className="mb-2 h-6 w-6 text-amber-600" />
              <span className="text-sm font-medium">Add Product</span>
            </button>
            <button className="flex flex-col items-center justify-center rounded-lg border border-gray-300 p-4 transition-colors hover:bg-gray-50">
              <ShoppingCart className="mb-2 h-6 w-6 text-purple-600" />
              <span className="text-sm font-medium">New Sale</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Dashboard;