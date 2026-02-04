import React from 'react';
import { motion } from 'framer-motion';
import { Package, Clock, TrendingDown, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DeadStockData } from '@/types';

interface DeadStockTableProps {
  data: DeadStockData[];
  loading?: boolean;
}

const DeadStockTable: React.FC<DeadStockTableProps> = ({
  data,
  loading = false,
}) => {
  const calculateDaysSinceLastSale = (lastSold?: string) => {
    if (!lastSold) return 'Never sold';
    const lastSoldDate = new Date(lastSold);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - lastSoldDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return `${diffDays} days`;
  };

  const getInventoryValue = (item: DeadStockData) => {
    return item.stockQuantity * item.buyingPrice;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div className="h-6 w-32 bg-gray-200 rounded animate-pulse mb-6" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="h-16 w-full bg-gray-100 rounded-lg animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">
            Dead Stock
          </h3>
          <div className="rounded-lg bg-green-100 p-2">
            <TrendingDown className="h-5 w-5 text-green-600" />
          </div>
        </div>
        <div className="text-center py-8">
          <Package className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-2 text-gray-500">
            No dead stock detected
          </p>
          <p className="text-sm text-gray-400 mt-1">
            All products have recent sales activity
          </p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="bg-white rounded-xl border border-gray-200 shadow-sm"
    >
      <div className="border-b border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Dead Stock Alert
            </h3>
            <p className="text-sm text-gray-500">
              Products with no sales in last 90 days
            </p>
          </div>
          <div className="rounded-lg bg-red-100 p-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Product
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Stock
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Last Sold
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Value
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {data.map((item, index) => {
              const daysSinceLastSale = calculateDaysSinceLastSale(item.lastSold);
              const inventoryValue = getInventoryValue(item);

              return (
                <motion.tr
                  key={item._id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="hover:bg-gray-50"
                >
                  <td className="whitespace-nowrap px-6 py-4">
                    <div>
                      <p className="font-medium text-gray-900">
                        {item.name}
                      </p>
                      <p className="text-sm text-gray-500">
                        {item.sku} • {item.category}
                      </p>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className="flex items-center">
                      <span
                        className={cn(
                          'mr-2 h-2 w-2 rounded-full',
                          item.stockQuantity === 0
                            ? 'bg-red-500'
                            : 'bg-amber-500'
                        )}
                      />
                      <span className="font-medium">{item.stockQuantity}</span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className="flex items-center text-sm">
                      <Clock className="mr-1 h-3 w-3 text-gray-400" />
                      {daysSinceLastSale}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">
                      ${inventoryValue.toLocaleString()}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <button className="text-sm font-medium text-blue-600 hover:text-blue-800">
                      Markdown →
                    </button>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="border-t border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Total dead stock value: $
            {data.reduce((sum, item) => sum + getInventoryValue(item), 0).toLocaleString()}
          </div>
          <button className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
            Create Clearance Sale
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default DeadStockTable;