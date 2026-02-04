import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { motion } from 'framer-motion';
import type { SalesTrendData, ProfitCategoryData, TopProductData } from '@/types';   

interface SalesChartProps {
  data: SalesTrendData[];
  type: 'line' | 'bar';
  title: string;
  loading?: boolean;
}

interface ProfitChartProps {
  data: ProfitCategoryData[];
  title: string;
  loading?: boolean;
}

interface TopProductsChartProps {
  data: TopProductData[];
  title: string;
  loading?: boolean;
}

export const SalesChart: React.FC<SalesChartProps> = ({
  data,
  type = 'line',
  title,
  loading = false,
}) => {
  const chartData = useMemo(() => {
    return data.map(item => ({
      ...item,
      formattedDate: new Date(item.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
    }));
  }, [data]);

  if (loading) {
    return (
      <div className="h-80 w-full bg-gray-100 rounded-lg animate-pulse" />
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm"
    >
      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          {title}
        </h3>
        <div className="flex items-center space-x-2">
          <button className="px-3 py-1 text-sm font-medium rounded-lg bg-gray-100 text-gray-900 hover:bg-gray-200">
            7D
          </button>
          <button className="px-3 py-1 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700">
            30D
          </button>
          <button className="px-3 py-1 text-sm font-medium rounded-lg bg-gray-100 text-gray-900 hover:bg-gray-200">
            1Y
          </button>
        </div>
      </div>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          {type === 'line' ? (
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey="formattedDate" 
                stroke="#9CA3AF"
                fontSize={12}
              />
              <YAxis 
                stroke="#9CA3AF"
                fontSize={12}
                tickFormatter={(value: number | undefined) => `$${((value ?? 0) / 1000)}k`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #E5E7EB',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                }}
                formatter={(value: number | undefined) => [
                  `$${(value ?? 0).toLocaleString()}`,
                  'Revenue',
                ]}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#3B82F6"
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="profit"
                stroke="#10B981"
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          ) : (
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey="formattedDate" 
                stroke="#9CA3AF"
                fontSize={12}
              />
              <YAxis 
                stroke="#9CA3AF"
                fontSize={12}
                tickFormatter={(value: number | undefined) => `$${((value ?? 0) / 1000)}k`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #E5E7EB',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                }}
                formatter={(value: number | undefined) => [
                  `$${(value ?? 0).toLocaleString()}`,
                  'Revenue',
                ]}
              />
              <Legend />
              <Bar dataKey="revenue" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="profit" fill="#10B981" radius={[4, 4, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-4">
        <div className="text-center">
          <p className="text-sm text-gray-500">Total Revenue</p>
          <p className="text-2xl font-bold text-gray-900">
            ${data.reduce((sum, item) => sum + item.revenue, 0).toLocaleString()}
          </p>
        </div>
        <div className="text-center">
          <p className="text-sm text-gray-500">Total Profit</p>
          <p className="text-2xl font-bold text-green-600">
            ${data.reduce((sum, item) => sum + item.profit, 0).toLocaleString()}
          </p>
        </div>
        <div className="text-center">
          <p className="text-sm text-gray-500">Avg Order</p>
          <p className="text-2xl font-bold text-gray-900">
            ${(data.reduce((sum, item) => sum + item.revenue, 0) / data.reduce((sum, item) => sum + item.orders, 1) || 0).toFixed(0)}
          </p>
        </div>
      </div>
    </motion.div>
  );
};

export const ProfitChart: React.FC<ProfitChartProps> = ({
  data,
  title,
  loading = false,
}) => {
  const formattedData = useMemo(() => {
    return data.map(item => ({
      ...item,
      profitColor: item.profit >= 0 ? '#10B981' : '#EF4444',
    }));
  }, [data]);

  if (loading) {
    return (
      <div className="h-80 w-full bg-gray-100 rounded-lg animate-pulse" />
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm"
    >
      <h3 className="mb-6 text-lg font-semibold text-gray-900">
        {title}
      </h3>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={formattedData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis 
              dataKey="category" 
              stroke="#9CA3AF"
              fontSize={12}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis 
              stroke="#9CA3AF"
              fontSize={12}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #E5E7EB',
                borderRadius: '8px',
              }}
              formatter={(value: number | undefined, name: string | undefined) => {
                const v = value ?? 0;
                if (name === 'profit') {
                  return [`$${v.toLocaleString()}`, 'Profit'];
                }
                return [`$${v.toLocaleString()}`, 'Revenue'];
              }}
            />
            <Legend />
            <Bar 
              dataKey="profit" 
              fill="#10B981"
              radius={[4, 4, 0, 0]}
              name="Profit"
            />
            <Bar 
              dataKey="revenue" 
              fill="#3B82F6"
              radius={[4, 4, 0, 0]}
              name="Revenue"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
};

export const TopProductsChart: React.FC<TopProductsChartProps> = ({
  data,
  title,
  loading = false,
}) => {
  const COLORS = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444'];

  if (loading) {
    return (
      <div className="h-80 w-full bg-gray-100 rounded-lg animate-pulse" />
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm"
    >
      <h3 className="mb-6 text-lg font-semibold text-gray-900">
        {title}
      </h3>

      <div className="space-y-4">
        {data.map((product, index) => (
          <div
            key={product.sku}
            className="flex items-center justify-between p-4 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-lg"
                style={{ backgroundColor: COLORS[index % COLORS.length] + '20' }}
              >
                <span
                  className="text-lg font-semibold"
                  style={{ color: COLORS[index % COLORS.length] }}
                >
                  {index + 1}
                </span>
              </div>
              <div>
                <p className="font-medium text-gray-900">
                  {product.name}
                </p>
                <p className="text-sm text-gray-500">
                  SKU: {product.sku} • Sold: {product.quantitySold}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-bold text-gray-900">
                ${product.revenue.toLocaleString()}
              </p>
                <p className={`text-sm font-medium ${product.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}
              >
                Profit: ${product.profit.toLocaleString()}
              </p>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
};