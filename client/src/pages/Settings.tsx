import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Settings as SettingsIcon,
  Bell,
  DollarSign,
  FileText,
  Palette,
  RefreshCw,
  Save,
  Upload,
  Download,
  Shield,
  Keyboard,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const settingsSchema = z.object({
  businessName: z.string().min(1, 'Business name is required'),
  currency: z.string().min(1, 'Currency is required'),
  taxRate: z.number().min(0).max(100),
  lowStockThreshold: z.number().min(1),
  invoicePrefix: z.string().max(10),
  autoBackup: z.boolean(),
  dataRefreshInterval: z.number().min(5).max(300),
  emailNotifications: z.boolean(),
  smsNotifications: z.boolean(),
  theme: z.enum(['light', 'dark', 'auto']),
  defaultPaymentMethod: z.enum(['cash', 'card', 'upi', 'bank_transfer']),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState('general');
  const [isSaving, setIsSaving] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
    watch,
  } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      businessName: 'InventoryPro',
      currency: 'USD',
      taxRate: 10,
      lowStockThreshold: 10,
      invoicePrefix: 'INV',
      autoBackup: true,
      dataRefreshInterval: 30,
      emailNotifications: true,
      smsNotifications: false,
      theme: 'light',
      defaultPaymentMethod: 'card',
    },
  });

  const onSubmit = useCallback(async (data: SettingsFormData) => {
    setIsSaving(true);
    try {
      // Save settings to API
      console.log('Saving settings:', data);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      reset(data);
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setIsSaving(false);
    }
  }, [reset]);

  const tabs = [
    { id: 'general', label: 'General', icon: SettingsIcon },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'financial', label: 'Financial', icon: DollarSign },
    { id: 'invoices', label: 'Invoices', icon: FileText },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'backup', label: 'Backup', icon: Shield },
  ];

  // const shortcuts = [
  //   { key: 'Ctrl + K', description: 'Open search' },
  //   { key: 'Ctrl + N', description: 'New product' },
  //   { key: 'Ctrl + S', description: 'Save changes' },
  //   { key: 'Ctrl + E', description: 'Export data' },
  //   { key: 'Ctrl + P', description: 'Print report' },
  //   { key: 'Ctrl + /', description: 'Show shortcuts' },
  //   { key: 'Esc', description: 'Close modal' },
  //   { key: 'F5', description: 'Refresh data' },
  // ];

  return (
    <div className="min-h-0 bg-white p-3 sm:p-4 lg:p-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4 sm:mb-6 lg:mb-8"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Settings
            </h1>
            <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600">
              Configure your inventory management system
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button
              onClick={() => reset()}
              disabled={!isDirty}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 disabled:opacity-50 dark:border-gray-600"
            >
              Reset Changes
            </button>
            <button
              onClick={handleSubmit(onSubmit)}
              disabled={isSaving || !isDirty}
              className="flex items-center space-x-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isSaving ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
        {/* Tabs Sidebar */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:col-span-1"
        >
          <div className="rounded-xl border border-gray-200 bg-white">
            <nav className="space-y-1 p-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      flex w-full items-center space-x-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors
                      ${isActive
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-gray-700 hover:bg-gray-100'
                      }
                    `}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Keyboard Shortcuts */}
          {/* <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-6 rounded-xl border border-gray-200 bg-white p-6"
          >
            <div className="flex items-center space-x-2">
              <Keyboard className="h-5 w-5 text-gray-400" />
              <h3 className="font-semibold text-gray-900">
                Keyboard Shortcuts
              </h3>
            </div>
            <div className="mt-4 space-y-2">
              {shortcuts.map((shortcut, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between rounded-lg bg-gray-50 p-3"
                >
                  <kbd className="rounded bg-gray-200 px-2 py-1 font-mono text-sm dark:bg-gray-600">
                    {shortcut.key}
                  </kbd>
                  <span className="text-sm text-gray-600">
                    {shortcut.description}
                  </span>
                </div>
              ))}
            </div>
          </motion.div> */}
        </motion.div>

        {/* Settings Content */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-3"
        >
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-6">
              {/* General Settings */}
              {activeTab === 'general' && (
                <div className="rounded-xl border border-gray-200 bg-white p-6">
                  <h2 className="mb-6 text-xl font-semibold text-gray-900">
                    General Settings
                  </h2>
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Business Name *
                      </label>
                      <input
                        {...register('businessName')}
                        type="text"
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                      {errors.businessName && (
                        <p className="mt-1 text-sm text-red-600">
                          {errors.businessName.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Default Currency *
                      </label>
                      <select
                        {...register('currency')}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      >
                        <option value="INR">INR (₹)</option>
                        <option value="USD">USD ($)</option>
                        <option value="EUR">EUR (€)</option>
                        <option value="GBP">GBP (£)</option>
                        <option value="JPY">JPY (¥)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Data Refresh Interval (seconds) *
                      </label>
                      <input
                        {...register('dataRefreshInterval', { valueAsNumber: true })}
                        type="number"
                        min="5"
                        max="300"
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                      <p className="mt-1 text-sm text-gray-500">
                        How often dashboard data refreshes automatically
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Default Payment Method
                      </label>
                      <select
                        {...register('defaultPaymentMethod')}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      >
                        <option value="cash">Cash</option>
                        <option value="card">Credit Card</option>
                        <option value="upi">UPI</option>
                        <option value="bank_transfer">Bank Transfer</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Notification Settings */}
              {activeTab === 'notifications' && (
                <div className="rounded-xl border border-gray-200 bg-white p-6">
                  <h2 className="mb-6 text-xl font-semibold text-gray-900">
                    Notification Settings
                  </h2>
                  <div className="space-y-6">
                    <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
                      <div>
                        <h3 className="font-medium text-gray-900">
                          Email Notifications
                        </h3>
                        <p className="text-sm text-gray-500">
                          Receive notifications via email
                        </p>
                      </div>
                      <label className="relative inline-flex cursor-pointer items-center">
                        <input
                          type="checkbox"
                          {...register('emailNotifications')}
                          className="peer sr-only"
                        />
                        <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white dark:border-gray-600"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
                      <div>
                        <h3 className="font-medium text-gray-900">
                          SMS Notifications
                        </h3>
                        <p className="text-sm text-gray-500">
                          Receive urgent notifications via SMS
                        </p>
                      </div>
                      <label className="relative inline-flex cursor-pointer items-center">
                        <input
                          type="checkbox"
                          {...register('smsNotifications')}
                          className="peer sr-only"
                        />
                        <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white dark:border-gray-600"></div>
                      </label>
                    </div>

                    <div className="rounded-lg border border-gray-200 p-6">
                      <h3 className="mb-4 font-medium text-gray-900">
                        Alert Thresholds
                      </h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Low Stock Threshold *
                          </label>
                          <input
                            {...register('lowStockThreshold', { valueAsNumber: true })}
                            type="number"
                            min="1"
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          />
                          <p className="mt-1 text-sm text-gray-500">
                            Send alert when stock falls below this number
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Financial Settings */}
              {activeTab === 'financial' && (
                <div className="rounded-xl border border-gray-200 bg-white p-6">
                  <h2 className="mb-6 text-xl font-semibold text-gray-900">
                    Financial Settings
                  </h2>
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Tax Rate (%) *
                      </label>
                      <input
                        {...register('taxRate', { valueAsNumber: true })}
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                      {errors.taxRate && (
                        <p className="mt-1 text-sm text-red-600">
                          {errors.taxRate.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Default Profit Margin (%)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="1000"
                        defaultValue="30"
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                      <p className="mt-1 text-sm text-gray-500">
                        Suggested profit margin for new products
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Appearance Settings */}
              {activeTab === 'appearance' && (
                <div className="rounded-xl border border-gray-200 bg-white p-6">
                  <h2 className="mb-6 text-xl font-semibold text-gray-900">
                    Appearance Settings
                  </h2>
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-4">
                        Theme
                      </label>
                      <div className="grid grid-cols-3 gap-4">
                        {[
                          { id: 'light', label: 'Light', bg: 'bg-white', border: 'border-gray-300' },
                          { id: 'dark', label: 'Dark', bg: 'bg-gray-800', border: 'border-gray-600' },
                          { id: 'auto', label: 'Auto', bg: 'bg-gradient-to-r from-white to-gray-800', border: 'border-gray-400' },
                        ].map((theme) => (
                          <label
                            key={theme.id}
                            className={`
                              relative flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 p-4
                              ${watch('theme') === theme.id ? 'border-blue-500' : theme.border}
                            `}
                          >
                            <input
                              type="radio"
                              {...register('theme')}
                              value={theme.id}
                              className="sr-only"
                            />
                            <div className={`h-8 w-8 rounded-full ${theme.bg} mb-2`} />
                            <span className="text-sm font-medium">{theme.label}</span>
                            {watch('theme') === theme.id && (
                              <div className="absolute right-2 top-2 h-4 w-4 rounded-full bg-blue-500">
                                <div className="absolute inset-1 rounded-full bg-white" />
                              </div>
                            )}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-lg border border-gray-200 p-6">
                      <h3 className="mb-4 font-medium text-gray-900">
                        Dashboard Preferences
                      </h3>
                      <div className="space-y-4">
                        <label className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            defaultChecked
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">
                            Show animations
                          </span>
                        </label>
                        <label className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            defaultChecked
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">
                            Compact table view
                          </span>
                        </label>
                        <label className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">
                            Show grid lines in charts
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Backup & Restore */}
              {activeTab === 'backup' && (
                <div className="rounded-xl border border-gray-200 bg-white p-6">
                  <h2 className="mb-6 text-xl font-semibold text-gray-900">
                    Backup & Restore
                  </h2>
                  <div className="space-y-6">
                    <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
                      <div>
                        <h3 className="font-medium text-gray-900">
                          Automatic Backups
                        </h3>
                        <p className="text-sm text-gray-500">
                          Automatically backup data daily
                        </p>
                      </div>
                      <label className="relative inline-flex cursor-pointer items-center">
                        <input
                          type="checkbox"
                          {...register('autoBackup')}
                          className="peer sr-only"
                        />
                        <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white dark:border-gray-600"></div>
                      </label>
                    </div>

                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                      <div className="rounded-lg border border-gray-200 p-6">
                        <div className="flex items-center space-x-3">
                          <div className="rounded-lg bg-blue-100 p-3">
                            <Download className="h-6 w-6 text-blue-600" />
                          </div>
                          <div>
                            <h3 className="font-medium text-gray-900">
                              Backup Data
                            </h3>
                            <p className="text-sm text-gray-500">
                              Download complete database backup
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="mt-4 w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600"
                        >
                          Download Backup
                        </button>
                      </div>

                      <div className="rounded-lg border border-gray-200 p-6">
                        <div className="flex items-center space-x-3">
                          <div className="rounded-lg bg-green-100 p-3">
                            <Upload className="h-6 w-6 text-green-600 dark:text-green-400" />
                          </div>
                          <div>
                            <h3 className="font-medium text-gray-900">
                              Restore Data
                            </h3>
                            <p className="text-sm text-gray-500">
                              Upload and restore from backup file
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="mt-4 w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600"
                        >
                          Restore Backup
                        </button>
                      </div>
                    </div>

                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
                      <h3 className="font-semibold text-amber-800">
                        ⚠️ Important Notes
                      </h3>
                      <ul className="mt-2 space-y-2 text-sm text-amber-700">
                        <li>• Backups are encrypted and stored securely</li>
                        <li>• Restoring will overwrite existing data</li>
                        <li>• Keep backup files in a safe location</li>
                        <li>• Last backup: Today, 02:30 AM</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
};

export default Settings;
