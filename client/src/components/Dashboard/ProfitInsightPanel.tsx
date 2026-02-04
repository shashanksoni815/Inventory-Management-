import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, PieChart, AlertTriangle, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProfitInsight {
  id: string;
  type: 'increase' | 'decrease' | 'opportunity' | 'warning';
  title: string;
  description: string;
  value: number;
  change: number;
  action?: string;
}

const ProfitInsightPanel: React.FC = () => {
  const insights: ProfitInsight[] = [
    {
      id: '1',
      type: 'increase',
      title: 'Electronics Margin Surge',
      description: 'Profit margin increased by 15% this week due to bulk discounts from suppliers',
      value: 42.5,
      change: 15.2,
      action: 'Consider increasing stock',
    },
    {
      id: '2',
      type: 'decrease',
      title: 'Clothing Category Decline',
      description: 'Seasonal items not moving, consider markdown strategy',
      value: 18.3,
      change: -8.5,
      action: 'Plan clearance sale',
    },
    {
      id: '3',
      type: 'opportunity',
      title: 'High Margin Opportunity',
      description: 'Accessories showing 65% average profit margin',
      value: 65.2,
      change: 25.4,
      action: 'Expand product range',
    },
    {
      id: '4',
      type: 'warning',
      title: 'Low Profit Alert',
      description: '3 products with negative profit margin detected',
      value: -5.2,
      change: -12.3,
      action: 'Review pricing',
    },
  ];

  const getIcon = (type: ProfitInsight['type']) => {
    switch (type) {
      case 'increase':
        return TrendingUp;
      case 'decrease':
        return TrendingDown;
      case 'opportunity':
        return Lightbulb;
      case 'warning':
        return AlertTriangle;
    }
  };

  const getColor = (type: ProfitInsight['type']) => {
    switch (type) {
      case 'increase':
        return 'text-green-600 bg-green-100';
      case 'decrease':
        return 'text-red-600 bg-red-100';
      case 'opportunity':
        return 'text-blue-600 bg-blue-100';
      case 'warning':
        return 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30';
    }
  };

  const getBorderColor = (type: ProfitInsight['type']) => {
    switch (type) {
      case 'increase':
        return 'border-green-200';
      case 'decrease':
        return 'border-red-200';
      case 'opportunity':
        return 'border-blue-200';
      case 'warning':
        return 'border-amber-200';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 shadow-sm">
      <div className="border-b border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-900/30">
              <PieChart className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Profit Insights
              </h3>
              <p className="text-sm text-gray-500">
                AI-powered profit analysis
              </p>
            </div>
          </div>
          <span className="text-sm text-gray-500">
            Updated just now
          </span>
        </div>
      </div>

      <div className="p-6">
        <div className="space-y-4">
          {insights.map((insight, index) => {
            const Icon = getIcon(insight.type);
            
            return (
              <motion.div
                key={insight.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className={cn(
                  'rounded-lg border p-4 transition-all hover:shadow-md',
                  getBorderColor(insight.type)
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <div className={cn('mt-1 rounded-lg p-2', getColor(insight.type))}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h4 className="font-medium text-gray-900 dark:text-white">
                          {insight.title}
                        </h4>
                        <span className={cn(
                          'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                          getColor(insight.type)
                        )}>
                          {insight.value.toFixed(1)}%
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-gray-600">
                        {insight.description}
                      </p>
                      {insight.action && (
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-xs text-gray-500">
                            Suggested action
                          </span>
                          <button className="text-xs font-medium text-blue-600 hover:text-blue-800">
                            {insight.action} →
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={cn(
                      'text-sm font-bold',
                      insight.change >= 0
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600'
                    )}>
                      {insight.change >= 0 ? '+' : ''}{insight.change}%
                    </span>
                    <p className="text-xs text-gray-500">
                      Change
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">
              4 insights generated
            </div>
            <button className="text-sm font-medium text-blue-600 hover:text-blue-800">
              View all insights →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfitInsightPanel;