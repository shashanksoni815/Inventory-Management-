import React, { useState } from 'react';
import {
  Share2,
  Package,
  Globe,
  Building,
  Check,
  X,
  Search,
  Filter,
  RefreshCw
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productApi, franchiseApi } from '../../services/api';
import { useFranchise } from '../../contexts/FranchiseContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Badge } from '../ui/Badge';
import { Checkbox } from '../ui/Checkbox';

const SharedProductsManager: React.FC = () => {
  const { currentFranchise, franchises } = useFranchise();
  const queryClient = useQueryClient();
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [targetFranchise, setTargetFranchise] = useState<string>('');
  const [search, setSearch] = useState('');

  // Fetch global products from current franchise
  const { data: products, isLoading } = useQuery({
    queryKey: ['global-products', currentFranchise?._id],
    queryFn: () => productApi.getAll({
      franchise: currentFranchise?._id,
      isGlobal: true,
      search: search || undefined
    }),
    enabled: !!currentFranchise?._id,
  });

  // Fetch available franchises to share with
  const availableFranchises = franchises.filter(f => 
    f._id !== currentFranchise?._id && 
    f.status === 'active'
  );

  // Share products mutation
  const shareMutation = useMutation({
    mutationFn: ({ productIds, franchiseIds }: { 
      productIds: string[], 
      franchiseIds: string[] 
    }) => {
      return Promise.all(
        productIds.map(productId => 
          productApi.share(productId, franchiseIds)
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['global-products'] });
      setSelectedProducts([]);
      setTargetFranchise('');
    }
  });

  const handleShare = () => {
    if (selectedProducts.length === 0 || !targetFranchise) return;
    
    shareMutation.mutate({
      productIds: selectedProducts,
      franchiseIds: [targetFranchise]
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedProducts(products?.data?.map((p: any) => p._id) || []);
    } else {
      setSelectedProducts([]);
    }
  };

  const handleSelectProduct = (productId: string, checked: boolean) => {
    if (checked) {
      setSelectedProducts(prev => [...prev, productId]);
    } else {
      setSelectedProducts(prev => prev.filter(id => id !== productId));
    }
  };

  const productList = products?.data || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Shared Products</h3>
          <p className="text-sm text-gray-600">
            Manage products shared with other franchises
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <Button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['global-products'] })}
            variant="outline"
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Sharing Controls */}
      <Card className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Share Selected Products
            </label>
            <div className="text-lg font-bold text-blue-600">
              {selectedProducts.length} selected
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              With Franchise
            </label>
            <Select
              value={targetFranchise}
              onChange={setTargetFranchise}
              options={[
                { value: '', label: 'Select franchise...', disabled: true },
                ...availableFranchises.map(f => ({
                  value: f._id,
                  label: `${f.name} (${f.code})`
                }))
              ]}
            />
          </div>
          
          <div className="flex items-end">
            <Button
              onClick={handleShare}
              disabled={selectedProducts.length === 0 || !targetFranchise || shareMutation.isPending}
              loading={shareMutation.isPending}
              className="w-full"
            >
              <Share2 className="h-4 w-4 mr-2" />
              Share Products
            </Button>
          </div>
        </div>
      </Card>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search products to share..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Products List */}
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase w-12">
                  <Checkbox
                    checked={selectedProducts.length === productList.length && productList.length > 0}
                    indeterminate={selectedProducts.length > 0 && selectedProducts.length < productList.length}
                    onChange={handleSelectAll}
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Product
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Stock
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Shared With
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="animate-pulse">
                      <div className="h-4 bg-gray-200 rounded w-1/4 mx-auto"></div>
                    </div>
                  </td>
                </tr>
              ) : productList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="text-gray-500">
                      <Globe className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p>No global products found</p>
                      <p className="text-sm mt-1">
                        Mark products as "Global" to share them with other franchises
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                productList.map((product: any) => (
                  <tr key={product._id} className="hover:bg-gray-50">
                    {/* Checkbox */}
                    <td className="px-6 py-4">
                      <Checkbox
                        checked={selectedProducts.includes(product._id)}
                        onChange={(checked) => handleSelectProduct(product._id, checked)}
                      />
                    </td>

                    {/* Product Info */}
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <Package className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">
                            {product.name}
                          </div>
                          <div className="text-sm text-gray-500">
                            SKU: {product.sku}
                          </div>
                          <div className="flex items-center space-x-2 mt-1">
                            <Badge size="sm">{product.category}</Badge>
                            {product.brand && (
                              <Badge variant="outline" size="sm">
                                {product.brand}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Stock */}
                    <td className="px-6 py-4">
                      <div className="text-lg font-bold text-gray-900">
                        {product.stockQuantity}
                      </div>
                      <div className="text-sm text-gray-500">
                        ${(product.stockQuantity * product.buyingPrice).toLocaleString()} value
                      </div>
                    </td>

                    {/* Shared With */}
                    <td className="px-6 py-4">
                      <div className="space-y-2">
                        {product.sharedWith && product.sharedWith.length > 0 ? (
                          product.sharedWith.slice(0, 3).map((share: any, index: number) => (
                            <div key={index} className="flex items-center space-x-2">
                              <Building className="h-3 w-3 text-gray-400" />
                              <span className="text-sm text-gray-700">
                                {share.franchise?.name || 'Unknown'}
                              </span>
                              <Badge size="xs">{share.quantity}</Badge>
                            </div>
                          ))
                        ) : (
                          <div className="text-sm text-gray-500">Not shared yet</div>
                        )}
                        {product.sharedWith && product.sharedWith.length > 3 && (
                          <div className="text-sm text-blue-600">
                            +{product.sharedWith.length - 3} more
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4">
                      {product.isGlobal ? (
                        <Badge variant="success">
                          <Globe className="h-3 w-3 mr-1" />
                          Global
                        </Badge>
                      ) : (
                        <Badge variant="outline">Local</Badge>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {/* View sharing details */}}
                        >
                          <Share2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Sharing Statistics */}
      <Card className="p-6">
        <h4 className="text-lg font-semibold text-gray-900 mb-4">Sharing Statistics</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">
              {productList.length}
            </div>
            <div className="text-sm text-gray-600">Global Products</div>
          </div>
          
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">
              {productList.filter((p: any) => p.sharedWith?.length > 0).length}
            </div>
            <div className="text-sm text-gray-600">Products Shared</div>
          </div>
          
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">
              {productList.reduce((total: number, p: any) => 
                total + (p.sharedWith?.length || 0), 0
              )}
            </div>
            <div className="text-sm text-gray-600">Total Shares</div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default SharedProductsManager;