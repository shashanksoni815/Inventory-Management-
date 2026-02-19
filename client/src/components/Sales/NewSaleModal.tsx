import React, { useState, useCallback, useEffect } from 'react';
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
import { useFranchise } from '@/contexts/FranchiseContext';
import { cn, calculateProfit } from '@/lib/utils';
import { showToast } from '@/services/toast';

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
  const { currentFranchise, franchises } = useFranchise();
  
  // Initialize franchiseId state - use currentFranchise or first franchise as default
  const getInitialFranchiseId = (): string | undefined => {
    if (currentFranchise) {
      const id = (currentFranchise as any)?._id || (currentFranchise as any)?.id;
      const idStr = id ? String(id).trim() : '';
      return idStr && idStr.length > 0 ? idStr : undefined;
    } else if (franchises && franchises.length > 0) {
      const firstFranchise = franchises[0];
      const id = (firstFranchise as any)?._id || (firstFranchise as any)?.id;
      const idStr = id ? String(id).trim() : '';
      return idStr && idStr.length > 0 ? idStr : undefined;
    }
    return undefined;
  };
  
  const [franchiseId, setFranchiseId] = useState<string | undefined>(getInitialFranchiseId());

  const { data: productsData, isPending, error } = useQuery({
    queryKey: ['products-for-sale', searchQuery],
    queryFn: async () => {
      try {
        const response = await productApi.getAll({
          franchise: 'all',
          search: searchQuery || undefined,
          status: 'active',
          limit: 100,
        });
        
        const data = response as any;
        const products = Array.isArray(data) ? data : data.products || [];
        
        // Map to clean structure: { _id, name, sku, sellingPrice, buyingPrice, stock, franchise }
        return products.map((p: any) => ({
          _id: p._id || p.id || '',
          name: p.name || p.productName || p.title || `Product ${p._id || p.id || ''}`,
          sku: (p.sku || p.productSku || '').toString().trim() || '',
          sellingPrice: Number(p.sellingPrice ?? p.price ?? 0) || 0,
          buyingPrice: Number(p.buyingPrice ?? p.costPrice ?? 0) || 0,
          stock: Number(p.stockQuantity ?? p.stock ?? p.franchiseStock ?? 0) || 0,
          franchise: p.franchise || franchiseId || '',
        }));
      } catch (err: any) {
        showToast.error(err?.message || 'Failed to load products');
        throw err;
      }
    },
    enabled: isOpen,
    staleTime: 30000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const products = productsData || [];

  // Clear cart when franchise changes
  const prevFranchiseIdRef = React.useRef<string | undefined>(franchiseId);
  useEffect(() => {
    // If franchise changed and we have items in cart, clear the cart
    if (prevFranchiseIdRef.current !== undefined && 
        prevFranchiseIdRef.current !== franchiseId && 
        items.length > 0) {
      setItems([]);
      showToast.success('Cart cleared: franchise changed');
    }
    prevFranchiseIdRef.current = franchiseId;
  }, [franchiseId, items.length]);

  const addToCart = useCallback((product: any) => {
    if (!product._id) {
      showToast.error('Invalid product: missing ID');
      return;
    }
    
    const existingItem = items.find(item => item.productId === product._id);
    
    if (existingItem) {
      setItems(items.map(item =>
        item.productId === product._id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      const newItem: SaleItemRow = {
        productId: product._id,
        sku: product.sku || '',
        name: product.name || 'Unknown Product',
        quantity: 1,
        buyingPrice: product.buyingPrice || 0,
        sellingPrice: product.sellingPrice || 0,
        discount: 0,
        tax: 10,
      };
      setItems(prev => [...prev, newItem]);
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

    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/3fc7926a-846a-45b6-a134-1306e0ccfd99',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'NewSaleModal.tsx:175',message:'handleSubmit called',data:{franchiseId:franchiseId,franchiseIdType:typeof franchiseId,itemsLength:items.length,currentFranchise:currentFranchise,franchises:franchises},timestamp:Date.now(),runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    // Ensure franchiseId is a valid string
    const validFranchiseId = franchiseId && typeof franchiseId === 'string' ? franchiseId.trim() : '';
    
    if (!validFranchiseId || validFranchiseId.length === 0) {
      showToast.error('Please select a franchise first');
      return;
    }

    // Validate franchiseId looks like a MongoDB ObjectId (24 hex characters)
    if (!/^[0-9a-fA-F]{24}$/.test(validFranchiseId)) {
      showToast.error('Invalid franchise ID format');
      return;
    }

    // Products can be from any franchise (global products available to all)

    const mappedItems = items
      .filter(item => item.productId && item.quantity > 0) // Filter first to ensure productId exists
      .map(item => ({
        product: String(item.productId!),
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
      })); // Map after filtering ensures product is always a string

    if (mappedItems.length === 0) {
      showToast.error('No valid items to add to sale');
      return;
    }

    // Final validation before sending
    if (!saleType || (saleType !== 'online' && saleType !== 'offline')) {
      showToast.error('Invalid sale type');
      return;
    }

    if (!paymentMethod || !['cash', 'card', 'upi', 'bank_transfer', 'credit'].includes(paymentMethod)) {
      showToast.error('Invalid payment method');
      return;
    }

    const payload = {
      franchise: validFranchiseId,
      items: mappedItems,
      saleType,
      paymentMethod,
      customerName: customer.name?.trim() || undefined,
      customerEmail: customer.email?.trim() || undefined,
      notes: notes?.trim() || undefined,
      total: totals.grandTotal,
    };

    // Creating sale

    try {
      await saleApi.create(payload);
      showToast.success('Sale created successfully.');
      onSuccess();
      resetForm();
      onClose();
    } catch (err: any) {
      let message = 'Failed to create sale. Check connection and try again.';
      
      // Extract error message - handle axios interceptor format
      if (err?.response?.data) {
        const errorData = err.response.data;
        if (errorData.message) {
          message = errorData.message;
        } else if (errorData.error) {
          message = typeof errorData.error === 'string' ? errorData.error : String(errorData.error);
        } else if (Array.isArray(errorData.errors)) {
          message = errorData.errors.join(', ');
        } else if (typeof errorData === 'string') {
          message = errorData;
        }
      } else if (err?.message && typeof err.message === 'string') {
        message = err.message;
      } else if (typeof err === 'string') {
        message = err;
      }
      
      showToast.error(message);
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
          
          {/* Franchise Selector */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Franchise *
            </label>
            <select
              value={franchiseId || ''}
              onChange={(e) => {
                const newFranchiseId = e.target.value;
                if (newFranchiseId !== franchiseId) {
                  setItems([]); // Clear cart when franchise changes
                }
                setFranchiseId(newFranchiseId || undefined);
              }}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="">Select a franchise</option>
              {franchises && franchises.map((f: any) => {
                const fId = f._id || f.id;
                return (
                  <option key={fId} value={fId}>
                    {f.name} {f.code ? `(${f.code})` : ''}
                  </option>
                );
              })}
            </select>
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

              <div className="space-y-2 max-h-[calc(70vh-120px)] overflow-y-auto">
                {isPending ? (
                  [...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className="h-16 w-full bg-gray-200 rounded-lg animate-pulse"
                    />
                  ))
                ) : error ? (
                  <div className="text-center py-8">
                    <p className="text-red-600 font-medium">
                      Error loading products
                    </p>
                    <p className="text-sm text-gray-500 mt-2">
                      {error instanceof Error ? error.message : 'Unknown error'}
                    </p>
                  </div>
                ) : products.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500 font-medium">
                      No products found
                    </p>
                    <p className="text-sm text-gray-400 mt-2">
                      Try adjusting your search or check if products exist.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {products.map((product: any) => (
                      <div key={product._id} className="product-card rounded-lg border border-gray-200 bg-white p-4 hover:border-blue-500 hover:shadow-md transition-all">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-gray-900 text-base mb-1">
                              {product.name}
                            </p>
                            <p className="text-sm text-gray-600 mb-1">
                              SKU: {product.sku || 'N/A'}
                            </p>
                            <p className="text-lg font-bold text-gray-900 mb-1">
                              ₹{product.sellingPrice?.toFixed(2) || '0.00'}
                            </p>
                            <p className="text-sm text-gray-500">
                              Stock: {product.stock ?? 0}
                            </p>
                          </div>
                          <button
                            onClick={() => addToCart(product)}
                            className="btn-primary ml-4 rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors whitespace-nowrap"
                          >
                            Add to Sale
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Panel - Cart & Details */}
          <div className="w-1/2">
            <div className="flex overflow-y-auto h-full flex-col max-h-[calc(70vh-120px)]">
              {/* Cart Items */}
              <div className="flex-1  p-6">
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
                                  {item.name || 'Unknown Product'}
                                </p>
                                <p className="text-sm text-gray-500">
                                  SKU: {item.sku || 'N/A'}
                                </p>
                              </div>
                              <button
                                onClick={() => removeItem(item.productId)}
                                className="rounded p-1 text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>

                            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
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
                                  ₹{(item.sellingPrice * item.quantity * (1 - item.discount / 100)).toFixed(2)}
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
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
                <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
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
                    <span className="font-medium">₹{totals.subTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Discount</span>
                    <span className="font-medium text-red-600">
                      -₹{totals.totalDiscount.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tax</span>
                    <span className="font-medium">₹{totals.totalTax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t border-gray-200 pt-2">
                    <span className="font-semibold">Total</span>
                    <span className="text-xl font-bold text-gray-900">
                      ₹{totals.grandTotal.toFixed(2)}
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
                      ₹{totals.totalProfit.toFixed(2)}
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
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-0">
                  <button
                    onClick={onClose}
                    className="w-full sm:w-auto rounded-lg border border-gray-300 px-6 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={items.length === 0}
                    className="w-full sm:w-auto rounded-lg bg-green-600 px-8 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
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
