/**
 * Order Details – single order view.
 * Route: /orders/:orderId
 * Shows: order summary, customer & delivery, payment, product list, totals, status timeline.
 */
import React, { useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  User,
  MapPin,
  CreditCard,
  Package,
  Receipt,
  Check,
  Circle,
  Loader2,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { orderApi } from '@/services/api';
import { formatCurrency, formatDate, orderStatusBadgeClass } from '@/lib/utils';
import LoadingSpinner from '@/components/Common/LoadingSpinner';
import { cn } from '@/lib/utils';
import { showToast } from '@/services/toast';

const STATUS_FLOW = ['Pending', 'Confirmed', 'Packed', 'Shipped', 'Delivered', 'Cancelled'];

/** Valid next statuses from current (prevents invalid transitions). */
const VALID_NEXT: Record<string, string[]> = {
  Pending: ['Confirmed', 'Cancelled'],
  Confirmed: ['Packed', 'Cancelled'],
  Packed: ['Shipped', 'Cancelled'],
  Shipped: ['Delivered', 'Cancelled'],
  Delivered: [],
  Cancelled: [],
};
function getValidNextStatuses(current: string): string[] {
  return VALID_NEXT[current] ?? [];
}

interface OrderItem {
  product: string | { _id?: string; name?: string; sku?: string };
  productName: string;
  quantity: number;
  unitPrice: number;
  tax: number;
  subtotal: number;
}

interface Order {
  _id: string;
  orderNumber: string;
  createdAt: string;
  updatedAt?: string;
  franchise?: { _id: string; name?: string; code?: string };
  customer: { name: string; phone?: string; email?: string };
  deliveryAddress: {
    addressLine: string;
    city: string;
    state?: string;
    pincode: string;
  };
  items: OrderItem[];
  payment: { method: string; status: string; transactionId?: string; gateway?: string };
  orderStatus: string;
  totals: {
    itemTotal: number;
    taxTotal: number;
    deliveryFee: number;
    discount: number;
    grandTotal: number;
  };
}

const OrderDetails: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const queryClient = useQueryClient();
  const [statusConfirmTarget, setStatusConfirmTarget] = useState<string | null>(null);

  const userRole = React.useMemo(() => {
    try {
      const raw = localStorage.getItem('user');
      const u = raw ? JSON.parse(raw) as { role?: string } : null;
      return u?.role ?? null;
    } catch {
      return null;
    }
  }, []);

  const { data: order, isLoading, isError, error } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => orderApi.getById(orderId!),
    enabled: !!orderId,
    retry: 1,
  });

  const updateStatusMutation = useMutation({
    mutationFn: (newStatus: string) => orderApi.updateStatus(orderId!, newStatus),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      showToast.success('Order status updated.');
      setStatusConfirmTarget(null);
    },
    onError: (err: { message?: string }) => {
      showToast.error(err?.message ?? 'Failed to update status.');
    },
  });

  const o = order as Order | undefined;
  const currentIndex = o ? STATUS_FLOW.indexOf(o.orderStatus) : -1;
  const isCancelled = o?.orderStatus === 'Cancelled';
  const isStepReached = (idx: number) =>
    !isCancelled && idx <= currentIndex;
  const isStepCurrent = (status: string) => status === o?.orderStatus;
  const validNext = o ? getValidNextStatuses(o.orderStatus) : [];
  const canChangeStatus = validNext.length > 0 && userRole !== 'staff';

  const handleConfirmStatusChange = useCallback(() => {
    if (!statusConfirmTarget) return;
    updateStatusMutation.mutate(statusConfirmTarget);
  }, [statusConfirmTarget, updateStatusMutation]);
  const handleCancelStatusChange = useCallback(() => {
    if (!updateStatusMutation.isPending) setStatusConfirmTarget(null);
  }, [updateStatusMutation.isPending]);

  if (!orderId) {
    return (
      <div className="min-h-0 bg-white p-3 sm:p-4 lg:p-6">
        <p className="text-sm text-gray-500">Missing order ID.</p>
        <Link to="/orders" className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:underline">
          <ArrowLeft className="h-4 w-4" />
          Back to Orders
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-6 bg-gray-50" aria-live="polite" aria-busy="true">
        <LoadingSpinner />
      </div>
    );
  }

  if (isError || !o) {
    const errMsg = error && typeof error === 'object' && 'message' in error
      ? String((error as { message: string }).message)
      : 'Order not found.';
    return (
      <div className="min-h-0 bg-white p-3 sm:p-4 lg:p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
          {errMsg}
        </div>
        <Link
          to="/orders"
          className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:underline"
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
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <Link
          to="/orders"
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Orders
        </Link>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              Order {o.orderNumber}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Placed on {formatDate(o.createdAt, 'long')}
              {o.franchise && (
                <span className="ml-2">
                  · {o.franchise.name ?? o.franchise.code ?? 'Franchise'}
                </span>
              )}
            </p>
          </div>
          <span
            className={cn(
              'inline-flex rounded-full px-3 py-1 text-sm font-medium',
              orderStatusBadgeClass(o.orderStatus)
            )}
          >
            {o.orderStatus}
          </span>
        </div>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column: summary, customer, payment, products, totals */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer & Delivery */}
          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="rounded-xl border border-gray-200 bg-white p-5"
          >
            <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-4">
              <User className="h-4 w-4" />
              Customer & delivery
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</p>
                <p className="mt-1 font-medium text-gray-900">{o.customer?.name ?? '—'}</p>
                {o.customer?.phone && (
                  <p className="text-sm text-gray-600">{o.customer.phone}</p>
                )}
                {o.customer?.email && (
                  <p className="text-sm text-gray-600">{o.customer.email}</p>
                )}
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  Delivery address
                </p>
                <div className="mt-1 text-sm text-gray-700">
                  {o.deliveryAddress?.addressLine && <p>{o.deliveryAddress.addressLine}</p>}
                  <p>
                    {[o.deliveryAddress?.city, o.deliveryAddress?.state].filter(Boolean).join(', ')}
                    {o.deliveryAddress?.pincode && ` ${o.deliveryAddress.pincode}`}
                  </p>
                </div>
              </div>
            </div>
          </motion.section>

          {/* Payment */}
          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="rounded-xl border border-gray-200 bg-white p-5"
          >
            <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-4">
              <CreditCard className="h-4 w-4" />
              Payment
            </h2>
            <div className="flex flex-wrap gap-4 text-sm">
              <div>
                <span className="text-gray-500">Method:</span>{' '}
                <span className="font-medium">{o.payment?.method ?? '—'}</span>
              </div>
              <div>
                <span className="text-gray-500">Status:</span>{' '}
                <span
                  className={cn(
                    'font-medium',
                    o.payment?.status === 'Paid' && 'text-green-600',
                    o.payment?.status === 'Pending' && 'text-amber-600',
                    o.payment?.status === 'Failed' && 'text-red-600'
                  )}
                >
                  {o.payment?.status ?? '—'}
                </span>
              </div>
              {o.payment?.transactionId && (
                <div>
                  <span className="text-gray-500">Transaction ID:</span>{' '}
                  <span className="font-mono text-xs">{o.payment.transactionId}</span>
                </div>
              )}
              {o.payment?.gateway && (
                <div>
                  <span className="text-gray-500">Gateway:</span>{' '}
                  <span>{o.payment.gateway}</span>
                </div>
              )}
            </div>
          </motion.section>

          {/* Product list */}
          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="rounded-xl border border-gray-200 bg-white overflow-hidden"
          >
            <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 p-5 pb-0">
              <Package className="h-4 w-4" />
              Products
            </h2>
            <div className="overflow-x-auto -mx-px" aria-label="Order products">
              <table className="w-full min-w-[320px] divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Product</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Qty</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Unit price</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {(o.items ?? []).map((item: OrderItem, idx: number) => (
                    <tr key={idx}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {item.productName ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 text-right">{item.quantity}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 text-right">
                        {formatCurrency(item.unitPrice ?? 0)}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                        {formatCurrency(item.subtotal ?? 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.section>

          {/* Totals breakdown */}
          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="rounded-xl border border-gray-200 bg-white p-5"
          >
            <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-4">
              <Receipt className="h-4 w-4" />
              Totals
            </h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-600">Item total</dt>
                <dd className="font-medium">{formatCurrency(o.totals?.itemTotal ?? 0)}</dd>
              </div>
              {(o.totals?.taxTotal ?? 0) > 0 && (
                <div className="flex justify-between">
                  <dt className="text-gray-600">Tax</dt>
                  <dd className="font-medium">{formatCurrency(o.totals.taxTotal)}</dd>
                </div>
              )}
              {(o.totals?.deliveryFee ?? 0) > 0 && (
                <div className="flex justify-between">
                  <dt className="text-gray-600">Delivery fee</dt>
                  <dd className="font-medium">{formatCurrency(o.totals.deliveryFee)}</dd>
                </div>
              )}
              {(o.totals?.discount ?? 0) > 0 && (
                <div className="flex justify-between text-green-600">
                  <dt>Discount</dt>
                  <dd className="font-medium">-{formatCurrency(o.totals.discount)}</dd>
                </div>
              )}
              <div className="flex justify-between border-t border-gray-200 pt-3 mt-3 text-base font-semibold">
                <dt className="text-gray-900">Grand total</dt>
                <dd className="text-gray-900">{formatCurrency(o.totals?.grandTotal ?? 0)}</dd>
              </div>
            </dl>
          </motion.section>
        </div>

        {/* Right column: status timeline */}
        <div className="lg:col-span-1">
          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="rounded-xl border border-gray-200 bg-white p-5 sticky top-4"
          >
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Order status</h2>
            <ul className="space-y-0">
              {STATUS_FLOW.map((status, idx) => {
                const reached = isStepReached(idx);
                const current = isStepCurrent(status);
                return (
                  <li key={status} className="relative flex gap-3 pb-6 last:pb-0">
                    {idx < STATUS_FLOW.length - 1 && (
                      <span
                        className={cn(
                          'absolute left-[7px] top-5 bottom-0 w-0.5',
                          reached ? 'bg-green-500' : 'bg-gray-200'
                        )}
                      />
                    )}
                    <span
                      className={cn(
                        'relative z-10 flex h-4 w-4 shrink-0 items-center justify-center rounded-full',
                        status === 'Cancelled' && current && 'bg-red-500 text-white',
                        reached && status !== 'Cancelled' && 'bg-green-500 text-white',
                        !reached && !(status === 'Cancelled' && current) && 'bg-gray-200 text-gray-400'
                      )}
                    >
                      {reached && status !== 'Cancelled' && <Check className="h-2.5 w-2.5" />}
                      {status === 'Cancelled' && current && <Circle className="h-2 w-2 fill-current" />}
                    </span>
                    <div className="pt-0.5">
                      <p
                        className={cn(
                          'text-sm font-medium',
                          current ? 'text-gray-900' : reached ? 'text-gray-700' : 'text-gray-400'
                        )}
                      >
                        {status}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* Update status: only show valid next statuses */}
            {canChangeStatus && (
              <div className="mt-5 pt-4 border-t border-gray-200">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Update status</p>
                <div className="flex flex-wrap gap-2">
                  {validNext.map((nextStatus) => (
                    <button
                      key={nextStatus}
                      type="button"
                      onClick={() => setStatusConfirmTarget(nextStatus)}
                      disabled={updateStatusMutation.isPending}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                        nextStatus === 'Cancelled'
                          ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
                          : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                      )}
                    >
                      {nextStatus}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </motion.section>
        </div>
      </div>

      {/* Confirmation dialog */}
      <AnimatePresence>
        {statusConfirmTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
            onClick={handleCancelStatusChange}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-xl"
            >
              <h3 className="text-lg font-semibold text-gray-900">Change order status</h3>
              <p className="mt-2 text-sm text-gray-600">
                Update status to <strong>{statusConfirmTarget}</strong>? This action will be saved immediately.
              </p>
              <div className="mt-6 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={handleCancelStatusChange}
                  disabled={updateStatusMutation.isPending}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmStatusChange}
                  disabled={updateStatusMutation.isPending}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50',
                    statusConfirmTarget === 'Cancelled'
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-blue-600 hover:bg-blue-700'
                  )}
                >
                  {updateStatusMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Updating…
                    </>
                  ) : (
                    'Confirm'
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default OrderDetails;
