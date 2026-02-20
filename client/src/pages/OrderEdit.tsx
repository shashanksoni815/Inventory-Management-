/**
 * Edit Order – manual order editing UI.
 * Route: /orders/:orderId/edit
 *
 * Rules:
 * - Editable only if status !== 'Delivered'
 * - Allow: address update, items update, payment status update
 * - Recalculate totals on change
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowLeft, ShoppingBag, Search, Trash2 } from 'lucide-react';
import { orderApi, productApi } from '@/services/api';
import { useRefresh } from '@/contexts/RefreshContext';
import { formatCurrency } from '@/lib/utils';
import { showToast } from '@/services/toast';
import LoadingSpinner from '@/components/Common/LoadingSpinner';
import type { Product } from '@/types';

type PaymentMethod = 'UPI' | 'Card' | 'COD';
type PaymentStatus = 'Paid' | 'Pending' | 'Failed';

interface OrderItemRow {
  productId: string;
  name: string;
  unitPrice: number;
  taxRate: number; // percentage
  quantity: number;
}

interface LoadedOrder {
  _id: string;
  orderNumber: string;
  orderStatus: string;
  customer: { name: string; phone: string; email?: string };
  deliveryAddress: {
    addressLine: string;
    city: string;
    state?: string;
    pincode: string;
  };
  items: Array<{
    product: string | { _id: string; name?: string };
    productName: string;
    quantity: number;
    unitPrice: number;
    tax: number;
  }>;
  payment: {
    method: PaymentMethod;
    status: PaymentStatus;
    transactionId?: string;
  };
  totals: {
    itemTotal: number;
    taxTotal: number;
    deliveryFee: number;
    discount: number;
    grandTotal: number;
  };
  franchise?: { _id?: string } | string;
}

const OrderEdit: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { refreshKey } = useRefresh();

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

  const { data, isPending, isError, error } = useQuery({
    queryKey: ['order', refreshKey, orderId],
    queryFn: async () => {
      if (!orderId) throw new Error('Missing order ID');
      const result = await orderApi.getById(orderId);
      // Extract .data (avoid casting AxiosResponse directly to LoadedOrder)
      const data = (result as unknown as { data?: LoadedOrder })?.data ?? result;
      return data as unknown as LoadedOrder;
    },
    enabled: !!orderId,
  });

  const order = data as LoadedOrder | undefined;
  const isDelivered = order?.orderStatus === 'Delivered';
  const isEditable = !isDelivered;

  useEffect(() => {
    if (!order) return;

    setCustomer({
      name: order.customer?.name ?? '',
      phone: order.customer?.phone ?? '',
      email: order.customer?.email ?? '',
    });

    setDeliveryAddress({
      addressLine: order.deliveryAddress?.addressLine ?? '',
      city: order.deliveryAddress?.city ?? '',
      state: order.deliveryAddress?.state ?? '',
      pincode: order.deliveryAddress?.pincode ?? '',
    });

    setCharges({
      deliveryFee: Number(order.totals?.deliveryFee ?? 0),
      discount: Number(order.totals?.discount ?? 0),
    });

    setPayment({
      method: order.payment?.method ?? 'UPI',
      status: order.payment?.status ?? 'Pending',
      transactionId: order.payment?.transactionId ?? '',
    });

    const mappedItems: OrderItemRow[] = (order.items ?? []).map((item) => {
      const qty = Number(item.quantity) || 0;
      const price = Number(item.unitPrice) || 0;
      const taxAmount = Number(item.tax) || 0;
      const base = price * qty || 0;
      const rate = base > 0 ? (taxAmount / base) * 100 : 0;
      const productId =
        typeof item.product === 'string'
          ? item.product
          : item.product?._id ?? '';
      return {
        productId,
        name: item.productName,
        unitPrice: price,
        taxRate: Number(rate.toFixed(2)),
        quantity: qty || 1,
      };
    });
    setItems(mappedItems);
  }, [order]);

  const orderFranchiseId = useMemo(() => {
    if (!order) return '';
    if (typeof order.franchise === 'string') return order.franchise;
    return order.franchise?._id ?? '';
  }, [order]);

  const { data: productResult, isPending: productsLoading } = useQuery({
    queryKey: ['products-for-order-edit', refreshKey, orderFranchiseId, productSearch],
    queryFn: async () => {
      const res = await productApi.getAll({
        search: productSearch || undefined,
        franchise: orderFranchiseId || undefined,
        status: 'active',
        limit: 10,
      });
      return res;
    },
    enabled: Boolean(orderFranchiseId),
  });

  const products = useMemo(
    () =>
      (productResult && Array.isArray((productResult as any).products)
        ? (productResult as any).products
        : []) as Product[],
    [productResult]
  );

  const addItem = (product: Product) => {
    if (!isEditable) return;
    setItems((prev) => {
      const existing = prev.find(
        (row) => row.productId === (product as any)._id
      );
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
    if (!isEditable) return;
    setItems((prev) =>
      prev.map((row) =>
        row.productId === productId ? { ...row, ...updates } : row
      )
    );
  };

  const removeItem = (productId: string) => {
    if (!isEditable) return;
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

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!orderId) {
        throw new Error('Missing order ID.');
      }
      if (!order) {
        throw new Error('Order not loaded yet.');
      }
      if (isDelivered) {
        throw new Error('Delivered orders cannot be edited.');
      }
      if (!customer.name.trim() || !customer.phone.trim()) {
        throw new Error('Customer name and phone are required.');
      }
      if (
        !deliveryAddress.addressLine.trim() ||
        !deliveryAddress.city.trim() ||
        !deliveryAddress.pincode.trim()
      ) {
        throw new Error(
          'Delivery address, city and pincode are required.'
        );
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
        totals: {
          itemTotal: totals.itemTotal,
          taxTotal: totals.taxTotal,
          deliveryFee,
          discount,
          grandTotal: totals.grandTotal,
        },
      };

      const updated = await orderApi.update(orderId, payload);
      return updated as any;
    },
    onSuccess: (updated: any) => {
      showToast.success('Order updated successfully.');
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      if (orderId) {
        queryClient.invalidateQueries({ queryKey: ['order', orderId] });
        navigate(`/orders/${orderId}`);
      } else if (updated && updated._id) {
        navigate(`/orders/${updated._id}`);
      } else {
        navigate('/orders');
      }
    },
    onError: (err: unknown) => {
      let message =
        'Failed to update order. Please check the form and try again.';
      if (err && typeof err === 'object') {
        if ('message' in err && typeof (err as any).message === 'string') {
          message = (err as any).message;
        } else if ('error' in err && typeof (err as any).error === 'string') {
          message = (err as any).error;
        }
      }
      showToast.error(message);
      // eslint-disable-next-line no-console
      console.error('Update order error:', err);
    },
  });

  if (isPending) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-6 bg-gray-50">
        <LoadingSpinner />
      </div>
    );
  }

  if (isError || !order) {
    const msg =
      error && typeof error === 'object' && 'message' in error
        ? String((error as { message: string }).message)
        : 'Order not found or failed to load.';
    return (
      <div className="min-h-0 bg-white p-3 sm:p-4 lg:p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {msg}
        </div>
        <Link
          to="/orders"
          className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Orders
        </Link>
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
              Edit Order {order.orderNumber}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {isDelivered
                ? 'Delivered orders are read-only. You can view details but cannot edit.'
                : 'Update address, items, and payment details for this order.'}
            </p>
          </div>
        </div>
      </motion.div>

      {isDelivered && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          This order is marked as <strong>Delivered</strong> and cannot be
          edited. For changes, create adjustments via sales or support flows.
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-600 uppercase">
                  Name<span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  disabled={!isEditable}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  value={customer.name}
                  onChange={(e) =>
                    setCustomer((prev) => ({ ...prev, name: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-600 uppercase">
                  Phone<span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  disabled={!isEditable}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  value={customer.phone}
                  onChange={(e) =>
                    setCustomer((prev) => ({ ...prev, phone: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="block text-xs font-medium text-gray-600 uppercase">
                  Email
                </label>
                <input
                  type="email"
                  disabled={!isEditable}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  value={customer.email}
                  onChange={(e) =>
                    setCustomer((prev) => ({ ...prev, email: e.target.value }))
                  }
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
                  disabled={!isEditable}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  value={deliveryAddress.addressLine}
                  onChange={(e) =>
                    setDeliveryAddress((prev) => ({
                      ...prev,
                      addressLine: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                <div className="space-y-1 sm:col-span-1">
                  <label className="block text-xs font-medium text-gray-600 uppercase">
                    City<span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    disabled={!isEditable}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
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
                    disabled={!isEditable}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
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
                    disabled={!isEditable}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
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
                  disabled={!isEditable}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white disabled:bg-gray-50 disabled:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
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
                  disabled={!isEditable}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white disabled:bg-gray-50 disabled:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
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
                  disabled={!isEditable}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
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
                  type="search"
                  disabled={!isEditable}
                  className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm disabled:bg-gray-50 disabled:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="Search products by name or SKU..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="mb-3 max-h-40 overflow-y-auto border border-dashed border-gray-200 rounded-lg p-2">
              {productsLoading ? (
                <div className="flex justify-center py-4">
                  <LoadingSpinner />
                </div>
              ) : products.length === 0 ? (
                <p className="py-4 text-center text-xs text-gray-500">
                  No products found. Adjust your search.
                </p>
              ) : (
                products.map((product) => (
                  <button
                    key={(product as any)._id}
                    type="button"
                    disabled={!isEditable}
                    onClick={() => addItem(product)}
                    className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs hover:bg-blue-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                  >
                    <span className="truncate text-gray-800">
                      {product.name}
                    </span>
                    <span className="ml-2 text-gray-500">
                      {formatCurrency((product as any).sellingPrice ?? 0)}
                    </span>
                  </button>
                ))
              )}
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
                  {items.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-2 py-4 text-center text-xs text-gray-500"
                      >
                        Add items from the product list above.
                      </td>
                    </tr>
                  ) : (
                    items.map((row) => {
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
                              disabled={!isEditable}
                              className="w-16 rounded border border-gray-300 px-1 py-1 text-right disabled:bg-gray-50 disabled:text-gray-500"
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
                              disabled={!isEditable}
                              className="w-20 rounded border border-gray-300 px-1 py-1 text-right disabled:bg-gray-50 disabled:text-gray-500"
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
                              disabled={!isEditable}
                              className="w-16 rounded border border-gray-300 px-1 py-1 text-right disabled:bg-gray-50 disabled:text-gray-500"
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
                              disabled={!isEditable}
                              onClick={() => removeItem(row.productId)}
                              className="inline-flex items-center rounded-full border border-gray-300 p-1 text-gray-400 hover:border-red-500 hover:text-red-600 disabled:cursor-not-allowed disabled:hover:border-gray-300 disabled:hover:text-gray-400"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Totals */}
          <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-900">Totals</h2>
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
                    disabled={!isEditable}
                    className="w-24 rounded border border-gray-300 px-2 py-1 text-right text-sm disabled:bg-gray-50 disabled:text-gray-500"
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
                    disabled={!isEditable}
                    className="w-24 rounded border border-gray-300 px-2 py-1 text-right text-sm disabled:bg-gray-50 disabled:text-gray-500"
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

            {isEditable && (
              <button
                type="button"
                onClick={() => updateMutation.mutate()}
                disabled={updateMutation.isPending}
                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {updateMutation.isPending && (
                  <LoadingSpinner />
                )}
                <span>Save Changes</span>
              </button>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default OrderEdit;

