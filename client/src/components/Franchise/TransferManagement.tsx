import React, { useState } from 'react';
import {
  Truck,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  Search,
  Filter,
  Download,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { transferApi } from '../../services/api';
import { useFranchise } from '../../contexts/FranchiseContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import TransferDetailsModal from './TransferDetailsModal';

const TransferManagement: React.FC = () => {
  const { currentFranchise, isNetworkView } = useFranchise();
  const [filters, setFilters] = useState({
    status: 'all',
    search: '',
    direction: 'all',
    page: 1,
    limit: 20
  });
  const [selectedTransfer, setSelectedTransfer] = useState<any>(null);

  const { data: transfers, isLoading } = useQuery({
    queryKey: ['transfers', currentFranchise?._id, filters],
    queryFn: () => transferApi.getAll({
      franchise: currentFranchise?._id,
      ...filters
    }),
    enabled: !isNetworkView,
  });

  const transferList = transfers?.data || [];
  const pagination = transfers?.pagination;

  const handleFilterChange = (key: string, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      'pending': { color: 'yellow', icon: Clock },
      'approved': { color: 'blue', icon: Clock },
      'in_transit': { color: 'purple', icon: Truck },
      'completed': { color: 'green', icon: CheckCircle },
      'rejected': { color: 'red', icon: XCircle },
      'cancelled': { color: 'gray', icon: XCircle }
    };

    const config = variants[status] || { color: 'gray', icon: AlertCircle };
    const Icon = config.icon;

    return (
      <Badge variant={config.color as any} className="capitalize">
        <Icon className="h-3 w-3 mr-1" />
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  const getDirectionBadge = (transfer: any) => {
    const isOutgoing = transfer.fromFranchise?._id === currentFranchise?._id;
    const isIncoming = transfer.toFranchise?._id === currentFranchise?._id;

    if (isOutgoing) {
      return (
        <Badge variant="outline" className="border-red-300 text-red-700">
          <ArrowUpRight className="h-3 w-3 mr-1" />
          Outgoing
        </Badge>
      );
    }

    if (isIncoming) {
      return (
        <Badge variant="outline" className="border-green-300 text-green-700">
          <ArrowDownRight className="h-3 w-3 mr-1" />
          Incoming
        </Badge>
      );
    }

    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Stock Transfers</h3>
          <p className="text-sm text-gray-600">
            Manage inventory transfers between franchises
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <Button>
            <Truck className="h-4 w-4 mr-2" />
            New Transfer
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search transfers..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <Select
              value={filters.status}
              onChange={(value) => handleFilterChange('status', value)}
              options={[
                { value: 'all', label: 'All Status' },
                { value: 'pending', label: 'Pending' },
                { value: 'approved', label: 'Approved' },
                { value: 'in_transit', label: 'In Transit' },
                { value: 'completed', label: 'Completed' },
                { value: 'rejected', label: 'Rejected' },
                { value: 'cancelled', label: 'Cancelled' }
              ]}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Direction
            </label>
            <Select
              value={filters.direction}
              onChange={(value) => handleFilterChange('direction', value)}
              options={[
                { value: 'all', label: 'All Directions' },
                { value: 'outgoing', label: 'Outgoing' },
                { value: 'incoming', label: 'Incoming' }
              ]}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Actions
            </label>
            <div className="flex space-x-2">
              <Button variant="outline" className="flex-1">
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </Button>
              <Button variant="outline">
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Transfers List */}
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Transfer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Product
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Quantity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Franchises
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="animate-pulse">
                      <div className="h-4 bg-gray-200 rounded w-1/4 mx-auto"></div>
                    </div>
                  </td>
                </tr>
              ) : transferList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="text-gray-500">
                      <Truck className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p>No transfers found</p>
                      <p className="text-sm mt-1">Try adjusting your filters</p>
                    </div>
                  </td>
                </tr>
              ) : (
                transferList.map((transfer: any) => (
                  <tr key={transfer._id} className="hover:bg-gray-50">
                    {/* Transfer Info */}
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <Truck className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">
                            TRF-{transfer._id.toString().slice(-6).toUpperCase()}
                          </div>
                          <div className="text-sm text-gray-500">
                            {getDirectionBadge(transfer)}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Product Info */}
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-medium text-gray-900">
                          {transfer.product?.name || 'Unknown Product'}
                        </div>
                        <div className="text-sm text-gray-500">
                          SKU: {transfer.product?.sku || 'N/A'}
                        </div>
                      </div>
                    </td>

                    {/* Quantity */}
                    <td className="px-6 py-4">
                      <div className="text-lg font-bold text-gray-900">
                        {transfer.quantity}
                      </div>
                      <div className="text-sm text-gray-500">
                        ${transfer.totalValue?.toFixed(2) || '0.00'}
                      </div>
                    </td>

                    {/* Franchises */}
                    <td className="px-6 py-4">
                      <div className="space-y-2">
                        <div className="flex items-center">
                          <div className="h-2 w-2 rounded-full bg-red-500 mr-2"></div>
                          <span className="text-sm font-medium">
                            {transfer.fromFranchise?.name || 'Unknown'}
                          </span>
                        </div>
                        <div className="flex items-center">
                          <div className="h-2 w-2 rounded-full bg-green-500 mr-2"></div>
                          <span className="text-sm font-medium">
                            {transfer.toFranchise?.name || 'Unknown'}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4">
                      {getStatusBadge(transfer.status)}
                    </td>

                    {/* Date */}
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {new Date(transfer.transferDate).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(transfer.transferDate).toLocaleTimeString()}
                        </div>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSelectedTransfer(transfer)}
                        >
                          View
                        </Button>
                        {transfer.status === 'pending' && (
                          <>
                            <Button size="sm" variant="success">
                              Approve
                            </Button>
                            <Button size="sm" variant="danger">
                              Reject
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination && pagination.pages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing <span className="font-medium">{((filters.page - 1) * filters.limit) + 1}</span> to{' '}
                <span className="font-medium">
                  {Math.min(filters.page * filters.limit, pagination.total)}
                </span> of{' '}
                <span className="font-medium">{pagination.total}</span> results
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={filters.page === 1}
                  onClick={() => handleFilterChange('page', filters.page - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={filters.page === pagination.pages}
                  onClick={() => handleFilterChange('page', filters.page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Transfer Details Modal */}
      {selectedTransfer && (
        <TransferDetailsModal
          transfer={selectedTransfer}
          isOpen={!!selectedTransfer}
          onClose={() => setSelectedTransfer(null)}
        />
      )}
    </div>
  );
};

export default TransferManagement;