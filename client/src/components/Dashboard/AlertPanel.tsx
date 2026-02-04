import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  TrendingDown,
  Package,
  TrendingUp,
  Bell,
  Check,
  Clock,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Alert } from '@/types';

const AlertPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all'); 

  // Mock alerts - in real app, fetch from API
  const [alerts, setAlerts] = useState<Alert[]>([
    {
      id: '1',
      type: 'low-stock',
      title: 'Low Stock Alert',
      message: 'iPhone 13 Pro has only 2 units left (min: 10)',
      severity: 'high',
      productId: '123',
      productName: 'iPhone 13 Pro',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      read: false,
      action: {
        label: 'Restock',
        onClick: () => console.log('Restock clicked'),
      },
    },
    {
      id: '2',
      type: 'profit-drop',
      title: 'Profit Drop Detected',
      message: 'Electronics category profit dropped 15% this week',
      severity: 'medium',
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      read: false,
    },
    {
      id: '3',
      type: 'dead-stock',
      title: 'Dead Stock Warning',
      message: '5 products have no sales in last 90 days',
      severity: 'low',
      timestamp: new Date(Date.now() - 86400000).toISOString(),
      read: true,
    },
    {
      id: '4',
      type: 'opportunity',
      title: 'High Margin Opportunity',
      message: 'Wireless Earbuds have 45% profit margin',
      severity: 'low',
      productId: '456',
      productName: 'Wireless Earbuds',
      timestamp: new Date(Date.now() - 172800000).toISOString(),
      read: true,
    },
  ]);

  const markAsRead = (id: string) => {
    setAlerts(alerts.map(alert =>
      alert.id === id ? { ...alert, read: true } : alert
    ));
  };

  const dismissAlert = (id: string) => {
    setAlerts(alerts.filter(alert => alert.id !== id));
  };

  const markAllAsRead = () => {
    setAlerts(alerts.map(alert => ({ ...alert, read: true })));
  };

  const filteredAlerts = alerts.filter(alert =>
    activeTab === 'all' ? true : !alert.read
  );

  const unreadCount = alerts.filter(alert => !alert.read).length;

  const getIcon = (type: Alert['type']) => {
    switch (type) {
      case 'low-stock':
        return Package;
      case 'profit-drop':
        return TrendingDown;
      case 'dead-stock':
        return AlertTriangle;
      case 'opportunity':
        return TrendingUp;
      default:
        return Bell;
    }
  };

  const getSeverityColor = (severity: Alert['severity']) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-500';
      case 'high':
        return 'bg-orange-500';
      case 'medium':
        return 'bg-yellow-500';
      case 'low':
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getSeverityText = (severity: Alert['severity']) => {
    switch (severity) {
      case 'critical':
        return 'text-red-700';
      case 'high':
        return 'text-orange-700';
      case 'medium':
        return 'text-yellow-700';
      case 'low':
        return 'text-blue-700';
      default:
        return 'text-gray-700';
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="border-b border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="rounded-lg bg-blue-100 p-2">
              <Bell className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Smart Alerts
              </h3>
              <p className="text-sm text-gray-500">
                {unreadCount} unread notifications
              </p>
            </div>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="rounded-lg bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-200"
            >
              Mark all as read
            </button>
          )}
        </div>
      </div>

      <div className="border-b border-gray-200">
        <div className="flex">
          <button
            onClick={() => setActiveTab('all')}
            className={cn(
              'flex-1 px-4 py-3 text-sm font-medium',
              activeTab === 'all'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            All Alerts
          </button>
          <button
            onClick={() => setActiveTab('unread')}
            className={cn(
              'flex-1 px-4 py-3 text-sm font-medium',
              activeTab === 'unread'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            Unread
            {unreadCount > 0 && (
              <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                {unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="max-h-[400px] overflow-y-auto p-2">
        <AnimatePresence>
          {filteredAlerts.length === 0 ? (
            <div className="p-8 text-center">
              <Bell className="mx-auto h-12 w-12 text-gray-300" />
              <p className="mt-2 text-gray-500">
                No {activeTab === 'unread' ? 'unread' : ''} alerts
              </p>
            </div>
          ) : (
            filteredAlerts.map((alert, index) => {
              const Icon = getIcon(alert.type);
              const timeAgo = new Date(alert.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: index * 0.05 }}
                  className={cn(
                    'relative rounded-lg p-4 transition-colors',
                    alert.read
                      ? 'bg-gray-50/50'
                      : 'bg-blue-50'
                  )}
                >
                  {!alert.read && (
                    <div className="absolute left-2 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-blue-500" />
                  )}

                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      <div
                        className={cn(
                          'mt-1 rounded-lg p-2',
                          getSeverityColor(alert.severity)
                        )}
                      >
                        <Icon className="h-4 w-4 text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <h4
                            className={cn(
                              'font-semibold',
                              getSeverityText(alert.severity)
                            )}
                          >
                            {alert.title}
                          </h4>
                          <span
                            className={cn(
                              'rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                              getSeverityText(alert.severity),
                              alert.severity === 'critical'
                                ? 'bg-red-100'
                                : alert.severity === 'high'
                                ? 'bg-orange-100'
                                : alert.severity === 'medium'
                                ? 'bg-yellow-100'
                                : 'bg-blue-100'
                            )}
                          >
                            {alert.severity}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-gray-600">
                          {alert.message}
                        </p>
                        {alert.productName && (
                          <p className="mt-1 text-xs text-gray-500">
                            Product: {alert.productName}
                          </p>
                        )}
                        <div className="mt-2 flex items-center space-x-4">
                          <span className="flex items-center text-xs text-gray-500">
                            <Clock className="mr-1 h-3 w-3" />
                            {timeAgo}
                          </span>
                          {alert.action && (
                            <button
                              onClick={alert.action.onClick}
                              className="text-xs font-medium text-blue-600 hover:text-blue-800"
                            >
                              {alert.action.label} →
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1">
                      {!alert.read && (
                        <button
                          onClick={() => markAsRead(alert.id)}
                          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                          title="Mark as read"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => dismissAlert(alert.id)}
                        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600"
                        title="Dismiss"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>

      <div className="border-t border-gray-200 p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">
            Alert Settings
          </span>
          <button className="font-medium text-blue-600 hover:text-blue-800">
            Configure
          </button>
        </div>
      </div>
    </div>
  );
};

export default AlertPanel;