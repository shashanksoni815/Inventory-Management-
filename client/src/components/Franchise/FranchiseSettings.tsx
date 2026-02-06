import React, { useState } from 'react';
import {
  Settings,
  Save,
  RefreshCw,
  Building,
  MapPin,
  Phone,
  Mail,
  Globe,
  DollarSign,
  Clock,
  Users,
  Shield,
  AlertCircle
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { franchiseApi } from '../../services/api';
import { useFranchise } from '../../contexts/FranchiseContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { Switch } from '../ui/Switch';
import { Badge } from '../ui/Badge';

const FranchiseSettings: React.FC = () => {
  const { currentFranchise } = useFranchise();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('general');

  const { data: franchiseData, isLoading } = useQuery({
    queryKey: ['franchise-settings', currentFranchise?._id],
    queryFn: () => franchiseApi.getById(currentFranchise?._id!),
    enabled: !!currentFranchise?._id,
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => 
      franchiseApi.update(currentFranchise?._id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['franchise-settings'] });
      queryClient.invalidateQueries({ queryKey: ['franchises'] });
    }
  });

  const franchise = franchiseData?.data;

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
                <div className="space-y-3">
                  {[...Array(4)].map((_, j) => (
                    <div key={j} className="h-3 bg-gray-200 rounded"></div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!franchise) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">Franchise not found</h3>
          <p className="text-gray-600 mt-1">Unable to load franchise settings.</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'general', label: 'General', icon: Building },
    { id: 'contact', label: 'Contact', icon: Phone },
    { id: 'settings', label: 'Business Settings', icon: Settings },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'integrations', label: 'Integrations', icon: RefreshCw }
  ];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Franchise Settings</h1>
          <p className="text-gray-600">Manage settings for {franchise.name}</p>
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            onClick={() => updateMutation.mutate({})}
            loading={updateMutation.isPending}
          >
            <Save className="h-4 w-4 mr-2" />
            Save Changes
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm
                  ${activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                <Icon className="h-5 w-5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Settings Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* General Settings */}
          {activeTab === 'general' && (
            <Card className="p-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-6">General Information</h4>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Franchise Name
                    </label>
                    <Input
                      defaultValue={franchise.name}
                      placeholder="Enter franchise name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Franchise Code
                    </label>
                    <Input
                      defaultValue={franchise.code}
                      placeholder="Enter franchise code"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Location
                  </label>
                  <Input
                    defaultValue={franchise.location}
                    placeholder="Enter location"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Manager
                  </label>
                  <Input
                    defaultValue={franchise.manager}
                    placeholder="Enter manager name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <Select
                    defaultValue={franchise.status}
                    options={[
                      { value: 'active', label: 'Active' },
                      { value: 'inactive', label: 'Inactive' },
                      { value: 'maintenance', label: 'Maintenance' }
                    ]}
                  />
                </div>

                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <div 
                      className="h-8 w-8 rounded-lg"
                      style={{ backgroundColor: franchise.metadata?.color || '#3B82F6' }}
                    />
                    <span className="text-sm text-gray-600">Color</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-2xl">{franchise.metadata?.icon || '🏪'}</span>
                    <span className="text-sm text-gray-600">Icon</span>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Contact Settings */}
          {activeTab === 'contact' && (
            <Card className="p-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-6">Contact Information</h4>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address
                    </label>
                    <Input
                      type="email"
                      defaultValue={franchise.contact?.email}
                      placeholder="contact@franchise.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number
                    </label>
                    <Input
                      defaultValue={franchise.contact?.phone}
                      placeholder="+1 (555) 123-4567"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Address
                  </label>
                  <Textarea
                    defaultValue={franchise.contact?.address}
                    placeholder="Enter full address"
                    rows={3}
                  />
                </div>
              </div>
            </Card>
          )}

          {/* Business Settings */}
          {activeTab === 'settings' && (
            <Card className="p-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-6">Business Settings</h4>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Currency
                    </label>
                    <Select
                      defaultValue={franchise.settings?.currency}
                      options={[
                        { value: 'USD', label: 'US Dollar (USD)' },
                        { value: 'EUR', label: 'Euro (EUR)' },
                        { value: 'GBP', label: 'British Pound (GBP)' },
                        { value: 'CAD', label: 'Canadian Dollar (CAD)' },
                        { value: 'AUD', label: 'Australian Dollar (AUD)' }
                      ]}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tax Rate (%)
                    </label>
                    <Input
                      type="number"
                      defaultValue={franchise.settings?.taxRate}
                      placeholder="8.5"
                      min="0"
                      max="100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Opening Hours
                    </label>
                    <Input
                      defaultValue={franchise.settings?.openingHours}
                      placeholder="9:00 AM - 6:00 PM"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Timezone
                    </label>
                    <Select
                      defaultValue={franchise.settings?.timezone}
                      options={[
                        { value: 'America/New_York', label: 'Eastern Time (ET)' },
                        { value: 'America/Chicago', label: 'Central Time (CT)' },
                        { value: 'America/Denver', label: 'Mountain Time (MT)' },
                        { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
                        { value: 'Europe/London', label: 'London (GMT)' },
                        { value: 'Europe/Paris', label: 'Paris (CET)' }
                      ]}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h5 className="text-sm font-medium text-gray-700">Inventory Settings</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Default Reorder Point
                      </label>
                      <Input
                        type="number"
                        defaultValue="10"
                        min="1"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Default Reorder Quantity
                      </label>
                      <Input
                        type="number"
                        defaultValue="50"
                        min="1"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Security Settings */}
          {activeTab === 'security' && (
            <Card className="p-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-6">Security & Permissions</h4>
              <div className="space-y-6">
                <div className="space-y-4">
                  <h5 className="text-sm font-medium text-gray-700">Access Control</h5>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-900">Allow Stock Transfers</div>
                        <div className="text-sm text-gray-500">Enable inventory transfers between franchises</div>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-900">Allow Product Sharing</div>
                        <div className="text-sm text-gray-500">Enable sharing products with other franchises</div>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-900">Require Approval for Transfers</div>
                        <div className="text-sm text-gray-500">All transfers require manager approval</div>
                      </div>
                      <Switch />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h5 className="text-sm font-medium text-gray-700">Data Access</h5>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-900">Show Network Analytics</div>
                        <div className="text-sm text-gray-500">Allow viewing other franchise performance</div>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-900">Export Data</div>
                        <div className="text-sm text-gray-500">Allow exporting franchise data</div>
                      </div>
                      <Switch defaultChecked />
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* Right Column - Summary & Info */}
        <div className="space-y-6">
          {/* Franchise Summary */}
          <Card className="p-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">Franchise Summary</h4>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Status</span>
                <Badge variant={
                  franchise.status === 'active' ? 'success' :
                  franchise.status === 'inactive' ? 'danger' : 'warning'
                }>
                  {franchise.status}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Code</span>
                <span className="font-medium">{franchise.code}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Manager</span>
                <span className="font-medium">{franchise.manager}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Created</span>
                <span className="font-medium">
                  {new Date(franchise.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Last Updated</span>
                <span className="font-medium">
                  {new Date(franchise.updatedAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </Card>

          {/* Quick Actions */}
          <Card className="p-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h4>
            <div className="space-y-3">
              <Button variant="outline" className="w-full justify-start">
                <Users className="h-4 w-4 mr-2" />
                Manage Staff
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <DollarSign className="h-4 w-4 mr-2" />
                View Financial Reports
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Clock className="h-4 w-4 mr-2" />
                View Activity Log
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Globe className="h-4 w-4 mr-2" />
                Network Settings
              </Button>
            </div>
          </Card>

          {/* Danger Zone */}
          <Card className="p-6 border-red-200 bg-red-50">
            <h4 className="text-lg font-semibold text-red-900 mb-4">Danger Zone</h4>
            <div className="space-y-3">
              <p className="text-sm text-red-700">
                These actions are irreversible. Please proceed with caution.
              </p>
              <div className="space-y-2">
                <Button variant="danger" className="w-full">
                  Deactivate Franchise
                </Button>
                <Button variant="danger" className="w-full">
                  Reset All Data
                </Button>
                <Button variant="danger" className="w-full">
                  Delete Franchise
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default FranchiseSettings;