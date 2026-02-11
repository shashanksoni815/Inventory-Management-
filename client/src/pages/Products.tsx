import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Plus, Filter, Download, Upload, RefreshCw, Package, DollarSign } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ProductTable from '@/features/products/components/ProductTable';
import ProductForm from '@/features/products/components/ProductForm';
import { productApi } from '@/services/api';
import { useFranchise } from '@/contexts/FranchiseContext';
import { showToast } from '@/services/toast';
import type { Product } from '@/types';

const Products: React.FC = () => {
  const [showForm, setShowForm] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | undefined>();
  const [filters, setFilters] = useState({
    search: '',
    category: '',
    status: '',
    minStock: '',
    maxStock: '',
  });

  const queryClient = useQueryClient();
  const { currentFranchise } = useFranchise();
  const selectedFranchiseId =
    (currentFranchise as any)?._id || (currentFranchise as any)?.id || undefined;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['products', filters],
    queryFn: () => productApi.getAll({
      search: filters.search || undefined,
      category: filters.category || undefined,
      status: filters.status || undefined,
      minStock: filters.minStock ? Number(filters.minStock) : undefined,
      maxStock: filters.maxStock ? Number(filters.maxStock) : undefined,
      page: 1,
      limit: 50,
    }),
  });

  const createMutation = useMutation({
    mutationFn: productApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setShowForm(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Product> }) =>
      productApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setShowForm(false);
      setSelectedProduct(undefined);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: productApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });

  const handleEdit = useCallback((product: Product) => {
    setSelectedProduct(product);
    setShowForm(true);
  }, []);

  const handleDelete = useCallback((productId: string) => {
    if (confirm('Are you sure you want to delete this product?')) {
      deleteMutation.mutate(productId);
    }
  }, [deleteMutation]);

  const handleSubmit = useCallback(
    async (formData: any) => {
      if (selectedProduct) {
        await updateMutation.mutateAsync({
          id: selectedProduct._id,
          data: formData,
        });
      } else {
        if (!selectedFranchiseId) {
          window.alert('Please select a franchise before creating a product.');
          return;
        }
        await createMutation.mutateAsync({
          ...formData,
          franchise: selectedFranchiseId,
        });
      }
    },
    [selectedProduct, createMutation, updateMutation, selectedFranchiseId]
  );

  const handleExport = useCallback(async (format: 'excel' | 'pdf' = 'excel') => {
    try {
      const params = new URLSearchParams();
      if (filters.category) params.append('category', filters.category);
      if (filters.status) params.append('status', filters.status);
      if (filters.minStock) params.append('minStock', filters.minStock);
      if (filters.maxStock) params.append('maxStock', filters.maxStock);
      params.append('format', format);

      const response = await fetch(`/api/products/export?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        if (response.status === 403) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || 'Access denied: You do not have permission to export products from this franchise');
        }
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `products-export-${new Date().toISOString().slice(0, 10)}.${format === 'excel' ? 'xlsx' : 'pdf'}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export error:', error);
      alert(error instanceof Error ? error.message : 'Failed to export products. Please try again.');
    }
  }, [filters]);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleImport = useCallback(() => {
    // Trigger file picker using native input element (avoids browser extension interference)
    fileInputRef.current?.click();
  }, []);

  const handleProductImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
    ];
    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const isValidType = validTypes.includes(file.type) || 
                       validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));

    if (!isValidType) {
      showToast.error('Please select a valid Excel or CSV file (.xlsx, .xls, or .csv)');
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      showToast.error('File size exceeds 10MB limit. Please select a smaller file.');
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    try {
      // Create FormData
      const formData = new FormData();
      formData.append('file', file);
      
      // Add franchise ID if available from context
      if (currentFranchise?._id || currentFranchise?.id) {
        const franchiseId = currentFranchise._id || currentFranchise.id;
        formData.append('franchise', franchiseId);
      }

      // Show loading state
      const loadingToast = showToast.loading('Uploading file... Please wait.');

      // Call import API using productApi
      const result = await productApi.import(formData);

      // Dismiss loading toast
      showToast.dismiss(loadingToast);

      // Success - result is already unwrapped by axios interceptor
      const importData = result as any;
      
      // Show success toast with detailed information
      const successMessage = importData?.failedRows > 0
        ? `Import completed with ${importData.successfulRows || 0} successful, ${importData.failedRows || 0} failed`
        : `Import successful! ${importData.successfulRows || 0} products imported`;
      
      showToast.success(successMessage);

      // Refresh products list
      queryClient.invalidateQueries({ queryKey: ['products'] });
      refetch();

      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error: any) {
      console.error('Import error:', error);
      
      // Extract error message from various possible sources
      let errorMessage = 'Failed to import products. Please try again.';
      
      if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error?.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      // Show validation error message
      showToast.error(errorMessage);
      
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [queryClient, refetch, currentFranchise]);

  const products = (data as any)?.products ?? [];

  return (
    <div className="min-h-0 bg-white p-3 sm:p-4 lg:p-6">
      {/* Hidden file input for import */}
      <input
        type="file"
        accept=".xlsx,.csv"
        ref={fileInputRef}
        className="hidden"
        onChange={handleProductImport}
      />
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4 sm:mb-6 lg:mb-8"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 truncate">
              Product Inventory
            </h1>
            <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600">
              Manage your products, stock levels, and pricing
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button
              onClick={() => refetch()}
              className="flex items-center space-x-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 "
            >
              <RefreshCw className="h-4 w-4" />
              <span>Refresh</span>
            </button>
            <button
              onClick={handleImport}
              className="flex items-center space-x-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 "
            >
              <Upload className="h-4 w-4" />
              <span>Import</span>
            </button>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleExport('excel')}
                className="flex items-center space-x-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                title="Export to Excel"
              >
                <Download className="h-4 w-4" />
                <span>Excel</span>
              </button>
              <button
                onClick={() => handleExport('pdf')}
                className="flex items-center space-x-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                title="Export to PDF"
              >
                <Download className="h-4 w-4" />
                <span>PDF</span>
              </button>
            </div>
            <button
              onClick={() => {
                setSelectedProduct(undefined);
                setShowForm(true);
              }}
              className="flex items-center space-x-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              <span>Add Product</span>
            </button>
          </div>
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="mb-6 rounded-xl border border-gray-200 bg-white p-6"
      >
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">
              Filters:
            </span>
          </div>
          <div className="flex flex-wrap gap-3">
            <input
              type="search"
              placeholder="Search products..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none "
            />
            <select
              value={filters.category}
              onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none "
            >
              <option value="">All Categories</option>
              <option value="Electronics">Electronics</option>
              <option value="Clothing">Clothing</option>
              <option value="Books">Books</option>
              <option value="Home & Kitchen">Home & Kitchen</option>
              <option value="Sports">Sports</option>
              <option value="Other">Other</option>
            </select>
            <select
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none "
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <div className="flex items-center space-x-2">
              <input
                type="number"
                placeholder="Min Stock"
                value={filters.minStock}
                onChange={(e) => setFilters(prev => ({ ...prev, minStock: e.target.value }))}
                className="w-24 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none "
              />
              <span className="text-gray-500">to</span>
              <input
                type="number"
                placeholder="Max Stock"
                value={filters.maxStock}
                onChange={(e) => setFilters(prev => ({ ...prev, maxStock: e.target.value }))}
                className="w-24 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none "
              />
            </div>
            <button
              onClick={() => setFilters({
                search: '',
                category: '',
                status: '',
                minStock: '',
                maxStock: '',
              })}
              className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 "
            >
              Clear Filters
            </button>
          </div>
        </div>
      </motion.div>

      {/* Product Table */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="rounded-xl border border-gray-200 bg-white p-6"
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              All Products ({products.length})
            </h2>
            <p className="text-sm text-gray-500">
              Total inventory value: $
              {products.reduce((sum: number, p: Product) => sum + (p.inventoryValue ?? 0), 0).toLocaleString()}
            </p>
          </div>
          <div className="text-xs sm:text-sm text-gray-500 flex-shrink-0">
            {products.filter((p: Product) => p.stockStatus === 'low-stock').length} low stock
            • {products.filter((p: Product) => p.stockStatus === 'out-of-stock').length} out of stock
          </div>
        </div>

        <ProductTable
          products={products}
          loading={isLoading}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      </motion.div>

      {/* Stats Summary - responsive */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mt-4 sm:mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-3"
      >
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Products</p>
              <p className="text-2xl font-bold text-gray-900">
                {products.length}
              </p>
            </div>
            <div className="rounded-lg bg-blue-100 p-3 ">
              <Package className="h-6 w-6 text-blue-600 " />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Inventory Value</p>
              <p className="text-2xl font-bold text-gray-900">
                $
                {products
                  .reduce((sum: number, p: Product) => sum + (p.inventoryValue ?? 0), 0)
                  .toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg bg-green-100 p-3 ">
              <DollarSign className="h-6 w-6 text-green-600 " />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Low Stock Alerts</p>
              <p className="text-2xl font-bold text-amber-600 ">
                {products.filter((p: Product) => p.stockStatus === 'low-stock').length}
              </p>
            </div>
            <div className="rounded-lg bg-amber-100 p-3 ">
              <Filter className="h-6 w-6 text-amber-600 " />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Product Form Modal */}
      {showForm && (
        <ProductForm
          product={selectedProduct}
          onSubmit={handleSubmit}
          onCancel={() => {
            setShowForm(false);
            setSelectedProduct(undefined);
          }}
          loading={createMutation.isPending || updateMutation.isPending}
        />
      )}
    </div>
  );
};

export default Products;