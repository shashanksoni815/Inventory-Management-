import React, { useState, useEffect } from 'react';
import { 
  Package, 
  DollarSign, 
  TrendingUp, 
  AlertCircle,
  Edit,
  Share2,
  ArrowRightLeft,
  Eye,
  Filter,
  Search,
  ChevronDown
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { productApi } from '../../services/api';
import { useFranchise } from '../../contexts/FranchiseContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

interface Product {
  _id: string;
  sku: string;
  name: string;
  category: string;
  brand?: string;
  buyingPrice: number;
  sellingPrice: number;
  profitMargin: number;
  stockQuantity: number;
  franchiseStock: number;
  isShared: boolean;
  stockStatus: string;
  inventoryValue: number;
  totalSold: number;
  totalRevenue: number;
  franchise: {
    _id: string;
    name: string;
    code: string;
    metadata?: {
      color?: string;
      icon?: string;
    };
  };
  sharedWith?: Array<{
    franchise: {
      _id: string;
      name: string;
      code: string;
    };
    quantity: number;
  }>;
}

const FranchiseProductTable: React.FC = () => {
  const { currentFranchise, isNetworkView } = useFranchise();
  const [filters, setFilters] = useState({
    search: '',
    category: 'all',
    stockStatus: 'all',
    status: 'all',
    page: 1,
    limit: 20,
    sortBy: 'name',
    sortOrder: 'asc'
  });

  const franchiseId = currentFranchise?._id;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['products', franchiseId, filters],
    queryFn: () => productApi.getAll({
      franchise: franchiseId,
      ...filters
    }),
    enabled: !!franchiseId && !isNetworkView,
  });

  const products = data?.data || [];
  const pagination = data?.pagination;

  const handleFilterChange = (key: string, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  const handlePageChange = (page: number) => {
    setFilters(prev => ({ ...prev, page }));
  };

  const getStockStatusBadge = (status: string) => {
    const variants = {
      'in-stock': 'success',
      'low-stock': 'warning',
      'out-of-stock': 'danger'
    };

    const labels = {
      'in-stock': 'In Stock',
      'low-stock': 'Low Stock',
      'out-of-stock': 'Out of Stock'
    };

    return (
      <Badge variant={variants[status as keyof typeof variants]}>
        {labels[status as keyof typeof labels]}
      </Badge>
    );
  };

  const getFranchiseBadge = (product: Product) => {
    if (product.isShared) {
      return (
        <Badge variant="outline" className="border-purple-300 text-purple-700">
          <Share2 className="h-3 w-3 mr-1" />
          Shared
        </Badge>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      {/* Header with filters */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Products</h3>
            <p className="text-sm text-gray-600">
              {currentFranchise?.name} • Showing {pagination?.total || 0} products
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search products..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="pl-10 w-64"
              />
            </div>
            
            <Select
              value={filters.category}
              onChange={(value) => handleFilterChange('category', value)}
              options={[
                { value: 'all', label: 'All Categories' },
                { value: 'Electronics', label: 'Electronics' },
                { value: 'Clothing', label: 'Clothing' },
                { value: 'Books', label: 'Books' },
                { value: 'Home & Kitchen', label: 'Home & Kitchen' },
                { value: 'Sports', label: 'Sports' },
                { value: 'Other', label: 'Other' }
              ]}
              className="w-40"
            />
            
            <Select
              value={filters.stockStatus}
              onChange={(value) => handleFilterChange('stockStatus', value)}
              options={[
                { value: 'all', label: 'All Stock' },
                { value: 'in-stock', label: 'In Stock' },
                { value: 'low-stock', label: 'Low Stock' },
                { value: 'out-of-stock', label: 'Out of Stock' }
              ]}
              className="w-40"
            />
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Product
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Stock
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Pricing
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Sales
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Value
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center">
                  <div className="animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-1/4 mx-auto"></div>
                  </div>
                </td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center">
                  <div className="text-gray-500">
                    <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No products found</p>
                    <p className="text-sm mt-1">Try adjusting your filters</p>
                  </div>
                </td>
              </tr>
            ) : (
              products.map((product) => (
                <tr key={product._id} className="hover:bg-gray-50">
                  {/* Product Info */}
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                          <Package className="h-5 w-5 text-blue-600" />
                        </div>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium text-gray-900 truncate">
                            {product.name}
                          </span>
                          {getFranchiseBadge(product)}
                        </div>
                        <div className="text-sm text-gray-500">
                          SKU: {product.sku}
                        </div>
                        <div className="flex items-center space-x-2 mt-1">
                          <Badge variant="outline" size="sm">
                            {product.category}
                          </Badge>
                          {product.brand && (
                            <Badge variant="outline" size="sm">
                              {product.brand}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Stock Info */}
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      <div className="text-lg font-bold text-gray-900">
                        {product.franchiseStock.toLocaleString()}
                      </div>
                      {product.stockQuantity !== product.franchiseStock && (
                        <div className="text-xs text-gray-500">
                          / {product.stockQuantity.toLocaleString()} total
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      Min: {product.minimumStock}
                    </div>
                  </td>

                  {/* Pricing */}
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Sell:</span>
                        <span className="font-medium text-gray-900">
                          ${product.sellingPrice.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Cost:</span>
                        <span className="font-medium text-gray-900">
                          ${product.buyingPrice.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Margin:</span>
                        <span className={`font-medium ${
                          product.profitMargin >= 20 ? 'text-green-600' :
                          product.profitMargin >= 10 ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>
                          {product.profitMargin.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Sales */}
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <div className="flex items-center">
                        <TrendingUp className="h-4 w-4 text-gray-400 mr-2" />
                        <span className="font-medium text-gray-900">
                          {product.totalSold}
                        </span>
                      </div>
                      <div className="text-sm text-gray-500">
                        ${product.totalRevenue.toLocaleString()}
                      </div>
                    </div>
                  </td>

                  {/* Inventory Value */}
                  <td className="px-6 py-4">
                    <div className="font-bold text-gray-900">
                      ${product.inventoryValue.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-500">
                      Unit value: ${product.buyingPrice.toFixed(2)}
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-6 py-4">
                    {getStockStatusBadge(product.stockStatus)}
                  </td>

                  {/* Actions */}
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {/* View details */}}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {/* Edit product */}}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {/* Share product */}}
                      >
                        <Share2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {/* Transfer stock */}}
                      >
                        <ArrowRightLeft className="h-4 w-4" />
                      </Button>
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
                onClick={() => handlePageChange(filters.page - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={filters.page === pagination.pages}
                onClick={() => handlePageChange(filters.page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FranchiseProductTable;