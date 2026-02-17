import express from 'express';
import { getOrders, getOrderById, createOrder, updateOrder, deleteOrder, updateOrderStatus, importOrders, exportOrders } from '../controllers/order.controller.js';
import { uploadExcel } from '../middleware/upload.middleware.js';
import { protect, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

// View routes - accessible to all authenticated users (admin, manager, sales)
router.get('/', protect, authorize('admin', 'manager', 'sales'), getOrders);
router.get('/export', protect, authorize('admin', 'manager', 'sales'), exportOrders);
router.get('/:id', protect, authorize('admin', 'manager', 'sales'), getOrderById);

// Management routes - admin and manager only
router.post('/', protect, authorize('admin', 'manager'), createOrder);
router.post('/import', protect, authorize('admin', 'manager'), uploadExcel, importOrders);
router.put('/:id', protect, authorize('admin', 'manager'), updateOrder);
router.delete('/:id', protect, authorize('admin', 'manager'), deleteOrder);
router.patch('/:id/status', protect, authorize('admin', 'manager'), updateOrderStatus);

export default router;
