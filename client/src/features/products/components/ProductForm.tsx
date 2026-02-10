import React, { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package,
  DollarSign,
  Tag,
  Upload,
  X,
  Check,
  AlertCircle,
} from 'lucide-react';
import type { Product, ProductCategory } from '@/types';
import { cn, calculateProfit } from '@/lib/utils';

const productSchema = z.object({
  sku: z
    .string()
    .min(1, 'SKU is required')
    .max(50),
  name: z.string().min(1, 'Product name is required').max(100),
  category: z.enum(['Electronics', 'Clothing', 'Books', 'Home & Kitchen', 'Sports', 'Other']),
  brand: z.string().optional(),
  description: z.string().optional(),
  buyingPrice: z.number().min(0, 'Buying price must be positive'),
  sellingPrice: z.number().min(0, 'Selling price must be positive'),
  stockQuantity: z.number().min(0, 'Stock cannot be negative').int(),
  minimumStock: z.number().min(0, 'Minimum stock cannot be negative').int(),
  images: z.array(z.object({ url: z.string(), publicId: z.string() })).optional(),
});

type ProductFormData = z.infer<typeof productSchema>;

interface ProductFormProps {
  product?: Product;
  onSubmit: (data: ProductFormData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

const ProductForm: React.FC<ProductFormProps> = ({
  product,
  onSubmit,
  onCancel,
  loading = false,
}) => {
  const [step, setStep] = useState(1);
  const [images, setImages] = useState<string[]>(product?.images?.map(img => img.url) || []);
  const [profitData, setProfitData] = useState({
    profit: 0,
    profitMargin: 0,
    revenue: 0,
  });

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isValid },
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: product
      ? {
          sku: product.sku,
          name: product.name,
          category: product.category,
          brand: product.brand || '',
          description: product.description || '',
          buyingPrice: product.buyingPrice,
          sellingPrice: product.sellingPrice,
          stockQuantity: product.stockQuantity,
          minimumStock: product.minimumStock,
          images: product.images ?? [],
        }
      : {
          sku: '',
          category: 'Electronics',
          buyingPrice: 0,
          sellingPrice: 0,
          stockQuantity: 0,
          minimumStock: 10,
        },
    mode: 'onChange',
  });

  const buyingPrice = watch('buyingPrice');
  const sellingPrice = watch('sellingPrice');

  // Calculate profit on price changes
  React.useEffect(() => {
    if (buyingPrice && sellingPrice) {
      const profit = calculateProfit(buyingPrice, sellingPrice);
      setProfitData(profit);
    }
  }, [buyingPrice, sellingPrice]);

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result;
        if (typeof result === 'string') {
          setImages(prev => [...prev, result]);
        }
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const removeImage = useCallback((index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleFormSubmit = async (data: ProductFormData) => {
    await onSubmit({
      ...data,
      images: images.map(url => ({ url, publicId: '' })),
    } as ProductFormData);
  };

  const steps = [
    { number: 1, label: 'Basic Info', icon: Package },
    { number: 2, label: 'Pricing', icon: DollarSign },
    { number: 3, label: 'Inventory', icon: Tag },
    { number: 4, label: 'Review', icon: Check },
  ];

  const categories: ProductCategory[] = [
    'Electronics',
    'Clothing',
    'Books',
    'Home & Kitchen',
    'Sports',
    'Other',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-xl bg-white shadow-2xl"
      >
        <div className="border-b border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {product ? 'Edit Product' : 'Add New Product'}
              </h2>
              <p className="text-gray-500">
                {product ? `SKU: ${product.sku}` : 'Create a new product in your inventory'}
              </p>
            </div>
            <button
              onClick={onCancel}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Stepper */}
          <div className="mt-6">
            <div className="flex items-center justify-between">
              {steps.map((s, index) => (
                <React.Fragment key={s.number}>
                  <button
                    onClick={() => setStep(s.number)}
                    className={cn(
                      'flex items-center space-x-2 rounded-lg px-4 py-2 transition-colors',
                      step === s.number
                        ? 'bg-blue-100 text-blue-600'
                        : 'text-gray-500 hover:text-gray-700'
                    )}
                  >
                    <div
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-full',
                        step === s.number
                          ? 'bg-blue-600 text-white'
                          : step > s.number
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-200 text-gray-500'
                      )}
                    >
                      {step > s.number ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <span className="text-sm font-medium">{s.number}</span>
                      )}
                    </div>
                    <span className="text-sm font-medium">{s.label}</span>
                  </button>
                  {index < steps.length - 1 && (
                    <div
                      className={cn(
                        'h-0.5 flex-1',
                        step > s.number
                          ? 'bg-green-600'
                          : 'bg-gray-200'
                      )}
                    />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit(handleFormSubmit)}>
          <div className="max-h-[60vh] overflow-y-auto p-6">
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-6"
                >
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Product Name *
                      </label>
                      <input
                        {...register('name')}
                        type="text"
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        placeholder="Enter product name"
                      />
                      {errors.name && (
                        <p className="mt-1 text-sm text-red-600">
                          {errors.name.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        SKU *
                      </label>
                      <input
                        {...register('sku')}
                        type="text"
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm uppercase tracking-wide focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        placeholder="e.g. PRD-001"
                      />
                      {errors.sku && (
                        <p className="mt-1 text-sm text-red-600">
                          {errors.sku.message}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Category *
                      </label>
                      <select
                        {...register('category')}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      >
                        {categories.map(category => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                      {errors.category && (
                        <p className="mt-1 text-sm text-red-600">
                          {errors.category.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Brand
                      </label>
                      <input
                        {...register('brand')}
                        type="text"
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        placeholder="Enter brand name"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      {...register('description')}
                      rows={3}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      placeholder="Enter product description"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Product Images
                    </label>
                    <div className="mt-2 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                      {images.map((image, index) => (
                        <div key={index} className="relative">
                          <img
                            src={image}
                            alt={`Product ${index + 1}`}
                            className="h-32 w-full rounded-lg object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => removeImage(index)}
                            className="absolute right-2 top-2 rounded-full bg-red-600 p-1 text-white hover:bg-red-700"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                      <label className="flex h-32 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 hover:border-blue-500">
                        <Upload className="h-8 w-8 text-gray-400" />
                        <span className="mt-2 text-sm text-gray-500">
                          Upload Image
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handleImageUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-6"
                >
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Buying Price *
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                        ₹
                        </span>
                        <input
                          {...register('buyingPrice', { valueAsNumber: true })}
                          type="number"
                          step="0.01"
                          className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-8 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          placeholder="0.00"
                        />
                      </div>
                      {errors.buyingPrice && (
                        <p className="mt-1 text-sm text-red-600">
                          {errors.buyingPrice.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Selling Price *
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                          ₹
                        </span>
                        <input
                          {...register('sellingPrice', { valueAsNumber: true })}
                          type="number"
                          step="0.01"
                          className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-8 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          placeholder="0.00"
                        />
                      </div>
                      {errors.sellingPrice && (
                        <p className="mt-1 text-sm text-red-600">
                          {errors.sellingPrice.message}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Profit Calculator */}
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-6/50">
                    <h3 className="mb-4 text-lg font-semibold text-gray-900">
                      Profit Calculator
                    </h3>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <div className="text-center">
                        <p className="text-sm text-gray-500">
                          Profit Margin
                        </p>
                        <p
                          className={cn(
                            'text-2xl font-bold',
                            profitData.profitMargin >= 30
                              ? 'text-green-600'
                              : profitData.profitMargin >= 10
                              ? 'text-blue-600'
                              : 'text-amber-600'
                          )}
                        >
                          {profitData.profitMargin.toFixed(1)}%
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-gray-500">
                          Profit per Unit
                        </p>
                        <p
                          className={cn(
                            'text-2xl font-bold',
                            profitData.profit >= 0
                              ? 'text-green-600'
                              : 'text-red-600'
                          )}
                        >
                          ₹{profitData.profit.toFixed(2)}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-gray-500">
                          Revenue per Unit
                        </p>
                        <p className="text-2xl font-bold text-gray-900">
                          ₹{profitData.revenue.toFixed(2)}
                        </p>
                      </div>
                    </div>

                    {profitData.profitMargin < 10 && (
                      <div className="mt-4 flex items-start rounded-lg bg-amber-50 p-4">
                        <AlertCircle className="mr-2 h-5 w-5 text-amber-600" />
                        <p className="text-sm text-amber-700">
                          Low profit margin detected. Consider increasing selling price.
                        </p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-6"
                >
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Current Stock *
                      </label>
                      <input
                        {...register('stockQuantity', { valueAsNumber: true })}
                        type="number"
                        min="0"
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        placeholder="0"
                      />
                      {errors.stockQuantity && (
                        <p className="mt-1 text-sm text-red-600">
                          {errors.stockQuantity.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Minimum Stock Threshold *
                      </label>
                      <input
                        {...register('minimumStock', { valueAsNumber: true })}
                        type="number"
                        min="0"
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        placeholder="10"
                      />
                      {errors.minimumStock && (
                        <p className="mt-1 text-sm text-red-600">
                          {errors.minimumStock.message}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-6/50">
                    <h3 className="mb-4 text-lg font-semibold text-gray-900">
                      Stock Health
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">
                            Current Stock Level
                          </span>
                          <span className="font-medium">
                            {watch('stockQuantity') || 0} units
                          </span>
                        </div>
                        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-200">
                          <div
                            className={cn(
                              'h-full rounded-full transition-all duration-300',
                              (watch('stockQuantity') || 0) === 0
                                ? 'bg-red-500'
                                : (watch('stockQuantity') || 0) <= (watch('minimumStock') || 10)
                                ? 'bg-amber-500'
                                : 'bg-green-500'
                            )}
                            style={{
                              width: `${Math.min(
                                ((watch('stockQuantity') || 0) / ((watch('minimumStock') || 10) * 3)) * 100,
                                100
                              )}%`,
                            }}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
                          <p className="text-sm text-blue-600">
                            Inventory Value
                          </p>
                          <p className="text-xl font-bold text-blue-700 dark:text-blue-300">
                            ₹
                            {((watch('stockQuantity') || 0) * (watch('buyingPrice') || 0)).toFixed(
                              2
                            )}
                          </p>
                        </div>
                        <div className="rounded-lg bg-green-50 p-4 dark:bg-green-900/20">
                          <p className="text-sm text-green-600">
                            Potential Revenue
                          </p>
                          <p className="text-xl font-bold text-green-700 dark:text-green-300">
                            ₹
                            {((watch('stockQuantity') || 0) * (watch('sellingPrice') || 0)).toFixed(
                              2
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {step === 4 && (
                <motion.div
                  key="step4"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-6"
                >
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-6/50">
                    <h3 className="mb-4 text-lg font-semibold text-gray-900">
                      Product Summary
                    </h3>
                    
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-gray-500">Product Name</p>
                          <p className="font-medium">{watch('name') || 'Not specified'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Category</p>
                          <p className="font-medium">{watch('category')}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-gray-500">Buying Price</p>
                          <p className="font-medium">₹{watch('buyingPrice')?.toFixed(2) || '0.00'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Selling Price</p>
                          <p className="font-medium">₹{watch('sellingPrice')?.toFixed(2) || '0.00'}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-gray-500">Stock Quantity</p>
                          <p className="font-medium">{watch('stockQuantity') || 0} units</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Minimum Stock</p>
                          <p className="font-medium">{watch('minimumStock') || 10} units</p>
                        </div>
                      </div>

                      <div>
                        <p className="text-sm text-gray-500">Profit Margin</p>
                        <p className={cn(
                          'text-xl font-bold',
                          profitData.profitMargin >= 30
                            ? 'text-green-600'
                            : profitData.profitMargin >= 10
                            ? 'text-blue-600'
                            : 'text-amber-600'
                        )}>
                          {profitData.profitMargin.toFixed(1)}%
                        </p>
                      </div>

                      {images.length > 0 && (
                        <div>
                          <p className="text-sm text-gray-500 mb-2">
                            Product Images ({images.length})
                          </p>
                          <div className="grid grid-cols-4 gap-2">
                            {images.map((image, index) => (
                              <img
                                key={index}
                                src={image}
                                alt={`Preview ${index + 1}`}
                                className="h-20 w-full rounded-lg object-cover"
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="border-t border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => step > 1 && setStep(step - 1)}
                className={cn(
                  'rounded-lg px-4 py-2 text-sm font-medium',
                  step > 1
                    ? 'text-gray-700 hover:bg-gray-100'
                    : 'invisible'
                )}
              >
                ← Previous
              </button>

              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={onCancel}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>

                {step < 4 ? (
                  <button
                    type="button"
                    onClick={() => setStep(step + 1)}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Next Step →
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={loading || !isValid}
                    className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    {loading ? (
                      <span className="flex items-center">
                        <motion.span
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                          className="mr-2 h-4 w-4 rounded-full border-2 border-white border-t-transparent"
                        />
                        {product ? 'Updating...' : 'Creating...'}
                      </span>
                    ) : product ? (
                      'Update Product'
                    ) : (
                      'Create Product'
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default ProductForm;