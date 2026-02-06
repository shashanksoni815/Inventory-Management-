import React from 'react';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
// import { cn } from '@/lib/utils';

interface KpiCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  trend?: number;
  description?: string;
  format?: 'currency' | 'number' | 'percent' | 'percentage';
  loading?: boolean;
  color?: 'default' | 'profit' | 'loss' | 'warning';
}

const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  icon: Icon,
  trend,
  description,
  format = 'number',
  loading = false,
  color = 'default',
}) => {
  const formatValue = (val: number | string) => {
    if (typeof val === 'string') return val;
    
    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(val);
      case 'percent':
        return `${val.toFixed(2)}%`;
      case 'percentage':
        return `${val.toFixed(2)}%`;
      default:
        return val.toLocaleString();
    }
  };

  const colorClasses = {
    default: 'bg-white border-gray-200',
    profit: 'bg-green-50 border-green-200',
    loss: 'bg-red-50 border-red-200',
    warning: 'bg-amber-50 border-amber-200',
  };

  const iconColors = {
    default: 'text-gray-600',
    profit: 'text-green-600',
    loss: 'text-red-600',
    warning: 'text-amber-600',
  };

  if (loading) {
    return (
        <div className={`rounded-xl border p-6 shadow-sm ${colorClasses[color]}`}
      >
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
            <div className="h-8 w-32 bg-gray-300 rounded animate-pulse" />
          </div>
          <div className="h-10 w-10 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border p-6 shadow-sm transition-all hover:shadow-md ${colorClasses[color]}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">
            {title}
          </p>
          <motion.p
            key={value}
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            className="mt-2 text-3xl font-bold text-gray-900"
          >
            {formatValue(value)}
          </motion.p>
          {trend !== undefined && (
            <div className="mt-2 flex items-center space-x-1">
              <span
                className={`text-sm font-medium ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}
              >
                {trend >= 0 ? "↗" : "↘"} {Math.abs(trend)}%
              </span>
              <span className="text-sm text-gray-500">
                vs last period
              </span>
            </div>
          )}
          {description && (
            <p className="mt-2 text-sm text-gray-500">
              {description}
            </p>
          )}
        </div>
        <div className={`rounded-lg p-3 ${color === 'default' ? 'bg-gray-100' : color === 'profit' ? 'bg-green-100' : color === 'loss' ? 'bg-red-100' : 'bg-amber-100'}`}
        >
          <Icon className={`h-6 w-6 ${iconColors[color]}`} />
        </div>
      </div>
    </motion.div>
  );
};

export default KpiCard;