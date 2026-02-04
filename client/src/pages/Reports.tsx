import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Download,
  Calendar,
  Filter,
  FileText,
  Package,
  DollarSign,
  PieChart,
  Eye,
  Printer,
} from 'lucide-react';
import { DateRangePicker } from '@/components/Common/DateRangePicker';
import { exportApi } from '@/services/api';
import { cn } from '@/lib/utils';

const Reports: React.FC = () => {
  const [selectedReport, setSelectedReport] = useState<'sales' | 'inventory' | 'profit'>('sales');
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    endDate: new Date(),
  });
  const [exportFormat, setExportFormat] = useState<'excel' | 'pdf' | 'csv'>('excel');

  const handleExport = useCallback(async () => {
    try {
      let blob;
      const params = {
        startDate: dateRange.startDate.toISOString(),
        endDate: dateRange.endDate.toISOString(),
        format: exportFormat,
      };

      switch (selectedReport) {
        case 'sales':
          blob = await exportApi.exportSales(params);
          break;
        case 'inventory':
          blob = await exportApi.exportInventory(params);
          break;
        case 'profit':
          // Handle profit export
          break;
      }

      if (blob) {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${selectedReport}-report.${exportFormat === 'excel' ? 'xlsx' : exportFormat}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Export failed:', error);
    }
  }, [selectedReport, dateRange, exportFormat]);

  const reportTypes = [
    {
      id: 'sales',
      name: 'Sales Report',
      description: 'Detailed sales analysis and trends',
      icon: BarChart3,
      color: 'blue',
    },
    {
      id: 'inventory',
      name: 'Inventory Report',
      description: 'Stock levels, valuation, and health',
      icon: Package,
      color: 'green',
    },
    {
      id: 'profit',
      name: 'Profit & Loss',
      description: 'Revenue, costs, and profitability analysis',
      icon: DollarSign,
      color: 'purple',
    },
  ];

  const metrics = [
    { label: 'Total Revenue', value: '$45,231.89', change: '+20.1%', trend: 'up' },
    { label: 'Total Profit', value: '$12,567.43', change: '+15.3%', trend: 'up' },
    { label: 'Avg Order Value', value: '$124.50', change: '+2.4%', trend: 'up' },
    { label: 'Conversion Rate', value: '3.2%', change: '-0.5%', trend: 'down' },
    { label: 'Inventory Turnover', value: '4.2x', change: '+0.8x', trend: 'up' },
    { label: 'Stockout Rate', value: '2.1%', change: '-1.2%', trend: 'down' },
  ];

  return (
    <div className="min-h-0 bg-white p-3 sm:p-4 lg:p-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4 sm:mb-6 lg:mb-8"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              Analytics & Reports
            </h1>
            <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600">
              Generate detailed reports and business insights
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button className="flex items-center space-x-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
              <Printer className="h-4 w-4" />
              <span>Print</span>
            </button>
            <button className="flex items-center space-x-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
              <Eye className="h-4 w-4" />
              <span>Preview</span>
            </button>
          </div>
        </div>
      </motion.div>

      {/* Report Type Selector - responsive */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="mb-6 lg:mb-8"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:grid-cols-3">
          {reportTypes.map((report) => {
            const Icon = report.icon;
            const isSelected = selectedReport === report.id;
            
            return (
              <button
                key={report.id}
                onClick={() => setSelectedReport(report.id as any)}
                className={cn(
                  'rounded-xl border p-6 text-left transition-all hover:shadow-md',
                  isSelected
                    ? `border-${report.color}-500 bg-${report.color}-50 dark:bg-${report.color}-900/20`
                    : 'border-gray-200 bg-white'
                )}
              >
                <div className="flex items-center space-x-3">
                  <div className={cn(
                    'rounded-lg p-3',
                    isSelected
                      ? `bg-${report.color}-100 dark:bg-${report.color}-900/30`
                      : 'bg-gray-100'
                  )}>
                    <Icon className={cn(
                      'h-6 w-6',
                      isSelected
                        ? `text-${report.color}-600 dark:text-${report.color}-400`
                        : 'text-gray-600'
                    )} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {report.name}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {report.description}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* Control Panel */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="mb-8 rounded-xl border border-gray-200 bg-white p-6"
      >
        <div className="flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-700">
                Date Range:
              </span>
            </div>
            <DateRangePicker
              value={dateRange}
              onChange={setDateRange}
            />
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <select className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:text-white">
                <option>All Categories</option>
                <option>Electronics</option>
                <option>Clothing</option>
                <option>Books</option>
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <FileText className="h-4 w-4 text-gray-400" />
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value as any)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:text-white"
              >
                <option value="excel">Excel (.xlsx)</option>
                <option value="pdf">PDF</option>
                <option value="csv">CSV</option>
              </select>
            </div>

            <button
              onClick={handleExport}
              className="flex items-center space-x-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Download className="h-4 w-4" />
              <span>Export Report</span>
            </button>
          </div>
        </div>
      </motion.div>

      {/* Key Metrics */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mb-8"
      >
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
          Key Performance Indicators
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {metrics.map((metric, index) => (
            <div
              key={index}
              className="rounded-xl border border-gray-200 bg-white p-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">
                    {metric.label}
                  </p>
                  <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
                    {metric.value}
                  </p>
                </div>
                <div className="flex items-center space-x-1">
                  {metric.trend === 'up' ? (
                    <TrendingUp className="h-4 w-4 text-green-600" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-600" />
                  )}
                  <span
                    className={cn(
                      'text-sm font-medium',
                      metric.trend === 'up'
                        ? 'text-green-600'
                        : 'text-red-600'
                    )}
                  >
                    {metric.change}
                  </span>
                </div>
              </div>
              <div className="mt-4">
                <div className="h-1 w-full overflow-hidden rounded-full bg-gray-200">
                  <div
                    className={cn(
                      'h-full rounded-full',
                      metric.trend === 'up'
                        ? 'bg-green-500'
                        : 'bg-red-500'
                    )}
                    style={{ width: '75%' }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Report Preview */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="grid grid-cols-1 gap-8 lg:grid-cols-2"
      >
        {/* Chart Preview */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Revenue Trend
            </h3>
            <div className="flex items-center space-x-2">
              <button className="rounded-lg bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700">
                Weekly
              </button>
              <button className="rounded-lg bg-blue-600 px-3 py-1 text-sm font-medium text-white">
                Monthly
              </button>
              <button className="rounded-lg bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700">
                Yearly
              </button>
            </div>
          </div>
          <div className="h-64">
            {/* Chart would go here */}
            <div className="flex h-full items-center justify-center rounded-lg bg-gray-100">
              <BarChart3 className="h-12 w-12 text-gray-400" />
              <span className="ml-2 text-gray-500">
                Chart Preview
              </span>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-blue-50 p-4">
              <p className="text-sm text-blue-600">
                Peak Revenue Day
              </p>
              <p className="text-xl font-bold text-blue-700 dark:text-blue-300">
                $8,456
              </p>
              <p className="text-xs text-blue-500">
                Friday, Dec 15
              </p>
            </div>
            <div className="rounded-lg bg-green-50 p-4">
              <p className="text-sm text-green-600">
                Avg Daily Revenue
              </p>
              <p className="text-xl font-bold text-green-700 dark:text-green-300">
                $3,456
              </p>
              <p className="text-xs text-green-500">
                Last 30 days
              </p>
            </div>
          </div>
        </div>

        {/* Data Table Preview */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Top Performing Categories
            </h3>
            <PieChart className="h-5 w-5 text-gray-400" />
          </div>
          <div className="space-y-4">
            {[
              { category: 'Electronics', revenue: 18432, profit: 5123, trend: 'up' },
              { category: 'Clothing', revenue: 12456, profit: 3214, trend: 'up' },
              { category: 'Books', revenue: 8456, profit: 2145, trend: 'stable' },
              { category: 'Home & Kitchen', revenue: 6543, profit: 1654, trend: 'down' },
              { category: 'Sports', revenue: 4321, profit: 987, trend: 'up' },
            ].map((item, index) => (
              <div
                key={index}
                className="flex items-center justify-between rounded-lg border border-gray-100 p-4 hover:bg-gray-50"
              >
                <div className="flex items-center space-x-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                    <span className="font-bold text-blue-600">
                      {index + 1}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {item.category}
                    </p>
                    <p className="text-sm text-gray-500">
                      Revenue: ${item.revenue.toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-green-600">
                    ${item.profit.toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-500">
                    Profit
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Insights & Recommendations */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mt-8"
      >
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Insights & Recommendations
          </h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start space-x-3">
                <div className="rounded-lg bg-amber-100 p-2">
                  <TrendingUp className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h4 className="font-semibold text-amber-800 dark:text-amber-400">
                    Growth Opportunity
                  </h4>
                  <p className="mt-1 text-sm text-amber-700">
                    Electronics category shows 25% higher profit margin than average.
                    Consider increasing inventory and marketing focus.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <div className="flex items-start space-x-3">
                <div className="rounded-lg bg-red-100 p-2">
                  <TrendingDown className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-red-800">
                    Risk Alert
                  </h4>
                  <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                    Home & Kitchen category profit declined by 15% this month.
                    Review pricing strategy and supplier costs.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-start space-x-3">
                <div className="rounded-lg bg-blue-100 p-2">
                  <BarChart3 className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-blue-800">
                    Seasonal Trend
                  </h4>
                  <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
                    Sports equipment sales typically increase by 40% during Q1.
                    Plan inventory buildup for upcoming season.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-green-200 bg-green-50 p-4">
              <div className="flex items-start space-x-3">
                <div className="rounded-lg bg-green-100 p-2">
                  <DollarSign className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-green-800">
                    Cash Flow Insight
                  </h4>
                  <p className="mt-1 text-sm text-green-700 dark:text-green-300">
                    Current inventory turnover is 4.2x, above industry average.
                    Consider optimizing stock levels to free up capital.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Reports;