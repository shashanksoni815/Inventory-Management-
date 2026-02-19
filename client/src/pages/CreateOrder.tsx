/**
 * CreateOrder – manual order creation UI for admin/franchise managers.
 * Route: /orders/new
 */
import React, { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  ShoppingBag,
  Search,
  Plus,
  Trash2,
} from 'lucide-react';
import { productApi, orderApi, franchiseApi } from '@/services/api';
import { useFranchise } from '@/contexts/FranchiseContext';
import { formatCurrency } from '@/lib/utils';
import { showToast } from '@/services/toast';
import LoadingSpinner from '@/components/Common/LoadingSpinner';
import type { Product } from '@/types';
import type { UserRole } from '@/types/user';

type PaymentMethod = 'UPI' | 'Card' | 'COD';
type PaymentStatus = 'Paid' | 'Pending' | 'Failed';

interface OrderItemRow {
  productId: string;
  name: string;
  unitPrice: number;
  taxRate: number; // percentage
  quantity: number;
}

const CreateOrder: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentFranchise } = useFranchise();

  // Selected franchise for this order (defaults from context if available)
  const [selectedFranchise, setSelectedFranchise] = useState<string | null>(
    ((currentFranchise as any)?._id || (currentFranchise as any)?.id || '') ?? null
  );

  const userRole: UserRole | null = useMemo(() => {
    try {
      const raw = localStorage.getItem('user');
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { role?: UserRole };
      return parsed.role ?? null;
    } catch {
      return null;
    }
  }, []);

  const [customer, setCustomer] = useState({
    name: '',
    phone: '',
    email: '',
  });

  const [deliveryAddress, setDeliveryAddress] = useState({
    addressLine: '',
    city: '',
    state: '',
    pincode: '',
  });

  const [items, setItems] = useState<OrderItemRow[]>([]);
  const [productSearch, setProductSearch] = useState('');

  const [payment, setPayment] = useState<{
    method: PaymentMethod;
    status: PaymentStatus;
    transactionId: string;
  }>({
    method: 'UPI',
    status: 'Pending',
    transactionId: '',
  });

  const [charges, setCharges] = useState({
    deliveryFee: 0,
    discount: 0,
  });

  const isFranchiseLocked = items.length > 0;

  // Reset order items and product search when franchise changes to avoid cross-franchise pollution
  useEffect(() => {
    setItems([]);
    setProductSearch('');
  }, [selectedFranchise]);

  const { data: franchisesData } = useQuery({
    queryKey: ['franchises'],
    queryFn: () => franchiseApi.getAll(),
  });

  const franchises = useMemo(() => {
    const data = franchisesData as any;
    if (!data) return [] as any[];
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.franchises)) return data.franchises;
    return [] as any[];
  }, [franchisesData]);

  const { data: productsData, isPending: productsLoading } = useQuery({
    queryKey: ['order-products', selectedFranchise, productSearch],
    queryFn: async () => {
      const res = await productApi.getAll({
        franchise: selectedFranchise || undefined,
        limit: 100,
        status: 'active',
        search: productSearch || undefined,
      });
      return res;
    },
    enabled: Boolean(selectedFranchise),
  });

  const products = useMemo(() => {
    const data = productsData as any;
    const list =
      Array.isArray(data)
        ? data
        : data?.products ||
          data?.data ||
          [];
    console.log('Fetched products for order:', list);
    return list as Product[];
  }, [productsData]);

  const filteredProducts = useMemo(() => {
    const term = productSearch.trim().toLowerCase();
    if (!term) return products;
    return products.filter((p: any) =>
      `${p.name} ${p.sku}`.toLowerCase().includes(term)
    );
  }, [products, productSearch]);

  const addItem = (product: Product) => {
    setItems((prev) => {
      const existing = prev.find((row) => row.productId === (product as any)._id);
      if (existing) {
        return prev.map((row) =>
          row.productId === (product as any)._id
            ? { ...row, quantity: row.quantity + 1 }
            : row
        );
      }
      return [
        ...prev,
        {
          productId: (product as any)._id,
          name: product.name,
          unitPrice: Number((product as any).sellingPrice ?? 0),
          taxRate: 0,
          quantity: 1,
        },
      ];
    });
  };

  const updateItem = (productId: string, updates: Partial<OrderItemRow>) => {
    setItems((prev) =>
      prev.map((row) =>
        row.productId === productId ? { ...row, ...updates } : row
      )
    );
  };

  const removeItem = (productId: string) => {
    setItems((prev) => prev.filter((row) => row.productId !== productId));
  };

  const totals = useMemo(() => {
    let itemTotal = 0;
    let taxTotal = 0;

    items.forEach((row) => {
      const qty = Number(row.quantity) || 0;
      const price = Number(row.unitPrice) || 0;
      const rate = Number(row.taxRate) || 0;
      const base = price * qty;
      const tax = base * (rate / 100);
      itemTotal += base;
      taxTotal += tax;
    });

    const delivery = Number(charges.deliveryFee) || 0;
    const discount = Number(charges.discount) || 0;
    const grandTotal = itemTotal + taxTotal + delivery - discount;

    return {
      itemTotal,
      taxTotal,
      grandTotal,
    };
  }, [items, charges.deliveryFee, charges.discount]);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFranchise) {
        throw new Error('Select a franchise before creating an order.');
      }
      if (!customer.name.trim() || !customer.phone.trim()) {
        throw new Error('Customer name and phone are required.');
      }
      if (!deliveryAddress.addressLine.trim() || !deliveryAddress.city.trim() || !deliveryAddress.pincode.trim()) {
        throw new Error('Delivery address, city and pincode are required.');
      }
      if (items.length === 0) {
        throw new Error('Add at least one product to the order.');
      }

      const deliveryFee = Number(charges.deliveryFee) || 0;
      const discount = Number(charges.discount) || 0;

      const itemsPayload = items.map((row) => {
        const qty = Number(row.quantity) || 0;
        const price = Number(row.unitPrice) || 0;
        const rate = Number(row.taxRate) || 0;
        const base = price * qty;
        const taxAmount = base * (rate / 100);
        const subtotal = base + taxAmount;
        return {
          product: row.productId,
          productName: row.name,
          quantity: qty,
          unitPrice: price,
          tax: taxAmount,
          subtotal,
        };
      });

      const payload = {
        franchise: selectedFranchise,
        customer: {
          name: customer.name.trim(),
          phone: customer.phone.trim(),
          email: customer.email.trim() || undefined,
        },
        deliveryAddress: {
          addressLine: deliveryAddress.addressLine.trim(),
          city: deliveryAddress.city.trim(),
          state: deliveryAddress.state.trim(),
          pincode: deliveryAddress.pincode.trim(),
        },
        items: itemsPayload,
        payment: {
          method: payment.method,
          status: payment.status,
          transactionId: payment.transactionId.trim() || undefined,
        },
        orderStatus: 'Pending',
        totals: {
          itemTotal: totals.itemTotal,
          taxTotal: totals.taxTotal,
          deliveryFee,
          discount,
          grandTotal: totals.grandTotal,
        },
      };

      const created = await orderApi.create(payload);
      return created as any;
    },
    onSuccess: (created: any) => {
      showToast.success('Order created successfully.');
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      if (created && created._id) {
        navigate(`/orders/${created._id}`);
      } else {
        navigate('/orders');
      }
    },
    onError: (err: unknown) => {
      let message = 'Failed to create order. Please check the form and try again.';
      if (err && typeof err === 'object') {
        if ('message' in err && typeof (err as any).message === 'string') {
          message = (err as any).message;
        } else if ('error' in err && typeof (err as any).error === 'string') {
          message = (err as any).error;
        }
      }
      showToast.error(message);
      // eslint-disable-next-line no-console
      console.error('Create order error:', err);
    },
  });

  if (userRole === 'staff') {
    return (
      <div className="min-h-0 bg-white p-3 sm:p-4 lg:p-6">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 sm:mb-6"
        >
          <Link
            to="/orders"
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Orders
          </Link>
          <div className="mt-3">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              Create Order
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              You have view-only access and cannot create orders.
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-0 bg-white p-3 sm:p-4 lg:p-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4 sm:mb-6"
      >
        <Link
          to="/orders"
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Orders
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
            <ShoppingBag className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              Create Order
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Manually create an order for the selected franchise.
            </p>
          </div>
        </div>

        {/* Franchise selector */}
        <div className="mt-4 w-full max-w-xs space-y-1">
          <select
            value={selectedFranchise ?? ''}
            onChange={(e) => setSelectedFranchise(e.target.value)}
            disabled={isFranchiseLocked}
            className="w-full rounded-lg border px-3 py-2 text-sm text-gray-900 disabled:bg-gray-100 disabled:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
          >
            <option value="" disabled>
              Select Franchise
            </option>
            {franchises.map((f: any) => (
              <option key={f._id} value={f._id}>
                {f.name}
              </option>
            ))}
          </select>
          {isFranchiseLocked && (
            <p className="text-xs text-gray-500">
              Franchise cannot be changed after adding items.
            </p>
          )}
        </div>
      </motion.div>

      {!selectedFranchise && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 mb-4 text-sm text-amber-800">
          Select a franchise from the sidebar before creating an order.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column: Customer & address, payment */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Details */}
          <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">
              Customer Details
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-600 uppercase">
                  Name<span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  value={customer.name}
                  onChange={(e) =>
                    setCustomer((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="Customer name"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-600 uppercase">
                  Phone<span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  value={customer.phone}
                  onChange={(e) =>
                    setCustomer((prev) => ({ ...prev, phone: e.target.value }))
                  }
                  placeholder="Customer phone"
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="block text-xs font-medium text-gray-600 uppercase">
                  Email
                </label>
                <input
                  type="email"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  value={customer.email}
                  onChange={(e) =>
                    setCustomer((prev) => ({ ...prev, email: e.target.value }))
                  }
                  placeholder="Optional"
                />
              </div>
            </div>
          </section>

          {/* Delivery Address */}
          <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">
              Delivery Address
            </h2>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-600 uppercase">
                  Address line<span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  value={deliveryAddress.addressLine}
                  onChange={(e) =>
                    setDeliveryAddress((prev) => ({
                      ...prev,
                      addressLine: e.target.value,
                    }))
                  }
                  placeholder="Street, area, landmark"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1 sm:col-span-1">
                  <label className="block text-xs font-medium text-gray-600 uppercase">
                    City<span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    value={deliveryAddress.city}
                    onChange={(e) =>
                      setDeliveryAddress((prev) => ({
                        ...prev,
                        city: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-1 sm:col-span-1">
                  <label className="block text-xs font-medium text-gray-600 uppercase">
                    State
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    value={deliveryAddress.state}
                    onChange={(e) =>
                      setDeliveryAddress((prev) => ({
                        ...prev,
                        state: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-1 sm:col-span-1">
                  <label className="block text-xs font-medium text-gray-600 uppercase">
                    Pincode<span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    value={deliveryAddress.pincode}
                    onChange={(e) =>
                      setDeliveryAddress((prev) => ({
                        ...prev,
                        pincode: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Payment Details */}
          <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">
              Payment Details
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-600 uppercase">
                  Payment method
                </label>
                <select
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  value={payment.method}
                  onChange={(e) =>
                    setPayment((prev) => ({
                      ...prev,
                      method: e.target.value as PaymentMethod,
                    }))
                  }
                >
                  <option value="UPI">UPI</option>
                  <option value="Card">Card</option>
                  <option value="COD">COD</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-600 uppercase">
                  Payment status
                </label>
                <select
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  value={payment.status}
                  onChange={(e) =>
                    setPayment((prev) => ({
                      ...prev,
                      status: e.target.value as PaymentStatus,
                    }))
                  }
                >
                  <option value="Pending">Pending</option>
                  <option value="Paid">Paid</option>
                  <option value="Failed">Failed</option>
                </select>
              </div>
              <div className="space-y-1 sm:col-span-1">
                <label className="block text-xs font-medium text-gray-600 uppercase">
                  Transaction ID
                </label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  value={payment.transactionId}
                  onChange={(e) =>
                    setPayment((prev) => ({
                      ...prev,
                      transactionId: e.target.value,
                    }))
                  }
                  placeholder="Optional"
                />
              </div>
            </div>
          </section>
        </div>

        {/* Right column: Items & totals */}
        <div className="space-y-6">
          {/* Order Items */}
          <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-900">
                Order Items
              </h2>
            </div>

            <div className="mb-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder={
                    selectedFranchise
                      ? 'Search products by name or SKU...'
                      : 'Select a franchise first'
                  }
                  disabled={!selectedFranchise}
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm disabled:bg-gray-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            <div className="mb-3 max-h-40 overflow-y-auto border border-dashed border-gray-200 rounded-lg p-2">
              {!selectedFranchise && (
                <div className="py-4 text-center text-sm text-gray-500">
                  Please select a franchise to load products.
                </div>
              )}

              {selectedFranchise && productsLoading && (
                <div className="flex justify-center py-4">
                  <LoadingSpinner />
                </div>
              )}

              {selectedFranchise &&
                !productsLoading &&
                products.length === 0 && (
                  <div className="py-4 text-center text-sm text-gray-500">
                    No products available for this franchise.
                  </div>
                )}

              {selectedFranchise &&
                !productsLoading &&
                products.length > 0 &&
                filteredProducts.length === 0 && (
                  <div className="py-4 text-center text-sm text-gray-500">
                    No products match your search.
                  </div>
                )}

              {selectedFranchise &&
                !productsLoading &&
                filteredProducts.map((product: any) => (
                  <button
                    key={product._id}
                    type="button"
                    onClick={() => addItem(product)}
                    className="flex w-full items-center justify-between rounded-md px-3 py-2 hover:bg-gray-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">
                        {product.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        SKU: {product.sku}
                      </p>
                    </div>
                    <span className="ml-2 text-sm font-semibold text-gray-900">
                      {formatCurrency((product as any).sellingPrice ?? 0)}
                    </span>
                  </button>
                ))}
            </div>

            <div className="overflow-x-auto -mx-px">
              <table className="w-full min-w-[320px] text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2 py-2 text-left font-semibold text-gray-600">
                      Product
                    </th>
                    <th className="px-2 py-2 text-right font-semibold text-gray-600">
                      Qty
                    </th>
                    <th className="px-2 py-2 text-right font-semibold text-gray-600">
                      Price
                    </th>
                    <th className="px-2 py-2 text-right font-semibold text-gray-600">
                      Tax %
                    </th>
                    <th className="px-2 py-2 text-right font-semibold text-gray-600">
                      Subtotal
                    </th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {items.map((row) => {
                      const qty = Number(row.quantity) || 0;
                      const price = Number(row.unitPrice) || 0;
                      const rate = Number(row.taxRate) || 0;
                      const base = price * qty;
                      const tax = base * (rate / 100);
                      const subtotal = base + tax;
                      return (
                        <tr key={row.productId}>
                          <td className="px-2 py-2 text-gray-800">
                            <div className="truncate max-w-[140px]">
                              {row.name}
                            </div>
                          </td>
                          <td className="px-2 py-2 text-right">
                            <input
                              type="number"
                              min={1}
                              className="w-16 rounded border border-gray-300 px-1 py-1 text-right"
                              value={row.quantity}
                              onChange={(e) =>
                                updateItem(row.productId, {
                                  quantity: Number(e.target.value) || 1,
                                })
                              }
                            />
                          </td>
                          <td className="px-2 py-2 text-right">
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              className="w-20 rounded border border-gray-300 px-1 py-1 text-right"
                              value={row.unitPrice}
                              onChange={(e) =>
                                updateItem(row.productId, {
                                  unitPrice: Number(e.target.value) || 0,
                                })
                              }
                            />
                          </td>
                          <td className="px-2 py-2 text-right">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step="0.5"
                              className="w-16 rounded border border-gray-300 px-1 py-1 text-right"
                              value={row.taxRate}
                              onChange={(e) =>
                                updateItem(row.productId, {
                                  taxRate: Number(e.target.value) || 0,
                                })
                              }
                            />
                          </td>
                          <td className="px-2 py-2 text-right text-gray-800">
                            {formatCurrency(subtotal)}
                          </td>
                          <td className="px-2 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => removeItem(row.productId)}
                              className="inline-flex items-center rounded-full border border-gray-300 p-1 text-gray-400 hover:border-red-500 hover:text-red-600"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Totals */}
          <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-900">
              Totals
            </h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Item total</span>
                <span className="font-medium">
                  {formatCurrency(totals.itemTotal)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Tax</span>
                <span className="font-medium">
                  {formatCurrency(totals.taxTotal)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Delivery charge</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className="w-24 rounded border border-gray-300 px-2 py-1 text-right text-sm"
                    value={charges.deliveryFee}
                    onChange={(e) =>
                      setCharges((prev) => ({
                        ...prev,
                        deliveryFee: Number(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Discount</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className="w-24 rounded border border-gray-300 px-2 py-1 text-right text-sm"
                    value={charges.discount}
                    onChange={(e) =>
                      setCharges((prev) => ({
                        ...prev,
                        discount: Number(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
              </div>
              <div className="border-t border-gray-200 pt-2 mt-1 flex justify-between items-center">
                <span className="text-sm font-semibold text-gray-900">
                  Grand total
                </span>
                <span className="text-lg font-bold text-gray-900">
                  {formatCurrency(totals.grandTotal)}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !selectedFranchise}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {createMutation.isPending ? (
                <LoadingSpinner />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              <span>Create Order</span>
            </button>
          </section>
        </div>
      </div>
    </div>
  );
};

export default CreateOrder;

