import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  X,
  Plus,
  Minus,
  Search,
  Trash2,
  ShoppingCart,
  Percent,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { productApi, saleApi } from '@/services/api';
import { cn, calculateProfit } from '@/lib/utils';
import { showToast } from '@/services/toast';
import type { Product } from '@/types';

interface SaleItemRow {
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  buyingPrice: number;
  sellingPrice: number;
  discount: number;
  tax: number;
}

interface NewSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const NewSaleModal: React.FC<NewSaleModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [items, setItems] = useState<SaleItemRow[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [customer, setCustomer] = useState({
    name: '',
    email: '',
  });
  const [saleType, setSaleType] = useState<'online' | 'offline'>('offline');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'upi' | 'bank_transfer' | 'credit'>('cash');
  const [notes, setNotes] = useState('');

  const { data: products, isLoading } = useQuery({
    queryKey: ['products-for-sale', searchQuery],
    queryFn: () => productApi.getAll({
      search: searchQuery || undefined,
      status: 'active',
      limit: 10,
    }),
    enabled: isOpen,
  });

  const addItem = useCallback((product: Product) => {
    const existingItem = items.find(item => item.productId === product._id);
    
    if (existingItem) {
      setItems(items.map(item =>
        item.productId === product._id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setItems([
        ...items,
        {
          productId: product._id,
          sku: product.sku,
          name: product.name,
          quantity: 1,
          buyingPrice: product.buyingPrice,
          sellingPrice: product.sellingPrice,
          discount: 0,
          tax: 10, // Default tax rate
        },
      ]);
    }
    
    setSearchQuery('');
  }, [items]);

  const updateItem = useCallback((productId: string, updates: Partial<SaleItemRow>) => {
    setItems(items.map(item =>
      item.productId === productId ? { ...item, ...updates } : item
    ));
  }, [items]);

  const removeItem = useCallback((productId: string) => {
    setItems(items.filter(item => item.productId !== productId));
  }, [items]);

  const calculateTotals = useCallback(() => {
    let subTotal = 0;
    let totalDiscount = 0;
    let totalTax = 0;
    let totalProfit = 0;

    items.forEach(item => {
      const itemTotal = item.sellingPrice * item.quantity;
      const itemDiscount = itemTotal * (item.discount / 100);
      const itemTax = (itemTotal - itemDiscount) * (item.tax / 100);
      const itemProfit = calculateProfit(
        item.buyingPrice,
        item.sellingPrice * (1 - item.discount / 100),
        item.quantity
      ).profit;

      subTotal += itemTotal;
      totalDiscount += itemDiscount;
      totalTax += itemTax;
      totalProfit += itemProfit;
    });

    const grandTotal = subTotal - totalDiscount + totalTax;

    return {
      subTotal,
      totalDiscount,
      totalTax,
      grandTotal,
      totalProfit,
    };
  }, [items]);

  const handleSubmit = async () => {
    if (items.length === 0) return;

    const payload = {
      items: items.map(item => ({
        product: item.productId,
        sku: item.sku,
        name: item.name,
        quantity: Number(item.quantity),
        buyingPrice: Number(item.buyingPrice),
        sellingPrice: Number(item.sellingPrice),
        discount: Number(item.discount) || 0,
        tax: Number(item.tax) || 0,
        profit: calculateProfit(
          item.buyingPrice,
          item.sellingPrice * (1 - (item.discount || 0) / 100),
          item.quantity
        ).profit,
      })),
      customerName: customer.name?.trim() || undefined,
      customerEmail: customer.email?.trim() || undefined,
      paymentMethod,
      saleType,
      notes: notes?.trim() || undefined,
    };

    try {
      await saleApi.create(payload);
      showToast.success('Sale created successfully.');
      onSuccess();
      resetForm();
      onClose();
    } catch (err: unknown) {
      let message = 'Failed to create sale. Check connection and try again.';
      if (err && typeof err === 'object') {
        if ('message' in err && typeof (err as { message: string }).message === 'string') {
          message = (err as { message: string }).message;
        } else if ('error' in err && typeof (err as { error: string }).error === 'string') {
          message = (err as { error: string }).error;
        }
      }
      showToast.error(message);
      console.error('Create sale error:', err);
    }
  };

  const resetForm = () => {
    setItems([]);
    setCustomer({ name: '', email: '' });
    setSaleType('offline');
    setPaymentMethod('cash');
    setNotes('');
    setSearchQuery('');
  };

  const totals = calculateTotals();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-xl bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="border-b border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-900/30">
                <ShoppingCart className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  New Sale
                </h2>
                <p className="text-gray-500">
                  Process a new sale transaction
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex h-[70vh]">
          {/* Left Panel - Product Selection */}
          <div className="w-1/2 border-r border-gray-200">
            <div className="p-6">
              <div className="mb-6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search products by name, SKU, or category..."
                    className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              <div className="space-y-2">
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className="h-16 w-full bg-gray-200 rounded-lg animate-pulse"
                    />
                  ))
                ) : (products?.products?.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500">
                      No products found
                    </p>
                  </div>
                ) : (
                  (products?.products ?? []).map((product: Product) => (
                    <button
                      key={product._id}
                      onClick={() => addItem(product)}
                      className="flex w-full items-center justify-between rounded-lg border border-gray-200 p-4 hover:border-blue-500 hover:bg-blue-50"
                    >
                      <div className="flex items-center space-x-3">
                        {product.images?.[0]?.url ? (
                          <img
                            src={product.images[0].url}
                            alt={product.name}
                            className="h-10 w-10 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-lg bg-gray-100" />
                        )}
                        <div className="text-left">
                          <p className="font-medium text-gray-900">
                            {product.name}
                          </p>
                          <p className="text-sm text-gray-500">
                            SKU: {product.sku} • Stock: {product.stockQuantity}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900">
                          ${product.sellingPrice.toFixed(2)}
                        </p>
                        <p className="text-sm text-green-600">
                          Margin: {product.profitMargin.toFixed(1)}%
                        </p>
                      </div>
                    </button>
                  ))))}
              </div>
            </div>
          </div>

          {/* Right Panel - Cart & Details */}
          <div className="w-1/2">
            <div className="flex h-full flex-col">
              {/* Cart Items */}
              <div className="flex-1 overflow-y-auto p-6">
                <h3 className="mb-4 text-lg font-semibold text-gray-900">
                  Cart ({items.length} items)
                </h3>
                
                {items.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center">
                    <ShoppingCart className="h-16 w-16 text-gray-300" />
                    <p className="mt-4 text-gray-500">
                      Add products to cart
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {items.map((item) => (
                      <div
                        key={item.productId}
                        className="rounded-lg border border-gray-200 bg-gray-50 p-4"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-gray-900">
                                  {item.name}
                                </p>
                                <p className="text-sm text-gray-500">
                                  SKU: {item.sku}
                                </p>
                              </div>
                              <button
                                onClick={() => removeItem(item.productId)}
                                className="rounded p-1 text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>

                            <div className="mt-4 grid grid-cols-4 gap-4">
                              <div>
                                <label className="block text-xs text-gray-500">
                                  Price
                                </label>
                                <input
                                  type="number"
                                  value={item.sellingPrice}
                                  onChange={(e) => updateItem(item.productId, {
                                    sellingPrice: parseFloat(e.target.value) || 0,
                                  })}
                                  className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                                  min="0"
                                  step="0.01"
                                />
                              </div>
                              
                              <div>
                                <label className="block text-xs text-gray-500">
                                  Qty
                                </label>
                                <div className="flex items-center">
                                  <button
                                    onClick={() => updateItem(item.productId, {
                                      quantity: Math.max(1, item.quantity - 1),
                                    })}
                                    className="rounded-l border border-gray-300 px-2 py-1"
                                  >
                                    <Minus className="h-3 w-3" />
                                  </button>
                                  <input
                                    type="number"
                                    value={item.quantity}
                                    onChange={(e) => updateItem(item.productId, {
                                      quantity: parseInt(e.target.value) || 1,
                                    })}
                                    className="w-12 border-y border-gray-300 px-2 py-1 text-center text-sm"
                                    min="1"
                                  />
                                  <button
                                    onClick={() => updateItem(item.productId, {
                                      quantity: item.quantity + 1,
                                    })}
                                    className="rounded-r border border-gray-300 px-2 py-1"
                                  >
                                    <Plus className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>
                              
                              <div>
                                <label className="block text-xs text-gray-500">
                                  Discount %
                                </label>
                                <div className="relative">
                                  <Percent className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-400" />
                                  <input
                                    type="number"
                                    value={item.discount}
                                    onChange={(e) => updateItem(item.productId, {
                                      discount: parseFloat(e.target.value) || 0,
                                    })}
                                    className="w-full rounded border border-gray-300 py-1 pl-6 pr-2 text-sm"
                                    min="0"
                                    max="100"
                                    step="0.1"
                                  />
                                </div>
                              </div>
                              
                              <div>
                                <label className="block text-xs text-gray-500">
                                  Total
                                </label>
                                <p className="font-bold">
                                  ${(item.sellingPrice * item.quantity * (1 - item.discount / 100)).toFixed(2)}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Summary & Customer Details */}
              <div className="border-t border-gray-200 p-6">
                {/* Customer Details */}
                <div className="mb-6">
                  <h4 className="mb-3 text-sm font-medium text-gray-700">
                    Customer Details (Optional)
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={customer.name}
                      onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                      placeholder="Customer Name"
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                    <input
                      type="email"
                      value={customer.email}
                      onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
                      placeholder="Email Address"
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                {/* Sale Configuration */}
                <div className="mb-6 grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Sale Type
                    </label>
                    <div className="flex space-x-2">
                      {(['online', 'offline'] as const).map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setSaleType(type)}
                          className={cn(
                            'flex-1 rounded-lg border px-3 py-2 text-sm font-medium capitalize',
                            saleType === type
                              ? 'border-blue-500 bg-blue-50 text-blue-600'
                              : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                          )}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Payment Method
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as 'cash' | 'card' | 'upi' | 'bank_transfer' | 'credit')}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                    >
                      <option value="cash">Cash</option>
                      <option value="card">Credit Card</option>
                      <option value="upi">UPI</option>
                      <option value="bank_transfer">Bank Transfer</option>
                    </select>
                  </div>
                </div>

                {/* Totals */}
                <div className="mb-6 space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Subtotal</span>
                    <span className="font-medium">${totals.subTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Discount</span>
                    <span className="font-medium text-red-600">
                      -${totals.totalDiscount.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tax</span>
                    <span className="font-medium">${totals.totalTax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t border-gray-200 pt-2">
                    <span className="font-semibold">Total</span>
                    <span className="text-xl font-bold text-gray-900">
                      ${totals.grandTotal.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Estimated Profit</span>
                    <span className={cn(
                      'font-bold',
                      totals.totalProfit >= 0
                        ? 'text-green-600'
                        : 'text-red-600'
                    )}>
                      ${totals.totalProfit.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Notes */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add any notes for this sale..."
                    rows={2}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between">
                  <button
                    onClick={onClose}
                    className="rounded-lg border border-gray-300 px-6 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={items.length === 0}
                    className="rounded-lg bg-green-600 px-8 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    Complete Sale
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default NewSaleModal;