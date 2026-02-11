import express from 'express';
import { getOrders, getOrderById, createOrder, updateOrder, deleteOrder, updateOrderStatus, importOrders, exportOrders } from '../controllers/order.controller.js';
import { uploadExcel } from '../middleware/upload.middleware.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/', getOrders);
router.get('/export', exportOrders);
router.get('/:id', getOrderById);
router.post('/import', uploadExcel, importOrders);
router.post('/', createOrder);
router.put('/:id', updateOrder);
router.delete('/:id', deleteOrder);
router.patch('/:id/status', updateOrderStatus);

export default router;
