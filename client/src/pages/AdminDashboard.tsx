/**
 * Admin Master Dashboard
 * Route: /admin/dashboard
 *
 * Access: Super Admin only. Franchise managers are blocked (see AdminRoute).
 *
 * Header: title, time range selector (7d / 30d / 90d / 1y), global export (Excel / PDF).
 * Global KPI cards + Global charts: Revenue & Profit Trend, Profit by Franchise, Profit by Category.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, FileText, FileSpreadsheet, IndianRupee, TrendingUp, Receipt, Store, ShoppingCart, Package, ArrowDownToLine, ArrowUpFromLine, BarChart3, ChevronUp, ChevronDown, Truck, AlertTriangle, TrendingDown, PackageX, PieChart } from 'lucide-react';
import {
  AreaChart,
  Area,
  Line,
  LineChart,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
} from 'recharts';
import { franchiseApi, transferApi } from '@/services/api';
import type { AdminKpis, AdminCharts, FranchisePerformanceRow, AdminTransfersOverview, AdminInsights } from '@/types';
import { formatCurrency } from '@/lib/utils';

type PerfStatus = 'high' | 'average' | 'loss';

function getStatus(row: FranchisePerformanceRow): PerfStatus {
  if (row.profit < 0) return 'loss';
  const margin = row.revenue > 0 ? (row.profit / row.revenue) * 100 : 0;
  return margin >= 15 ? 'high' : 'average';
}

type TimeRange = '7d' | '30d' | '90d' | '1y';

const KPI_CARDS: { key: keyof AdminKpis; title: string; description: string; icon: React.ElementType; format: 'currency' | 'number'; profitLoss?: boolean }[] = [
  { key: 'totalRevenue', title: 'Total Revenue', description: 'Sum of all franchise sales', icon: IndianRupee, format: 'currency' },
  { key: 'totalProfit', title: 'Total Profit', description: 'Net profit across all outlets', icon: TrendingUp, format: 'currency', profitLoss: true },
  { key: 'totalSales', title: 'Total Sales', description: 'Count of all invoices', icon: Receipt, format: 'number' },
  { key: 'activeFranchises', title: 'Active Franchises', description: 'Franchises with sales in range', icon: Store, format: 'number' },
  { key: 'avgOrderValue', title: 'Avg Order Value', description: 'Revenue / Sales', icon: ShoppingCart, format: 'currency' },
  { key: 'inventoryValue', title: 'Inventory Value', description: 'Total stock value', icon: Package, format: 'currency' },
  { key: 'totalImports', title: 'Total Imports', description: 'Network-wide', icon: ArrowDownToLine, format: 'number' },
  { key: 'totalExports', title: 'Total Exports', description: 'Network-wide', icon: ArrowUpFromLine, format: 'number' },
];

type PerfSortKey = 'franchiseName' | 'revenue' | 'profit' | 'margin' | 'sales' | 'stockValue' | 'status';

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [kpis, setKpis] = useState<AdminKpis | null>(null);
  const [charts, setCharts] = useState<AdminCharts | null>(null);
  const [performance, setPerformance] = useState<FranchisePerformanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<PerfSortKey>('profit');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [transfersOverview, setTransfersOverview] = useState<AdminTransfersOverview | null>(null);
  const [insights, setInsights] = useState<AdminInsights | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      franchiseApi.getAdminKpis(timeRange),
      franchiseApi.getAdminCharts(timeRange),
      franchiseApi.getAdminPerformance(timeRange),
      transferApi.getAdminOverview(timeRange),
      franchiseApi.getAdminInsights(timeRange),
    ])
      .then(([kpisData, chartsData, perfData, transfersData, insightsData]) => {
        if (!cancelled) {
          setKpis(kpisData);
          setCharts(chartsData);
          setPerformance(Array.isArray(perfData) ? perfData : []);
          setTransfersOverview(transfersData ?? null);
          setInsights(insightsData ?? null);
        }
      })
      .catch((err: { message?: string }) => {
        if (!cancelled) setError(err?.message ?? 'Failed to load dashboard data');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [timeRange]);

  const sortedPerformance = useMemo(() => {
    const rows = performance.map((row) => ({
      ...row,
      marginPercent: row.revenue > 0 ? (row.profit / row.revenue) * 100 : 0,
      status: getStatus(row),
    }));
    const mult = sortOrder === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      let aVal: string | number = (a as Record<string, unknown>)[sortKey];
      let bVal: string | number = (b as Record<string, unknown>)[sortKey];
      if (sortKey === 'margin') {
        aVal = a.marginPercent;
        bVal = b.marginPercent;
      }
      if (sortKey === 'status') {
        const order = { high: 2, average: 1, loss: 0 };
        aVal = order[a.status];
        bVal = order[b.status];
      }
      if (typeof aVal === 'string' && typeof bVal === 'string') return mult * aVal.localeCompare(bVal);
      return mult * (Number(aVal) - Number(bVal));
    });
  }, [performance, sortKey, sortOrder]);

  const handleSort = (key: PerfSortKey) => {
    if (sortKey === key) setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortOrder(key === 'franchiseName' ? 'asc' : 'desc');
    }
  };

  const handleExportExcel = () => {
    // TODO: Implement global Excel export
    console.log('Export Excel', timeRange);
  };

  const handleExportPdf = () => {
    // TODO: Implement global PDF export
    console.log('Export PDF', timeRange);
  };

  const formatValue = (k: keyof AdminKpis, v: number): string => {
    const card = KPI_CARDS.find((c) => c.key === k);
    return card?.format === 'currency' ? formatCurrency(v) : v.toLocaleString();
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-200 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-white shadow-sm">
              <Shield className="h-8 w-8 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Admin Master Dashboard</h1>
              <p className="text-gray-600 text-sm mt-0.5">Super Admin — network-wide settings and oversight.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Time range selector */}
            <div className="flex rounded-lg border border-gray-200 bg-white p-1">
              {(['7d', '30d', '90d', '1y'] as const).map((range) => (
                <button
                  key={range}
                  type="button"
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-2 text-sm font-medium rounded-md transition-colors
                    ${timeRange === range
                      ? 'bg-indigo-600 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                    }`}
                >
                  {range === '7d' ? '7 days' : range === '30d' ? '30 days' : range === '90d' ? '90 days' : '1 year'}
                </button>
              ))}
            </div>

            {/* Global Export */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportPdf}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 font-medium text-sm"
              >
                <FileText className="h-4 w-4" />
                PDF
              </button>
              <button
                type="button"
                onClick={handleExportExcel}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 font-medium text-sm"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Excel
              </button>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {KPI_CARDS.map(({ key, title, description, icon: Icon, profitLoss }) => {
          const value = kpis ? kpis[key] : 0;
          const isProfit = typeof value === 'number' && profitLoss && value >= 0;
          const isLoss = typeof value === 'number' && profitLoss && value < 0;
          return (
            <div
              key={key}
              className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">{title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{description}</p>
                  {loading ? (
                    <p className="mt-2 text-gray-400 text-sm">Loading…</p>
                  ) : (
                    <p
                      className={`mt-2 text-xl font-bold tabular-nums
                        ${isProfit ? 'text-green-600' : ''}
                        ${isLoss ? 'text-red-600' : ''}
                        ${!profitLoss ? 'text-gray-900' : ''}`}
                    >
                      {formatValue(key, typeof value === 'number' ? value : 0)}
                    </p>
                  )}
                </div>
                <div className="p-2 rounded-lg bg-indigo-50">
                  <Icon className="h-5 w-5 text-indigo-600" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Global Charts */}
      <div className="space-y-6">
        {/* 1. Revenue & Profit Trend — Area / Line: Revenue vs Cost vs Profit */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Revenue & Profit Trend</h3>
          <p className="text-sm text-gray-500 mb-4">Revenue vs Cost vs Profit — aggregated across all franchises</p>
          {loading ? (
            <div className="h-[300px] flex items-center justify-center text-gray-400">Loading chart…</div>
          ) : charts?.revenueProfitTrend?.length ? (
            <ResponsiveContainer width="100%" height={320} minWidth={0} minHeight={0}>
              <ComposedChart data={charts.revenueProfitTrend} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="period"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => (v.length > 7 ? v : new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))}
                />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCurrency(v)} />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  labelFormatter={(label) => (String(label).length > 7 ? label : new Date(label).toLocaleDateString())}
                />
                <Legend />
                <Area type="monotone" dataKey="revenue" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.4} name="Revenue" />
                <Line type="monotone" dataKey="cost" stroke="#F59E0B" strokeWidth={2} dot={false} name="Cost" />
                <Line type="monotone" dataKey="profit" stroke="#10B981" strokeWidth={2} dot={false} name="Profit" />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-500">
              <div className="text-center">
                <BarChart3 className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                <p>No trend data for this period</p>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 2. Profit by Franchise — Bar: X = Franchise, Y = Profit, sort descending */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Profit by Franchise</h3>
            <p className="text-sm text-gray-500 mb-4">Profit per outlet (sorted descending)</p>
            {loading ? (
              <div className="h-[300px] flex items-center justify-center text-gray-400">Loading chart…</div>
            ) : charts?.profitByFranchise?.length ? (
              <ResponsiveContainer width="100%" height={300} minWidth={0} minHeight={0}>
                <BarChart data={charts.profitByFranchise} layout="vertical" margin={{ left: 80 }} barCategoryGap={6}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="franchiseName" width={80} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Bar dataKey="profit" fill="#10B981" name="Profit" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <BarChart3 className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                  <p>No franchise data for this period</p>
                </div>
              </div>
            )}
          </div>

          {/* 3. Profit by Category — Stacked bar: Revenue, Cost, Profit per category */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Profit by Category</h3>
            <p className="text-sm text-gray-500 mb-4">Revenue, Cost, Profit per category</p>
            {loading ? (
              <div className="h-[300px] flex items-center justify-center text-gray-400">Loading chart…</div>
            ) : charts?.profitByCategory?.length ? (
              <ResponsiveContainer width="100%" height={300} minWidth={0} minHeight={0}>
                <BarChart data={charts.profitByCategory} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCurrency(v)} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend />
                  <Bar dataKey="revenue" fill="#3B82F6" name="Revenue" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="cost" fill="#F59E0B" name="Cost" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="profit" fill="#10B981" name="Profit" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <BarChart3 className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                  <p>No category data for this period</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Franchise Performance Table — sortable, row click → /franchise/:id */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Franchise Performance</h3>
          <p className="text-sm text-gray-500 mb-4">Click a row to open the franchise dashboard. Sort by column.</p>
          {loading ? (
            <div className="h-32 flex items-center justify-center text-gray-400">Loading table…</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-600 font-medium">
                    <th className="py-3 px-3 cursor-pointer hover:bg-gray-50 rounded-tl-lg" onClick={() => handleSort('franchiseName')}>
                      <span className="inline-flex items-center gap-1">Franchise {sortKey === 'franchiseName' && (sortOrder === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}</span>
                    </th>
                    <th className="py-3 px-3 cursor-pointer hover:bg-gray-50" onClick={() => handleSort('revenue')}>
                      <span className="inline-flex items-center gap-1">Revenue {sortKey === 'revenue' && (sortOrder === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}</span>
                    </th>
                    <th className="py-3 px-3 cursor-pointer hover:bg-gray-50" onClick={() => handleSort('profit')}>
                      <span className="inline-flex items-center gap-1">Profit {sortKey === 'profit' && (sortOrder === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}</span>
                    </th>
                    <th className="py-3 px-3 cursor-pointer hover:bg-gray-50" onClick={() => handleSort('margin')}>
                      <span className="inline-flex items-center gap-1">Margin % {sortKey === 'margin' && (sortOrder === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}</span>
                    </th>
                    <th className="py-3 px-3 cursor-pointer hover:bg-gray-50" onClick={() => handleSort('sales')}>
                      <span className="inline-flex items-center gap-1">Sales {sortKey === 'sales' && (sortOrder === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}</span>
                    </th>
                    <th className="py-3 px-3 cursor-pointer hover:bg-gray-50" onClick={() => handleSort('stockValue')}>
                      <span className="inline-flex items-center gap-1">Stock Value {sortKey === 'stockValue' && (sortOrder === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}</span>
                    </th>
                    <th className="py-3 px-3 cursor-pointer hover:bg-gray-50 rounded-tr-lg" onClick={() => handleSort('status')}>
                      <span className="inline-flex items-center gap-1">Status {sortKey === 'status' && (sortOrder === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPerformance.length === 0 ? (
                    <tr><td colSpan={7} className="py-8 text-center text-gray-500">No franchises</td></tr>
                  ) : (
                    sortedPerformance.map((row) => (
                      <tr
                        key={row.franchiseId}
                        onClick={() => navigate(`/franchise/${row.franchiseId}`)}
                        className="border-b border-gray-100 hover:bg-indigo-50 cursor-pointer transition-colors"
                      >
                        <td className="py-3 px-3 font-medium text-gray-900">{row.franchiseName}</td>
                        <td className="py-3 px-3 tabular-nums text-gray-700">{formatCurrency(row.revenue)}</td>
                        <td className={`py-3 px-3 tabular-nums ${row.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(row.profit)}</td>
                        <td className="py-3 px-3 tabular-nums text-gray-700">{row.marginPercent.toFixed(1)}%</td>
                        <td className="py-3 px-3 tabular-nums text-gray-700">{row.sales.toLocaleString()}</td>
                        <td className="py-3 px-3 tabular-nums text-gray-700">{formatCurrency(row.stockValue)}</td>
                        <td className="py-3 px-3">
                          {row.status === 'high' && <span className="inline-flex items-center gap-1 text-green-700" title="High performer">🟢 High performer</span>}
                          {row.status === 'average' && <span className="inline-flex items-center gap-1 text-amber-700" title="Average">🟡 Average</span>}
                          {row.status === 'loss' && <span className="inline-flex items-center gap-1 text-red-700" title="Loss-making">🔴 Loss-making</span>}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Network Transfers Overview */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
            <Truck className="h-5 w-5 text-indigo-600" />
            Network Transfers Overview
          </h3>
          <p className="text-sm text-gray-500 mb-4">Total imports vs exports, inter-franchise transfers, and bottlenecks (pending).</p>

          {loading ? (
            <div className="h-32 flex items-center justify-center text-gray-400">Loading transfers…</div>
          ) : transfersOverview ? (
            <div className="space-y-6">
              {/* Total imports vs exports + by status */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Completed imports</p>
                  <p className="text-xl font-bold text-gray-900 mt-1">{transfersOverview.totalImports.toLocaleString()}</p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Completed exports</p>
                  <p className="text-xl font-bold text-gray-900 mt-1">{transfersOverview.totalExports.toLocaleString()}</p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Quantity moved</p>
                  <p className="text-xl font-bold text-gray-900 mt-1">{transfersOverview.completedQuantity.toLocaleString()}</p>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <p className="text-xs font-medium text-amber-700 uppercase tracking-wide">Pending / in transit</p>
                  <p className="text-xl font-bold text-amber-800 mt-1">
                    {(transfersOverview.byStatus.pending + transfersOverview.byStatus.approved + transfersOverview.byStatus.in_transit).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Inter-franchise transfers (recent) */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Inter-franchise transfers (latest 15)</h4>
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 text-left text-gray-600 font-medium">
                          <th className="py-2 px-3">From → To</th>
                          <th className="py-2 px-3">Product</th>
                          <th className="py-2 px-3">Qty</th>
                          <th className="py-2 px-3">Status</th>
                          <th className="py-2 px-3">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transfersOverview.recentTransfers.length === 0 ? (
                          <tr><td colSpan={5} className="py-4 text-center text-gray-500">No transfers</td></tr>
                        ) : (
                          transfersOverview.recentTransfers.map((t) => (
                            <tr key={t._id} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="py-2 px-3 text-gray-900">{t.fromFranchiseName} → {t.toFranchiseName}</td>
                              <td className="py-2 px-3 text-gray-700">{t.productName}</td>
                              <td className="py-2 px-3 tabular-nums">{t.quantity}</td>
                              <td className="py-2 px-3"><span className="capitalize text-gray-600">{t.status.replace('_', ' ')}</span></td>
                              <td className="py-2 px-3 text-gray-500">{t.transferDate ? new Date(t.transferDate).toLocaleDateString() : '—'}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Bottlenecks / pending transfers */}
                <div>
                  <h4 className="text-sm font-semibold text-amber-800 mb-3">Bottlenecks / pending transfers</h4>
                  <div className="overflow-x-auto rounded-lg border border-amber-200">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-amber-50 border-b border-amber-200 text-left text-amber-800 font-medium">
                          <th className="py-2 px-3">From → To</th>
                          <th className="py-2 px-3">Product</th>
                          <th className="py-2 px-3">Qty</th>
                          <th className="py-2 px-3">Status</th>
                          <th className="py-2 px-3">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transfersOverview.pendingTransfers.length === 0 ? (
                          <tr><td colSpan={5} className="py-4 text-center text-gray-500">No pending transfers</td></tr>
                        ) : (
                          transfersOverview.pendingTransfers.map((t) => (
                            <tr key={t._id} className="border-b border-amber-100 hover:bg-amber-50">
                              <td className="py-2 px-3 text-gray-900">{t.fromFranchiseName} → {t.toFranchiseName}</td>
                              <td className="py-2 px-3 text-gray-700">{t.productName}</td>
                              <td className="py-2 px-3 tabular-nums">{t.quantity}</td>
                              <td className="py-2 px-3"><span className="capitalize font-medium text-amber-700">{t.status.replace('_', ' ')}</span></td>
                              <td className="py-2 px-3 text-gray-500">{t.transferDate ? new Date(t.transferDate).toLocaleDateString() : '—'}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Alerts & Insights */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Alerts & Insights
          </h3>
          <p className="text-sm text-gray-500 mb-4">Auto-generated insights for the selected period.</p>

          {loading ? (
            <div className="h-32 flex items-center justify-center text-gray-400">Loading insights…</div>
          ) : insights ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Loss-making franchises */}
              <div className="rounded-lg border border-red-200 bg-red-50/50 p-4">
                <h4 className="text-sm font-semibold text-red-800 flex items-center gap-2 mb-3">
                  <TrendingDown className="h-4 w-4" />
                  Loss-making franchises
                </h4>
                {insights.lossMakingFranchises.length === 0 ? (
                  <p className="text-sm text-gray-600">None in this period.</p>
                ) : (
                  <ul className="space-y-2">
                    {insights.lossMakingFranchises.map((f) => (
                      <li key={f.franchiseId}>
                        <button
                          type="button"
                          onClick={() => navigate(`/franchise/${f.franchiseId}`)}
                          className="text-left w-full text-sm text-red-900 hover:underline font-medium"
                        >
                          {f.franchiseName}
                        </button>
                        <p className="text-xs text-red-700 ml-0">Profit: {formatCurrency(f.profit)} · Revenue: {formatCurrency(f.revenue)}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Low-margin categories */}
              <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
                <h4 className="text-sm font-semibold text-amber-800 flex items-center gap-2 mb-3">
                  <PieChart className="h-4 w-4" />
                  Low-margin categories (&lt;10%)
                </h4>
                {insights.lowMarginCategories.length === 0 ? (
                  <p className="text-sm text-gray-600">None in this period.</p>
                ) : (
                  <ul className="space-y-2">
                    {insights.lowMarginCategories.map((c) => (
                      <li key={c.category} className="text-sm text-amber-900">
                        <span className="font-medium">{c.category}</span>
                        <span className="text-amber-700 ml-1">— Margin: {c.marginPercent.toFixed(1)}% · Revenue: {formatCurrency(c.revenue)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* High dead stock outlets */}
              <div className="rounded-lg border border-orange-200 bg-orange-50/50 p-4">
                <h4 className="text-sm font-semibold text-orange-800 flex items-center gap-2 mb-3">
                  <PackageX className="h-4 w-4" />
                  High dead stock outlets
                </h4>
                {insights.highDeadStockOutlets.length === 0 ? (
                  <p className="text-sm text-gray-600">None identified.</p>
                ) : (
                  <ul className="space-y-2">
                    {insights.highDeadStockOutlets.map((o) => (
                      <li key={o.franchiseId}>
                        <button
                          type="button"
                          onClick={() => navigate(`/franchise/${o.franchiseId}`)}
                          className="text-left w-full text-sm text-orange-900 hover:underline font-medium"
                        >
                          {o.franchiseName}
                        </button>
                        <p className="text-xs text-orange-700 ml-0">Dead stock: {formatCurrency(o.deadStockValue)} ({o.deadStockPercent.toFixed(0)}% of inventory)</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Sudden revenue drops */}
              <div className="rounded-lg border border-rose-200 bg-rose-50/50 p-4">
                <h4 className="text-sm font-semibold text-rose-800 flex items-center gap-2 mb-3">
                  <TrendingDown className="h-4 w-4" />
                  Sudden revenue drops (≥25% vs prior week)
                </h4>
                {insights.suddenRevenueDrops.length === 0 ? (
                  <p className="text-sm text-gray-600">None in the last 7 days.</p>
                ) : (
                  <ul className="space-y-2">
                    {insights.suddenRevenueDrops.map((d) => (
                      <li key={d.franchiseId}>
                        <button
                          type="button"
                          onClick={() => navigate(`/franchise/${d.franchiseId}`)}
                          className="text-left w-full text-sm text-rose-900 hover:underline font-medium"
                        >
                          {d.franchiseName}
                        </button>
                        <p className="text-xs text-rose-700 ml-0">Drop: {d.dropPercent.toFixed(0)}% · This week: {formatCurrency(d.currentRevenue)} vs prev: {formatCurrency(d.previousRevenue)}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
