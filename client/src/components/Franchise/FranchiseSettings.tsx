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
                  <label className="block text-sm font-medium text-gray-700 mb