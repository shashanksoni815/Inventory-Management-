import React from 'react';
import { motion } from 'framer-motion';
import {
  Plus,
  Download,
  Upload,
  RefreshCw,
  Package,
  ShoppingCart,
  BarChart3,
  Settings,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const QuickActions: React.FC = () => {
  const navigate = useNavigate();

  const actions = [
    {
      icon: Plus,
      label: 'Add Product',
      description: 'Create new product',
      color: 'bg-blue-500',
      onClick: () => navigate('/products?action=create'),
    },
    {
      icon: ShoppingCart,
      label: 'New Sale',
      description: 'Process a sale',
      color: 'bg-green-500',
      onClick: () => navigate('/sales?action=create'),
    },
    {
      icon: Download,
      label: 'Export Data',
      description: 'Download reports',
      color: 'bg-purple-500',
      onClick: () => console.log('Export data'),
    },
    {
      icon: Upload,
      label: 'Import Data',
      description: 'Bulk upload',
      color: 'bg-amber-500',
      onClick: () => console.log('Import data'),
    },
    {
      icon: RefreshCw,
      label: 'Refresh',
      description: 'Sync latest data',
      color: 'bg-indigo-500',
      onClick: () => window.location.reload(),
    },
    {
      icon: BarChart3,
      label: 'Reports',
      description: 'View analytics',
      color: 'bg-pink-500',
      onClick: () => navigate('/reports'),
    },
    {
      icon: Package,
      label: 'Inventory',
      description: 'Manage stock',
      color: 'bg-teal-500',
      onClick: () => navigate('/products'),
    },
    {
      icon: Settings,
      label: 'Settings',
      description: 'Configure system',
      color: 'bg-gray-500',
      onClick: () => navigate('/settings'),
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-8">
      {actions.map((action, index) => {
        const Icon = action.icon;
        
        return (
          <motion.button
            key={index}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
            onClick={action.onClick}
            className="group flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white p-4 transition-all hover:scale-105 hover:border-blue-500 hover:bg-blue-50 hover:shadow-md"
          >
            <div className={`${action.color} mb-2 rounded-lg p-2 group-hover:scale-110 transition-transform`}>
              <Icon className="h-5 w-5 text-white" />
            </div>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {action.label}
            </span>
            <span className="mt-1 text-xs text-gray-500">
              {action.description}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
};

export default QuickActions;