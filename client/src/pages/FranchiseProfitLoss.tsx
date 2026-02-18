/**
 * Franchise Profit & Loss Dashboard
 * Route: /franchise/:franchiseId/profit-loss
 *
 * Includes:
 * - P&L KPI cards (Revenue, COGS, Gross Profit, Margins, Operating Expenses, Net Profit)
 * - P&L statement table (Revenue, COGS, Gross Profit, Expenses, Net Profit, Margins)
 * - Revenue vs Cost vs Profit trend chart
 * - Category-wise profit breakdown (chart + table)
 * - Export (PDF / Excel) buttons
 *
 * STRICT FRANCHISE SCOPING: All data filtered by franchiseId on the backend.
 */
import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Store,
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  FileText,
  BarChart3,
  DollarSign,
  Package,
  ShoppingCart,
  Download,
  FileSpreadsheet,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { franchiseApi, saleApi, apiBaseURL } from '../services/api';
import { reportApi } from '../services/reportApi';
import KpiCard from '../components/Dashboard/KpiCard';
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

const FranchiseProfitLoss: React.FC = () => {
  const { franchiseId } = useParams<{ franchiseId: string }>();
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');

  function getStartDate(range: string): string {
    const now = new Date();
    const days = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : 365;
    const start = new Date(now);
    start.setDate(start.getDate() - days);
    return start.toISOString();
  }

  function getEndDate(): string {
    return new Date().toISOString();
  }

  // Fetch franchise details
  const { data: franchiseData, isLoading: franchiseLoading } = useQuery({
    queryKey: ['franchise', franchiseId],
    queryFn: () => franchiseApi.getById(franchiseId!),
    enabled: !!franchiseId,
  });

  // Fetch profit & loss data using the new API endpoint
  const {
    data: profitLossData,
    isLoading: profitLossLoading,
    isError: profitLossError,
    error: profitLossErrorData,
  } = useQuery({
    queryKey: ['franchise-profit-loss', franchiseId, timeRange],
    queryFn: () => reportApi.getFranchiseProfitLoss({
      franchise: franchiseId!,
      startDate: getStartDate(timeRange),
      endDate: getEndDate(),
    }),
    enabled: !!franchiseId,
    retry: 1,
    staleTime: 30000, // Cache for 30 seconds
  });

  // API interceptor returns franchise object directly (no .data wrapper)
  const franchise = franchiseData;
  const profitLoss = profitLossData;

  // Extract summary and category breakdown from API response
  const profitLossStatement = profitLoss?.summary || {
    totalRevenue: 0,
    cogs: 0,
    grossProfit: 0,
    operatingExpenses: 0,
    netProfit: 0,
    grossMargin: 0,
    netMargin: 0,
  };
  const isEmpty = !profitLoss || (profitLoss.summary?.totalRevenue === 0 && (profitLoss.categoryBreakdown?.length ?? 0) === 0);

  const profitByCategory = profitLoss?.categoryBreakdown || [];

  // Fetch sales data for trend chart (Revenue vs Cost vs Profit)
  const { data: salesData } = useQuery({
    queryKey: ['franchise-sales-trend', franchiseId, timeRange],
    queryFn: () => saleApi.getAll({
      startDate: getStartDate(timeRange),
      endDate: getEndDate(),
      franchise: franchiseId,
    }),
    enabled: !!franchiseId,
  });

  // Calculate daily profit/loss trend from sales data
  const profitLossTrend = useMemo(() => {
    const sales = Array.isArray(salesData) ? salesData : (salesData as { sales?: any[] })?.sales || [];
    
    if (sales.length === 0) return [];

    const dailyMap = new Map<string, { revenue: number; cost: number; profit: number; date: string }>();
    
    sales.forEach((sale: any) => {
      const saleDate = new Date(sale.createdAt || sale.date || Date.now()).toISOString().split('T')[0];
      const revenue = sale.grandTotal || 0;
      let cost = 0;
      
      if (sale.items && Array.isArray(sale.items)) {
        cost = sale.items.reduce((sum: number, item: any) => {
          const quantity = item.quantity || 0;
          const unitCost = item.buyingPrice || item.unitCost || 0;
          return sum + (quantity * unitCost);
        }, 0);
      }
      
      const profit = revenue - cost;
      const existing = dailyMap.get(saleDate) || { revenue: 0, cost: 0, profit: 0, date: saleDate };
      dailyMap.set(saleDate, {
        revenue: existing.revenue + revenue,
        cost: existing.cost + cost,
        profit: existing.profit + profit,
        date: saleDate,
      });
    });
    
    return Array.from(dailyMap.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(item => ({
        ...item,
        date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      }));
  }, [salesData]);

  // Handle loading state
  if (franchiseLoading || profitLossLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading profit & loss data...</p>
        </div>
      </div>
    );
  }

  // Handle franchise not found
  if (!franchise) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 font-semibold">Franchise not found</p>
          <p className="text-red-600 text-sm mt-1">The franchise you're looking for doesn't exist or you don't have access to it.</p>
          <button
            onClick={() => navigate('/franchises')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go back to Franchises
          </button>
        </div>
      </div>
    );
  }

  // Handle API errors
  if (profitLossError) {
    const errorMessage = (profitLossErrorData as { message?: string })?.message || 'Failed to load profit & loss data';
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <TrendingDown className="w-6 h-6 text-red-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-red-800 font-semibold mb-1">Error Loading Data</h3>
              <p className="text-red-600 text-sm mb-4">{errorMessage}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Retry
                </button>
                <button
                  onClick={() => navigate(`/franchise/${franchiseId}`)}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Go Back
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header & Controls */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(`/franchise/${franchiseId}`)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Profit & Loss Statement</h1>
              <p className="text-gray-600 mt-1">
                <Store className="inline w-4 h-4 mr-1" />
                {franchise.name || 'Franchise Outlet'}
              </p>
            </div>
          </div>
          
          {/* Controls: Time Range Selector & Export */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Time Range:</label>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as '7d' | '30d' | '90d' | '1y')}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              >
                <option value="7d">7 Days</option>
                <option value="30d">30 Days</option>
                <option value="90d">90 Days</option>
                <option value="1y">1 Year</option>
              </select>
            </div>
            
            {/* Export Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  try {
                    const startDate = getStartDate(timeRange);
                    const endDate = getEndDate();
                    const params = new URLSearchParams();
                    params.append('franchise', franchiseId!);
                    params.append('startDate', startDate);
                    params.append('endDate', endDate);
                    params.append('format', 'pdf');

                    const response = await fetch(`${apiBaseURL}/reports/profit-loss?${params.toString()}`, {
                      headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`,
                      },
                    });

                    if (!response.ok) {
                      if (response.status === 403) {
                        const errorData = await response.json().catch(() => ({}));
                        alert(errorData.message || 'Access denied: You do not have permission to export Profit & Loss data from this franchise');
                        return;
                      }
                      throw new Error('Export failed');
                    }

                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `profit-loss-${franchise?.name || franchiseId}-${timeRange}.pdf`;
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                    window.URL.revokeObjectURL(url);
                  } catch (error) {
                    console.error('Export error:', error);
                    alert(error instanceof Error ? error.message : 'Failed to export Profit & Loss report. Please try again.');
                  }
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
              >
                <FileText className="w-4 h-4" />
                PDF
              </button>
              <button
                onClick={async () => {
                  try {
                    const startDate = getStartDate(timeRange);
                    const endDate = getEndDate();
                    const params = new URLSearchParams();
                    params.append('franchise', franchiseId!);
                    params.append('startDate', startDate);
                    params.append('endDate', endDate);
                    params.append('format', 'excel');

                    const response = await fetch(`${apiBaseURL}/reports/profit-loss?${params.toString()}`, {
                      headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`,
                      },
                    });

                    if (!response.ok) {
                      if (response.status === 403) {
                        const errorData = await response.json().catch(() => ({}));
                        alert(errorData.message || 'Access denied: You do not have permission to export Profit & Loss data from this franchise');
                        return;
                      }
                      throw new Error('Export failed');
                    }

                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `profit-loss-${franchise?.name || franchiseId}-${timeRange}.xlsx`;
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                    window.URL.revokeObjectURL(url);
                  } catch (error) {
                    console.error('Export error:', error);
                    alert(error instanceof Error ? error.message : 'Failed to export Profit & Loss report. Please try again.');
                  }
                }}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Excel
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {isEmpty && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 text-center">
          <BarChart3 className="w-12 h-12 text-yellow-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-yellow-900 mb-2">No Data Available</h3>
          <p className="text-yellow-700 mb-4">
            There is no profit & loss data available for the selected time period.
          </p>
          <p className="text-sm text-yellow-600">
            Try selecting a different time range or check back later when sales data is available.
          </p>
        </div>
      )}

      {/* Main Content - Only show if data exists */}
      {!isEmpty && (
        <>

      {/* KPI Cards - All 8 Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Revenue */}
        <KpiCard
          title="Total Revenue"
          value={profitLossStatement.totalRevenue}
          icon={DollarSign}
          format="currency"
          color="default"
        />
        
        {/* COGS */}
        <KpiCard
          title="COGS"
          value={profitLossStatement.cogs}
          icon={Package}
          format="currency"
          color="default"
        />
        
        {/* Gross Profit - Green/Red based on value */}
        <KpiCard
          title="Gross Profit"
          value={profitLossStatement.grossProfit}
          icon={TrendingUp}
          format="currency"
          color={profitLossStatement.grossProfit >= 0 ? 'profit' : 'loss'}
        />
        
        {/* Gross Margin % */}
        <KpiCard
          title="Gross Margin %"
          value={profitLossStatement.grossMargin}
          icon={BarChart3}
          format="percent"
          color={profitLossStatement.grossMargin >= 20 ? 'profit' : profitLossStatement.grossMargin >= 10 ? 'default' : 'loss'}
        />
        
        {/* Operating Expenses */}
        <KpiCard
          title="Operating Expenses"
          value={profitLossStatement.operatingExpenses}
          icon={ShoppingCart}
          format="currency"
          color="default"
        />
        
        {/* Net Profit - Green/Red based on value */}
        <KpiCard
          title="Net Profit"
          value={profitLossStatement.netProfit}
          icon={TrendingUp}
          format="currency"
          color={profitLossStatement.netProfit >= 0 ? 'profit' : 'loss'}
        />
        
        {/* Net Margin % */}
        <KpiCard
          title="Net Margin %"
          value={profitLossStatement.netMargin}
          icon={BarChart3}
          format="percent"
          color={profitLossStatement.netMargin >= 15 ? 'profit' : profitLossStatement.netMargin >= 5 ? 'default' : 'loss'}
        />
      </div>

      {/* Profit & Loss Trend Chart */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Profit & Loss Trend</h2>
        {profitLossTrend.length > 0 ? (
          <ResponsiveContainer width="100%" height={400} minWidth={0} minHeight={0}>
            <AreaChart data={profitLossTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12 }}
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip
                formatter={(value: number) => `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                labelFormatter={(label) => label}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="revenue"
                stackId="1"
                stroke="#10B981"
                fill="#10B981"
                fillOpacity={0.6}
                name="Revenue"
              />
              <Area
                type="monotone"
                dataKey="cost"
                stackId="1"
                stroke="#EF4444"
                fill="#EF4444"
                fillOpacity={0.6}
                name="Cost"
              />
              <Area
                type="monotone"
                dataKey="profit"
                stroke="#3B82F6"
                fill="#3B82F6"
                fillOpacity={0.8}
                name="Profit"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-96 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <BarChart3 className="w-12 h-12 mx-auto mb-2 text-gray-400" />
              <p>No trend data available for the selected period</p>
            </div>
          </div>
        )}
      </div>

      {/* Profit by Category Chart */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Profit by Category</h2>
        <ResponsiveContainer width="100%" height={400} minWidth={0} minHeight={0}>
          <BarChart data={profitByCategory}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="category" />
            <YAxis />
            <Tooltip
              formatter={(value: number) => `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            />
            <Legend />
            <Bar dataKey="revenue" fill="#10B981" name="Revenue" />
            <Bar dataKey="cogs" fill="#EF4444" name="COGS" />
            <Bar dataKey="netProfit" fill="#3B82F6" name="Net Profit" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Detailed Profit & Loss Statement */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Profit & Loss Statement</h2>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Export PDF
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 font-semibold text-gray-700">Item</th>
                <th className="px-4 py-3 font-semibold text-gray-700 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              <tr>
                <td className="px-4 py-3 font-medium text-gray-900">Revenue</td>
                <td className="px-4 py-3 text-right text-gray-900">
                  ${(profitLossStatement.totalRevenue ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-gray-700 pl-8">Cost of Goods Sold</td>
                <td className="px-4 py-3 text-right text-gray-700">
                  ${(profitLossStatement.cogs ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
              <tr className="bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">Gross Profit</td>
                <td className="px-4 py-3 text-right text-gray-900">
                  ${(profitLossStatement.grossProfit ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-gray-700 pl-8">Operating Expenses</td>
                <td className="px-4 py-3 text-right text-gray-700">
                  ${(profitLossStatement.operatingExpenses ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
              <tr className="bg-blue-50">
                <td className="px-4 py-3 font-bold text-gray-900">Net Profit</td>
                <td className="px-4 py-3 text-right font-bold text-gray-900">
                  ${(profitLossStatement.netProfit ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-gray-700">Gross Margin</td>
                <td className="px-4 py-3 text-right text-gray-700">
                  {(profitLossStatement.grossMargin ?? 0).toFixed(2)}%
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-gray-700">Net Margin</td>
                <td className="px-4 py-3 text-right text-gray-700">
                  {(profitLossStatement.netMargin ?? 0).toFixed(2)}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Profit by Category Breakdown Table */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Profit by Category Breakdown</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 font-semibold text-gray-700">Category</th>
                <th className="px-4 py-3 font-semibold text-gray-700 text-right">Revenue</th>
                <th className="px-4 py-3 font-semibold text-gray-700 text-right">Cost</th>
                <th className="px-4 py-3 font-semibold text-gray-700 text-right">Profit</th>
                <th className="px-4 py-3 font-semibold text-gray-700 text-right">Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {profitByCategory.map((item, index) => (
                <tr key={index}>
                  <td className="px-4 py-3 font-medium text-gray-900">{item.category}</td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    ${item.revenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    ${item.cogs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className={`px-4 py-3 text-right font-medium ${item.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${item.netProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className={`px-4 py-3 text-right ${item.netMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {item.netMargin.toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
        </>
      )}
    </div>
  );
};

export default FranchiseProfitLoss;
