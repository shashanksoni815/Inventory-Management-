import React, { useState } from 'react';
import {
  Package,
  TrendingUp,
  Edit,
  Share2,
  ArrowRightLeft,
  Eye,
  Search,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { productApi } from '../../services/api';
import { useFranchise } from '../../contexts/FranchiseContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/** Product row shape returned by GET /products when scoped by franchise (includes franchiseStock, stockStatus, etc.) */
interface FranchiseProductRow {
  _id: string;
  sku: string;
  name: string;
  category: string;
  brand?: string;
  buyingPrice: number;
  sellingPrice: number;
  profitMargin: number;
  stockQuantity: number;
  minimumStock?: number;
  totalSold: number;
  totalRevenue: number;
  /** Backend adds this when scoped by franchise */
  franchiseStock?: number;
  isShared?: boolean;
  stockStatus?: string;
  inventoryValue?: number;
  franchise: {
    _id: string;
    name: string;
    code: string;
    metadata?: { color?: string; icon?: string };
  };
  sharedWith?: Array<{
    franchise: { _id: string; name: string; code: string };
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

  const { data, isLoading } = useQuery({
    queryKey: ['products', franchiseId, filters],
    queryFn: () => productApi.getAll({
      franchise: franchiseId,
      search: filters.search || undefined,
      category: filters.category === 'all' ? undefined : filters.category,
      status: filters.status === 'all' ? undefined : filters.status,
      page: filters.page,
      limit: filters.limit,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder === 'desc' ? 'desc' : 'asc',
    }),
    enabled: !!franchiseId && !isNetworkView,
  });

  const products: FranchiseProductRow[] = (data?.products || []) as unknown as FranchiseProductRow[];
  const pagination = data?.pagination;

  const handleFilterChange = (key: string, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  const handlePageChange = (page: number) => {
    setFilters(prev => ({ ...prev, page }));
  };

  const getStockStatusBadge = (status: string) => {
    const variants: Record<string, 'success' | 'warning' | 'danger' | 'outline'> = {
      'in-stock': 'success',
      'low-stock': 'warning',
      'out-of-stock': 'danger',
    };
    const labels: Record<string, string> = {
      'in-stock': 'In Stock',
      'low-stock': 'Low Stock',
      'out-of-stock': 'Out of Stock',
    };
    const variant = variants[status] ?? 'outline';
    return (
      <Badge variant={variant}>
        {labels[status] ?? status}
      </Badge>
    );
  };

  const getFranchiseBadge = (product: FranchiseProductRow) => {
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
            
            <select
              value={filters.category}
              onChange={(e) => handleFilterChange('category', e.target.value)}
              className="h-10 w-40 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <option value="all">All Categories</option>
              <option value="Electronics">Electronics</option>
              <option value="Clothing">Clothing</option>
              <option value="Books">Books</option>
              <option value="Home & Kitchen">Home & Kitchen</option>
              <option value="Sports">Sports</option>
              <option value="Other">Other</option>
            </select>

            <select
              value={filters.stockStatus}
              onChange={(e) => handleFilterChange('stockStatus', e.target.value)}
              className="h-10 w-40 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <option value="all">All Stock</option>
              <option value="in-stock">In Stock</option>
              <option value="low-stock">Low Stock</option>
              <option value="out-of-stock">Out of Stock</option>
            </select>
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
                      <div className="shrink-0">
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
                        {(product.franchiseStock ?? product.stockQuantity).toLocaleString()}
                      </div>
                      {product.franchiseStock != null && product.stockQuantity !== product.franchiseStock && (
                        <div className="text-xs text-gray-500">
                          / {product.stockQuantity.toLocaleString()} total
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      Min: {product.minimumStock ?? 0}
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
                      ${(product.inventoryValue ?? product.stockQuantity * product.buyingPrice).toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-500">
                      Unit value: ${product.buyingPrice.toFixed(2)}
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-6 py-4">
                    {getStockStatusBadge(product.stockStatus ?? 'in-stock')}
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