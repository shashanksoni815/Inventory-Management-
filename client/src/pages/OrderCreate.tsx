/**
 * Create Order – manual order creation form (placeholder for full CRUD).
 * Route: /orders/new
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ShoppingBag } from 'lucide-react';

const OrderCreate: React.FC = () => {
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
        <div className="mt-3 flex items-center gap-2">
          <ShoppingBag className="h-5 w-5 text-blue-600" />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              Create Order
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Manually create a new order for the selected franchise.
            </p>
          </div>
        </div>
      </motion.div>

      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">
        Order creation form will be implemented in the next steps of the Orders
        CRUD & Import/Export flow.
      </div>
    </div>
  );
};

export default OrderCreate;

