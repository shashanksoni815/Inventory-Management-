import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Download,
  Calendar,
  Package,
  DollarSign,
  PieChart,
  Eye,
  Printer,
} from 'lucide-react';
import { DateRangePicker } from '@/components/Common/DateRangePicker';
import { exportApi } from '@/services/api';
import { cn } from '@/lib/utils';

const REPORT_COLORS = {
  sales: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    icon: 'text-blue-600',
    iconBg: 'bg-blue-100',
  },
  inventory: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    icon: 'text-green-600',
    iconBg: 'bg-green-100',
  },
  profit: {
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    icon: 'text-purple-600',
    iconBg: 'bg-purple-100',
  },
};

const Reports: React.FC = () => {
  const [selectedReport, setSelectedReport] =
    useState<'sales' | 'inventory' | 'profit'>('sales');

  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    endDate: new Date(),
  });

  const [exportFormat, setExportFormat] =
    useState<'excel' | 'pdf' | 'csv'>('excel');

  const handleExport = useCallback(async () => {
    try {
      const params = {
        startDate: dateRange.startDate.toISOString(),
        endDate: dateRange.endDate.toISOString(),
        format: exportFormat,
      };

      let blob;
      if (selectedReport === 'sales') {
        blob = await exportApi.exportSales(params);
      } else if (selectedReport === 'inventory') {
        blob = await exportApi.exportInventory(params);
      }

      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${selectedReport}-report.${exportFormat === 'excel' ? 'xlsx' : exportFormat}`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Export failed', err);
    }
  }, [selectedReport, dateRange, exportFormat]);

  const metrics = [
    { label: 'Total Revenue', value: '₹45,231.89', change: '+20.1%', trend: 'up' },
    { label: 'Total Profit', value: '₹12,567.43', change: '+15.3%', trend: 'up' },
    { label: 'Avg Order Value', value: '₹124.50', change: '+2.4%', trend: 'up' },
    { label: 'Conversion Rate', value: '3.2%', change: '-0.5%', trend: 'down' },
  ];

  return (
    <div className="bg-slate-50 p-6 min-h-screen">
      {/* Header */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Analytics & Reports</h1>
            <p className="text-slate-600 mt-1">
              Generate detailed reports and business insights
            </p>
          </div>
          <div className="flex gap-2">
            <button className="btn-outline">
              <Printer className="w-4 h-4" /> Print
            </button>
            <button className="btn-outline">
              <Eye className="w-4 h-4" /> Preview
            </button>
          </div>
        </div>
      </motion.div>

      {/* Report Selector */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {(['sales', 'inventory', 'profit'] as const).map((type) => {
          const Icon =
            type === 'sales' ? BarChart3 :
            type === 'inventory' ? Package :
            DollarSign;

          const active = selectedReport === type;
          const colors = REPORT_COLORS[type];

          return (
            <button
              key={type}
              onClick={() => setSelectedReport(type)}
              className={cn(
                'rounded-xl border p-5 text-left transition',
                active
                  ? `${colors.bg} ${colors.border}`
                  : 'bg-white border-slate-200 hover:bg-slate-50'
              )}
            >
              <div className="flex gap-4 items-center">
                <div className={cn('p-3 rounded-lg', colors.iconBg)}>
                  <Icon className={cn('w-6 h-6', colors.icon)} />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 capitalize">
                    {type} Report
                  </h3>
                  <p className="text-sm text-slate-600">
                    Detailed {type} insights
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Controls */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6 flex flex-wrap gap-4 justify-between">
        <div className="flex items-center gap-3">
          <Calendar className="w-4 h-4 text-slate-400" />
          <DateRangePicker value={dateRange} onChange={setDateRange} />
        </div>

        <div className="flex gap-3">
          <select className="input">
            <option>All Categories</option>
          </select>

          <select
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value as any)}
            className="input"
          >
            <option value="excel">Excel</option>
            <option value="pdf">PDF</option>
            <option value="csv">CSV</option>
          </select>

          <button onClick={handleExport} className="btn-primary">
            <Download className="w-4 h-4" /> Export
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {metrics.map((m, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-sm text-slate-500">{m.label}</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{m.value}</p>
            <div
              className={cn(
                'mt-2 flex items-center gap-1 text-sm font-medium',
                m.trend === 'up' ? 'text-green-600' : 'text-red-600'
              )}
            >
              {m.trend === 'up' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              {m.change}
            </div>
          </div>
        ))}
      </div>

      {/* Preview Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h3 className="font-semibold text-slate-900 mb-4">Revenue Trend</h3>
          <div className="h-64 flex items-center justify-center bg-slate-100 rounded-lg">
            <BarChart3 className="w-10 h-10 text-slate-400" />
            <span className="ml-2 text-slate-500">Chart Preview</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h3 className="font-semibold text-slate-900 mb-4">
            Top Performing Categories
          </h3>
          <PieChart className="w-6 h-6 text-slate-400" />
        </div>
      </div>
    </div>
  );
};

export default Reports;
