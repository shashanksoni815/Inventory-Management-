import React, { useState, useCallback, useEffect, useMemo } from 'react';
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
  const { currentFranchise, franchises } = useFranchise();
  
  // Extract franchiseId with better fallback handling
  let franchiseId: string | undefined = undefined;
  if (currentFranchise) {
    franchiseId = (currentFranchise as any)?._id || (currentFranchise as any)?.id || undefined;
  } else if (franchises && franchises.length > 0) {
    // Fallback to first franchise if currentFranchise is null
    const firstFranchise = franchises[0];
    franchiseId = (firstFranchise as any)?._id || (firstFranchise as any)?.id || undefined;
    console.warn('[NewSaleModal] No currentFranchise, using first available franchise:', franchiseId);
  }

  // #region agent log
  console.log('[NewSaleModal] Query setup:', { 
    isOpen, 
    franchiseId, 
    searchQuery, 
    hasFranchise: !!currentFranchise, 
    currentFranchise,
    franchisesCount: franchises?.length || 0,
    franchiseIdSource: currentFranchise ? 'currentFranchise' : (franchises?.length > 0 ? 'firstFranchise' : 'none')
  });
  // #endregion

  const { data: productsData, isLoading, error } = useQuery({
    queryKey: ['products-for-sale', franchiseId, searchQuery],
    queryFn: async () => {
      // #region agent log
      console.log('[NewSaleModal] API call params:', { franchise: franchiseId, search: searchQuery || undefined, status: 'active', limit: 10 });
      // #endregion
      if (!franchiseId) {
        console.warn('[NewSaleModal] No franchiseId provided, query will not run');
        return { products: [], pagination: { page: 1, limit: 10, total: 0, pages: 0 } };
      }
      try {
        // Make raw API call to see actual response
        const apiResponse = await productApi.getAll({
          franchise: franchiseId,
          search: searchQuery || undefined,
          status: 'active',
          limit: 100, // Increased limit to get more products
        });
        
        // #region agent log
        console.log('[NewSaleModal] Raw API response:', { 
          apiResponse, 
          type: typeof apiResponse, 
          isArray: Array.isArray(apiResponse), 
          keys: apiResponse && typeof apiResponse === 'object' ? Object.keys(apiResponse) : [],
          hasProducts: !!(apiResponse as any)?.products, 
          hasData: !!(apiResponse as any)?.data,
          productsType: typeof (apiResponse as any)?.products,
          productsIsArray: Array.isArray((apiResponse as any)?.products),
          productsCount: Array.isArray((apiResponse as any)?.products) ? (apiResponse as any).products.length : 0,
          firstProduct: Array.isArray((apiResponse as any)?.products) ? (apiResponse as any).products[0] : null,
          firstProductName: Array.isArray((apiResponse as any)?.products) ? (apiResponse as any).products[0]?.name : null,
          stringified: JSON.stringify(apiResponse).substring(0, 500)
        });
        // #endregion
        
        // Validate response structure
        if (!apiResponse) {
          console.warn('[NewSaleModal] API returned null/undefined');
          return { products: [], pagination: { page: 1, limit: 10, total: 0, pages: 0 } };
        }
        
        // Ensure we return the correct shape
        let result = apiResponse;
        
        // If response is just an array, wrap it
        if (Array.isArray(apiResponse)) {
          result = { products: apiResponse, pagination: { page: 1, limit: 100, total: apiResponse.length, pages: 1 } };
        }
        // If response has data wrapper, unwrap it
        else if ((apiResponse as any)?.data && (apiResponse as any).data.products) {
          result = (apiResponse as any).data;
        }
        // If response has products at root, use as-is
        else if ((apiResponse as any)?.products) {
          result = apiResponse;
        }
        // Otherwise, assume empty
        else {
          console.warn('[NewSaleModal] Unexpected response shape:', apiResponse);
          result = { products: [], pagination: { page: 1, limit: 10, total: 0, pages: 0 } };
        }
        
        // #region agent log
        console.log('[NewSaleModal] Normalized result:', {
          result,
          productsCount: result.products?.length || 0,
          firstProduct: result.products?.[0] || null
        });
        // #endregion
        
        return result;
      } catch (err: any) {
        // #region agent log
        console.error('[NewSaleModal] API error:', err, { message: err?.message, response: err?.response?.data });
        // #endregion
        // Show user-friendly error
        showToast.error(err?.message || 'Failed to load products');
        throw err;
      }
    },
    enabled: isOpen && !!franchiseId,
    // Add retry logic and better error handling
    staleTime: 30000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
    refetchOnWindowFocus: false,
  });
  
  // Handle query success/error with useEffect (React Query v5 removed onSuccess/onError)
  useEffect(() => {
    if (productsData && !isLoading && !error) {
      console.log('[NewSaleModal] Query SUCCESS:', { 
        productsData, 
        hasProducts: !!(productsData as any)?.products,
        productsCount: (productsData as any)?.products?.length || 0,
        firstProduct: (productsData as any)?.products?.[0] || null
      });
    }
    if (error) {
      console.error('[NewSaleModal] Query ERROR:', error);
    }
  }, [productsData, isLoading, error]);

  // #region agent log
  console.log('[NewSaleModal] productsData raw response:', { 
    productsData, 
    isLoading, 
    error, 
    hasProducts: !!(productsData as any)?.products, 
    hasData: !!(productsData as any)?.data, 
    type: typeof productsData, 
    isArray: Array.isArray(productsData), 
    keys: productsData ? Object.keys(productsData) : [],
    stringified: productsData ? JSON.stringify(productsData).substring(0, 1000) : 'null'
  });
  // #endregion

  // Handle different response shapes: productsData.products, productsData.data.products, or productsData as array
  // Match the pattern from CreateOrder.tsx exactly
  // IMPORTANT: After axios interceptor, productsData should be { products: [...], pagination: {...} }
  const rawProducts: any[] = useMemo(() => {
    if (!productsData) {
      console.log('[NewSaleModal] productsData is null/undefined');
      return [];
    }
    
    const data = productsData as any;
    
    // After axios interceptor unwraps { success: true, data: {...} }, we should get { products: [...], pagination: {...} }
    // So data.products should be the array
    let list: any[] = [];
    
    if (Array.isArray(data)) {
      list = data;
      console.log('[NewSaleModal] productsData is array, using directly');
    } else if (Array.isArray(data?.products)) {
      list = data.products;
      console.log('[NewSaleModal] Found data.products array');
    } else if (Array.isArray(data?.data?.products)) {
      list = data.data.products;
      console.log('[NewSaleModal] Found data.data.products array');
    } else if (Array.isArray(data?.data)) {
      list = data.data;
      console.log('[NewSaleModal] Found data.data array');
    } else {
      console.warn('[NewSaleModal] Unexpected productsData shape:', {
        type: typeof productsData,
        isArray: Array.isArray(productsData),
        keys: data ? Object.keys(data) : [],
        hasProducts: !!(data?.products),
        hasData: !!(data?.data),
        productsDataType: typeof data?.products,
        productsDataIsArray: Array.isArray(data?.products),
        fullData: JSON.stringify(data).substring(0, 500)
      });
      list = [];
    }
    
    console.log('[NewSaleModal] Extracted raw products:', {
      productsDataType: typeof productsData,
      isArray: Array.isArray(productsData),
      hasProducts: !!(data?.products),
      hasDataProducts: !!(data?.data?.products),
      extractedCount: list.length,
      firstProduct: list[0] || null,
      firstProductName: list[0]?.name || null,
      firstProductNameType: typeof list[0]?.name,
      firstProductKeys: list[0] ? Object.keys(list[0]) : [],
      firstProductFull: list[0] ? JSON.stringify(list[0]).substring(0, 300) : null
    });
    
    return Array.isArray(list) ? list : [];
  }, [productsData]);
  
  // #region agent log
  console.log('[NewSaleModal] Raw products before normalization:', { 
    count: rawProducts.length, 
    firstRaw: rawProducts[0],
    firstRawName: rawProducts[0]?.name,
    firstRawNameType: typeof rawProducts[0]?.name,
    firstRawKeys: rawProducts[0] ? Object.keys(rawProducts[0]) : [],
    allRawNames: rawProducts.slice(0, 3).map(p => ({ id: p._id, name: p.name, hasName: !!p.name }))
  });
  // #endregion
  
  // Ensure all products have required fields with fallbacks - preserve all original fields
  // Use useMemo to ensure consistent normalization (similar to CreateOrder.tsx)
  const products: Product[] = useMemo(() => rawProducts.map((p: any, index: number) => {
    // Log first 3 products during normalization
    if (index < 3) {
      console.log(`[NewSaleModal] Normalizing product ${index}:`, {
        originalName: p.name,
        originalNameType: typeof p.name,
        originalNameValue: String(p.name || 'NULL'),
        originalProductName: p.productName,
        originalKeys: Object.keys(p),
        hasNameKey: 'name' in p,
        nameValue: p.name,
        fullOriginal: JSON.stringify(p).substring(0, 500)
      });
    }
    
    // Safely extract name - handle null, undefined, empty string, and "undefined" string
    // Check multiple possible name fields
    let productName: string = '';
    
    // Try multiple sources for name
    if (p.name && typeof p.name === 'string' && p.name.trim() !== '' && p.name !== 'undefined' && p.name !== 'null') {
      productName = p.name.trim();
    } else if (p.productName && typeof p.productName === 'string' && p.productName.trim() !== '') {
      productName = p.productName.trim();
    } else if (p.title && typeof p.title === 'string' && p.title.trim() !== '') {
      productName = p.title.trim();
    } else {
      // Fallback to generated name
      productName = `Product ${p._id || p.id || index}`;
      console.warn(`[NewSaleModal] Product ${index} missing name, using fallback:`, {
        _id: p._id,
        sku: p.sku,
        availableFields: Object.keys(p)
      });
    }
    
    // Ensure name is never empty
    if (!productName || productName.trim() === '') {
      productName = `Product ${p._id || p.id || index}`;
    }
    
    const normalized: any = {
      ...p, // Preserve all original fields FIRST
      // Then override with normalized values, ensuring they're never undefined/null
      _id: p._id || p.id || '',
      name: productName, // Already validated above - guaranteed to be non-empty string
      sku: (p.sku || p.productSku || '').toString().trim() || '',
      sellingPrice: Number(p.sellingPrice ?? p.price ?? 0) || 0,
      buyingPrice: Number(p.buyingPrice ?? p.costPrice ?? 0) || 0,
      stockQuantity: Number(p.stockQuantity ?? p.stock ?? p.franchiseStock ?? 0) || 0,
      profitMargin: Number(p.profitMargin ?? 0) || 0,
      category: p.category || 'Other',
      status: p.status || 'active',
      images: Array.isArray(p.images) ? p.images : [],
    };
    
    // Final validation - name MUST exist and be non-empty
    if (!normalized.name || typeof normalized.name !== 'string' || normalized.name.trim() === '') {
      console.error(`[NewSaleModal] CRITICAL: Product ${index} still missing name after normalization:`, {
        original: p,
        normalized,
        _id: normalized._id,
        nameValue: normalized.name,
        nameType: typeof normalized.name
      });
      normalized.name = `Product ${normalized._id || index}`;
    }
    
    // #region agent log
    if (index < 3) {
      console.log(`[NewSaleModal] Normalized product ${index}:`, { 
        original: p, 
        normalized, 
        nameSet: normalized.name,
        nameType: typeof normalized.name,
        nameLength: normalized.name.length,
        nameValue: `"${normalized.name}"`,
        willRender: true
      });
    }
    // #endregion
    
    return normalized as Product;
  }), [rawProducts]);
  
  // Final validation of all products - ensure EVERY product has a name
  const productsWithoutNames = products.filter(p => !p.name || typeof p.name !== 'string' || p.name.trim() === '');
  if (productsWithoutNames.length > 0) {
    console.error('[NewSaleModal] CRITICAL: Some normalized products still missing names:', {
      count: productsWithoutNames.length,
      products: productsWithoutNames.map(p => ({ id: p._id, name: p.name, nameType: typeof p.name }))
    });
    // Force set names for products missing them
    productsWithoutNames.forEach((p, idx) => {
      const productIndex = products.indexOf(p);
      if (productIndex >= 0) {
        products[productIndex].name = `Product ${p._id || p.sku || idx}`;
        console.warn(`[NewSaleModal] Forced name for product ${productIndex}:`, products[productIndex].name);
      }
    });
  }
  
  // Final check - ensure all products have names before rendering
  const finalProducts = products.map((p, idx) => {
    if (!p.name || typeof p.name !== 'string' || p.name.trim() === '') {
      console.error(`[NewSaleModal] FINAL CHECK: Product ${idx} missing name, forcing:`, {
        product: p,
        _id: p._id
      });
      return { ...p, name: `Product ${p._id || p.sku || idx}` };
    }
    return p;
  });
  
  // Use finalProducts instead of products - ensure it's always defined
  const safeProducts: Product[] = finalProducts.length > 0 ? finalProducts : products.map((p, idx) => ({
    ...p,
    name: p.name || `Product ${p._id || p.sku || idx}`
  }));
  
  // Final validation - log if any safe products are missing names
  const safeProductsWithoutNames = safeProducts.filter(p => !p.name || typeof p.name !== 'string' || p.name.trim() === '');
  if (safeProductsWithoutNames.length > 0) {
    console.error('[NewSaleModal] CRITICAL: Safe products still missing names!', {
      count: safeProductsWithoutNames.length,
      products: safeProductsWithoutNames
    });
  }
  
  console.log('[NewSaleModal] Safe products final check:', {
    count: safeProducts.length,
    allHaveNames: safeProducts.every(p => p.name && typeof p.name === 'string' && p.name.trim() !== ''),
    firstProductName: safeProducts[0]?.name || 'N/A',
    allNames: safeProducts.slice(0, 3).map(p => p.name || 'NO NAME')
  });
  
  // Log query status after products are processed
  useEffect(() => {
    console.log('[NewSaleModal] Query Status Change:', {
      isOpen,
      franchiseId,
      queryEnabled: isOpen && !!franchiseId,
      isLoading,
      error: error ? String(error) : null,
      hasData: !!productsData,
      productsCount: products.length,
      rawProductsCount: rawProducts.length,
      safeProductsCount: safeProducts.length
    });
  }, [isOpen, franchiseId, isLoading, error, productsData, products.length, rawProducts.length, safeProducts.length]);

  // #region agent log
  console.log('[NewSaleModal] products extracted:', { 
    productsLength: products.length, 
    safeProductsLength: safeProducts.length,
    productsType: typeof products, 
    isArray: Array.isArray(products), 
    firstProduct: products[0]?._id || null, 
    firstProductName: products[0]?.name || null,
    firstSafeProductName: safeProducts[0]?.name || null,
    firstProductFull: products[0],
    productsWithoutNamesCount: productsWithoutNames.length
  });
  // #endregion

  useEffect(() => {
    // #region agent log
    console.log('[NewSaleModal] products changed effect:', { 
      productsLength: products.length, 
      isLoading, 
      firstProduct: products[0]?._id || null, 
      firstProductName: products[0]?.name || 'undefined', 
      hasName: !!products[0]?.name, 
      firstProductFull: products[0],
      allProductNames: products.slice(0, 5).map(p => p.name || 'NO NAME')
    });
    // #endregion
  }, [products, isLoading]);

  // Log whenever productsData changes
  useEffect(() => {
    // #region agent log
    console.log('[NewSaleModal] productsData changed:', {
      productsData,
      hasProducts: !!(productsData as any)?.products,
      productsCount: (productsData as any)?.products?.length || 0,
      isLoading,
      error
    });
    // #endregion
  }, [productsData, isLoading, error]);

  const addItem = useCallback((product: Product | any) => {
    // #region agent log
    console.log('[NewSaleModal] addItem called:', { productId: product._id, productName: product.name, productSku: product.sku, hasName: !!product.name, productFull: product });
    // #endregion
    
    // Ensure product has required fields
    const safeProduct = {
      _id: product._id || product.id,
      name: product.name || product.productName || 'Unknown Product',
      sku: product.sku || product.productSku || '',
      buyingPrice: product.buyingPrice ?? product.costPrice ?? 0,
      sellingPrice: product.sellingPrice ?? product.price ?? 0,
    };
    
    if (!safeProduct._id) {
      console.error('[NewSaleModal] Cannot add product without ID:', product);
      showToast.error('Invalid product: missing ID');
      return;
    }
    
    const existingItem = items.find(item => item.productId === safeProduct._id);
    
    if (existingItem) {
      setItems(items.map(item =>
        item.productId === safeProduct._id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      const newItem = {
        productId: safeProduct._id,
        sku: safeProduct.sku,
        name: safeProduct.name,
        quantity: 1,
        buyingPrice: safeProduct.buyingPrice,
        sellingPrice: safeProduct.sellingPrice,
        discount: 0,
        tax: 10, // Default tax rate
      };
      // #region agent log
      console.log('[NewSaleModal] Adding new item:', newItem);
      // #endregion
      setItems([
        ...items,
        newItem,
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

        {/* Debug Panel - Remove after fixing */}
        {(import.meta.env.DEV || import.meta.env.MODE === 'development') && (
          <div className="border-b border-gray-200 bg-yellow-50 p-2 text-xs space-y-1">
            <div><strong>🔍 DEBUG PANEL:</strong></div>
            <div>Modal Open: {isOpen ? 'YES ✅' : 'NO ❌'}</div>
            <div>FranchiseId: <span className={franchiseId ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>{franchiseId || '❌ NOT SET'}</span></div>
            <div>Query Enabled: <span className={(isOpen && !!franchiseId) ? 'text-green-600' : 'text-red-600'}>{(isOpen && !!franchiseId) ? 'YES ✅' : 'NO ❌'}</span></div>
            <div>Loading: {isLoading ? 'YES ⏳' : 'NO ✅'}</div>
            <div>Error: {error ? <span className="text-red-600 font-bold">{String(error)}</span> : 'NONE ✅'}</div>
            <div>ProductsData Exists: {productsData ? 'YES ✅' : 'NO ❌'}</div>
            <div>Raw Products Count: <span className={rawProducts.length > 0 ? 'text-green-600 font-bold' : 'text-red-600'}>{rawProducts.length}</span></div>
            <div>Normalized Products Count: <span className={products.length > 0 ? 'text-green-600 font-bold' : 'text-red-600'}>{products.length}</span></div>
            <div>Safe Products Count: <span className={safeProducts.length > 0 ? 'text-green-600 font-bold' : 'text-red-600'}>{safeProducts.length}</span></div>
            <div>First Raw Product Name: <span className={rawProducts[0]?.name ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>{rawProducts[0]?.name || '❌ MISSING'}</span></div>
            <div>First Normalized Product Name: <span className={products[0]?.name ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>{products[0]?.name || '❌ MISSING'}</span></div>
            <div>First Safe Product Name: <span className={safeProducts[0]?.name ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>{safeProducts[0]?.name || '❌ MISSING'}</span></div>
            <div>Products Without Names: <span className={productsWithoutNames.length === 0 ? 'text-green-600' : 'text-red-600 font-bold'}>{productsWithoutNames.length}</span></div>
            <div className="text-xs mt-1">First Safe Product Full: {safeProducts[0] ? JSON.stringify(safeProducts[0]).substring(0, 300) : 'N/A'}</div>
          </div>
        )}

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
                {!franchiseId ? (
                  <div className="text-center py-8">
                    <p className="text-red-600 font-medium">
                      Please select a franchise first
                    </p>
                    <p className="text-sm text-gray-500 mt-2">
                      Products cannot be loaded without a franchise selection
                    </p>
                  </div>
                ) : isLoading ? (
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
                ) : safeProducts.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500 font-medium">
                      No products found
                    </p>
                    <p className="text-sm text-gray-400 mt-2">
                      {franchiseId ? 'Try adjusting your search or check if products exist for this franchise.' : 'Please select a franchise first.'}
                    </p>
                    {/* Debug info for empty state */}
                    {(import.meta.env?.DEV || import.meta.env?.MODE === 'development') && (
                      <div className="mt-4 rounded bg-gray-100 p-2 text-xs text-left">
                        <div>FranchiseId: {franchiseId || 'NOT SET'}</div>
                        <div>Raw Products: {rawProducts.length}</div>
                        <div>Normalized Products: {products.length}</div>
                        <div>Safe Products: {safeProducts.length}</div>
                        <div>ProductsData: {productsData ? 'EXISTS' : 'NULL'}</div>
                        <div>Loading: {isLoading ? 'YES' : 'NO'}</div>
                        <div>Error: {error ? String(error) : 'NONE'}</div>
                      </div>
                    )}
                    {/* #region agent log */}
                    {(() => { console.log('[NewSaleModal] Empty products state:', { franchiseId, searchQuery, productsData, rawProductsCount: rawProducts.length, productsCount: products.length, safeProductsCount: safeProducts.length }); return null; })()}
                    {/* #endregion */}
                  </div>
                ) : (
                  <>
                    {/* DIRECT TEST: Render raw products without any normalization - MOST VISIBLE */}
                    {(import.meta.env.DEV || import.meta.env.MODE === 'development') && rawProducts.length > 0 && (
                      <div className="mb-4 rounded border-4 border-purple-500 bg-purple-100 p-4">
                        <h3 className="font-bold text-purple-900 mb-2 text-lg">🔍 DIRECT TEST - Raw Products (No Processing):</h3>
                        {rawProducts.slice(0, 3).map((rawProduct: any, idx: number) => (
                          <div key={idx} className="mb-2 p-2 bg-white rounded border">
                            <div><strong>Product {idx + 1}:</strong></div>
                            <div>ID: {rawProduct._id || rawProduct.id || 'N/A'}</div>
                            <div>Name (raw): <span className={rawProduct.name ? 'text-green-600 font-bold text-lg' : 'text-red-600 font-bold text-lg'}>{String(rawProduct.name || '❌ MISSING')}</span></div>
                            <div>Name Type: {typeof rawProduct.name}</div>
                            <div>Name Value: "{String(rawProduct.name || 'NULL')}"</div>
                            <div>All Keys: {Object.keys(rawProduct).join(', ')}</div>
                            <div className="text-xs mt-1">Full Object: {JSON.stringify(rawProduct).substring(0, 300)}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Debug: Show raw API response and product data */}
                    {(import.meta.env.DEV || import.meta.env.MODE === 'development') && (
                      <div className="mb-4 space-y-2">
                        {/* Raw API Response */}
                        <div className="rounded border-2 border-blue-300 bg-blue-50 p-2 text-xs">
                          <strong className="text-blue-800">RAW API RESPONSE (productsData):</strong>
                          <div className="mt-1 max-h-40 overflow-auto">
                            <pre className="whitespace-pre-wrap wrap-break-word">
                              {productsData ? JSON.stringify(productsData, null, 2).substring(0, 2000) : 'NULL'}
                            </pre>
                          </div>
                          <div className="mt-1">
                            Type: {typeof productsData} | 
                            IsArray: {Array.isArray(productsData) ? 'YES' : 'NO'} | 
                            Has Products: {productsData && (productsData as any).products ? 'YES' : 'NO'} |
                            Products Count: {productsData && (productsData as any).products ? (productsData as any).products.length : 'N/A'}
                          </div>
                        </div>
                        
                        {/* Raw Products Array */}
                        {rawProducts.length > 0 && (
                          <div className="rounded border-2 border-green-300 bg-green-50 p-2 text-xs">
                            <strong className="text-green-800">RAW PRODUCTS ARRAY (before normalization):</strong>
                            <div className="mt-1 max-h-40 overflow-auto">
                              <pre className="whitespace-pre-wrap wrap-break-word">
                                {JSON.stringify(rawProducts.slice(0, 2), null, 2).substring(0, 2000)}
                              </pre>
                            </div>
                            <div className="mt-1">
                              Count: {rawProducts.length} | 
                              First Name: <span className="font-bold">{String(rawProducts[0]?.name || 'UNDEFINED')}</span> |
                              First Name Type: {typeof rawProducts[0]?.name}
                            </div>
                          </div>
                        )}
                        
                        {/* Normalized Products */}
                        {products.length > 0 && (
                          <div className="rounded border-2 border-red-300 bg-red-50 p-2 text-xs">
                            <strong className="text-red-800">NORMALIZED PRODUCTS (after processing):</strong>
                            <div className="mt-1 max-h-40 overflow-auto">
                              <pre className="whitespace-pre-wrap wrap-break-word">
                                {JSON.stringify(products.slice(0, 2), null, 2).substring(0, 2000)}
                              </pre>
                            </div>
                            <div className="mt-1">
                              Count: {products.length} | 
                              First Name: <span className="font-bold">{String(products[0]?.name || 'UNDEFINED')}</span> |
                              First Name Type: {typeof products[0]?.name} |
                              Products Without Names: {products.filter(p => !p.name || p.name.trim() === '').length}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {/* SIMPLE TEST: Render raw products directly without normalization - ALWAYS VISIBLE */}
                    {rawProducts.length > 0 && (
                      <div className="mb-4 rounded border-4 border-orange-500 bg-orange-100 p-4">
                        <h4 className="font-bold text-orange-900 mb-3 text-xl">🔍 SIMPLE TEST - Raw Products (No Processing):</h4>
                        {rawProducts.slice(0, 3).map((p: any, i: number) => (
                          <div key={i} className="mb-3 p-3 bg-white rounded border-2" style={{ borderColor: p.name ? 'green' : 'red' }}>
                            <div className="font-bold text-xl mb-2" style={{ color: p.name ? 'green' : 'red' }}>
                              Product {i + 1} Name: {p.name ? `"${p.name}"` : `❌ MISSING - ID: ${p._id}`}
                            </div>
                            <div className="text-sm text-gray-600 mb-1">SKU: {p.sku || 'N/A'}</div>
                            <div className="text-xs text-gray-500">
                              Name Type: {typeof p.name} | 
                              Name Value: "{String(p.name || 'NULL')}" | 
                              Has Name: {p.name ? 'YES ✅' : 'NO ❌'} |
                              All Keys: {Object.keys(p).join(', ')}
                            </div>
                            <div className="text-xs mt-1 bg-gray-50 p-1 rounded">
                              Full Product: {JSON.stringify(p).substring(0, 400)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* DIRECT RENDER TEST: Render normalized products directly */}
                    {products.length > 0 && (import.meta.env.DEV || import.meta.env.MODE === 'development') && (
                      <div className="mb-4 rounded border-2 border-pink-400 bg-pink-50 p-3">
                        <h4 className="font-bold text-pink-900 mb-2">DIRECT RENDER TEST - Normalized Products:</h4>
                        {products.slice(0, 2).map((p: Product, i: number) => (
                          <div key={i} className="mb-2 p-2 bg-white rounded">
                            <div className="font-bold text-lg" style={{ color: p.name ? 'green' : 'red' }}>
                              Normalized Name: {p.name || `[NO NAME - ID: ${p._id}]`}
                            </div>
                            <div className="text-sm text-gray-600">SKU: {p.sku || 'N/A'}</div>
                            <div className="text-xs">Type: {typeof p.name} | Value: "{String(p.name || 'NULL')}" | Length: {p.name ? p.name.length : 0}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* SAFE PRODUCTS TEST: Render safe products (final check) - ALWAYS VISIBLE */}
                    {safeProducts.length > 0 && (
                      <div className="mb-4 rounded border-4 border-indigo-500 bg-indigo-100 p-4">
                        <h4 className="font-bold text-indigo-900 mb-3 text-xl">✅ SAFE PRODUCTS TEST - Final Check (Will Render):</h4>
                        {safeProducts.slice(0, 3).map((p: Product, i: number) => (
                          <div key={i} className="mb-3 p-3 bg-white rounded border-2" style={{ borderColor: p.name ? 'green' : 'red' }}>
                            <div className="font-bold text-xl mb-2" style={{ color: p.name ? 'green' : 'red' }}>
                              Safe Product {i + 1} Name: {p.name ? `"${p.name}"` : `❌ MISSING - ID: ${p._id}`}
                            </div>
                            <div className="text-sm text-gray-600 mb-1">SKU: {p.sku || 'N/A'}</div>
                            <div className="text-xs text-gray-500">
                              Name Type: {typeof p.name} | 
                              Name Value: "{String(p.name || 'NULL')}" | 
                              Name Length: {p.name ? p.name.length : 0} |
                              Has Name: {p.name ? 'YES ✅' : 'NO ❌'}
                            </div>
                            <div className="text-xs mt-1 bg-gray-50 p-1 rounded">
                              Full Product: {JSON.stringify(p).substring(0, 400)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {(() => {
                      // #region agent log
                      console.log('[NewSaleModal] About to render products:', { 
                        productsLength: products.length,
                        safeProductsLength: safeProducts.length,
                        productsArray: products,
                        safeProductsArray: safeProducts,
                        firstProduct: products[0],
                        firstSafeProduct: safeProducts[0],
                        firstProductName: products[0]?.name,
                        firstSafeProductName: safeProducts[0]?.name,
                        allNames: products.map(p => p.name || 'NO NAME'),
                        allSafeNames: safeProducts.map(p => p.name || 'NO NAME'),
                        productsType: typeof products,
                        isArray: Array.isArray(products),
                        willRenderSafeProducts: true
                      });
                      // #endregion
                      return (safeProducts as Product[]).map((product: Product, index: number) => {
                      // #region agent log
                      if (index < 3) { // Only log first 3 to avoid spam
                        console.log(`[NewSaleModal] Rendering product ${index}:`, { 
                          productId: product._id, 
                          productName: product.name, 
                          productSku: product.sku, 
                          hasName: !!product.name, 
                          nameType: typeof product.name,
                          nameValue: String(product.name),
                          nameLength: product.name ? product.name.length : 0,
                          nameTruthy: !!product.name,
                          nameFalsy: !product.name,
                          hasSellingPrice: !!product.sellingPrice, 
                          productFull: product,
                          productKeys: Object.keys(product)
                        });
                      }
                      // #endregion
                      
                      // CRITICAL: Extract display name with multiple fallbacks
                      const displayName = (() => {
                        // Try product.name first
                        if (product.name && typeof product.name === 'string' && product.name.trim() !== '') {
                          return product.name.trim();
                        }
                        // Try productName field
                        if ((product as any).productName && typeof (product as any).productName === 'string') {
                          return String((product as any).productName).trim();
                        }
                        // Try title field
                        if ((product as any).title && typeof (product as any).title === 'string') {
                          return String((product as any).title).trim();
                        }
                        // Fallback to generated name
                        return `Product ${product._id || product.sku || index}`;
                      })();
                      
                      const hasName = !!(product.name && typeof product.name === 'string' && product.name.trim() !== '');
                      
                      return (
                    <button
                      key={product._id}
                      onClick={() => addItem(product)}
                      className="flex w-full items-center justify-between rounded-lg border border-gray-200 p-4 hover:border-blue-500 hover:bg-blue-50"
                    >
                      <div className="flex items-center space-x-3">
                        {product.images?.[0]?.url ? (
                          <img
                            src={product.images[0].url}
                            alt={displayName}
                            className="h-10 w-10 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-lg bg-gray-100" />
                        )}
                        <div className="text-left">
                          {/* Display name with visual indicator if missing */}
                          {/* CRITICAL: Always render displayName - it has fallbacks */}
                          <p 
                            className="font-medium text-lg" 
                            style={{ 
                              color: hasName ? '#000000' : '#dc2626', 
                              fontWeight: 'bold',
                              fontSize: '16px',
                              minHeight: '20px',
                              lineHeight: '1.5'
                            }}
                            data-testid={`product-name-${index}`}
                            data-product-id={product._id}
                            data-has-name={hasName ? 'true' : 'false'}
                            data-display-name={displayName}
                            title={`Product Name: ${displayName} (hasName: ${hasName})`}
                          >
                            {displayName || `Product ${product._id || product.sku || index}`}
                            {!hasName && <span className="text-red-600 ml-2 font-bold">⚠️ NO NAME</span>}
                          </p>
                          <p className="text-sm text-gray-500">
                            SKU: {product.sku || 'N/A'} • Stock: {product.stockQuantity ?? 0}
                          </p>
                          {/* Debug: Show raw name value */}
                          {(import.meta.env?.DEV || import.meta.env?.MODE === 'development') && (
                            <p className="text-xs text-gray-400">
                              Debug: product.name="{String(product.name || 'NULL')}" | 
                              type={typeof product.name} | 
                              hasName={hasName ? 'YES' : 'NO'} |
                              displayName="{displayName}"
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900">
                          ${(product.sellingPrice || 0).toFixed(2)}
                        </p>
                        <p className="text-sm text-green-600">
                          Margin: {(product.profitMargin || 0).toFixed(1)}%
                        </p>
                      </div>
                    </button>
                  );
                  });
                    })()}
                  </>
                )}
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