import express from 'express';
import {
  getAllProducts,
  getProductById,
  getPublicProductBySku,
  createProduct,
  updateProduct,
  deleteProduct,
  bulkDeleteProducts,
  updateStock,
  getLowStockProducts,
  getProductAnalytics,
  shareProduct,
  transferStock,
  importProducts,
  exportProducts,
} from '../controllers/product.controller.js';
import { uploadExcel } from '../middleware/upload.middleware.js';
import { protect, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

// Public route - no authentication required
router.get('/public/:sku', getPublicProductBySku);

// View routes - accessible to all authenticated users (admin, manager, sales)
router.get('/', protect, authorize('admin', 'manager', 'sales'), getAllProducts);
router.get('/export', protect, authorize('admin', 'manager', 'sales'), exportProducts); // Export route before /:id to avoid route conflict
router.get('/low-stock', protect, authorize('admin', 'manager', 'sales'), getLowStockProducts);
router.get('/franchise/:franchiseId/analytics', protect, authorize('admin', 'manager', 'sales'), getProductAnalytics);
router.get('/:id', protect, authorize('admin', 'manager', 'sales'), getProductById);

// Management routes - admin and manager only
router.post('/', protect, authorize('admin', 'manager'), createProduct);
router.post('/import', protect, authorize('admin', 'manager'), uploadExcel, importProducts); // Import route before /:id to avoid route conflict
router.post('/:id/share', protect, authorize('admin', 'manager'), shareProduct);
router.post('/:id/transfer', protect, authorize('admin', 'manager'), transferStock);
router.put('/:id', protect, authorize('admin', 'manager'), updateProduct);
router.delete('/:id', protect, authorize('admin', 'manager'), deleteProduct);
router.post('/bulk-delete', protect, authorize('admin', 'manager'), bulkDeleteProducts);
router.post('/:id/stock', protect, authorize('admin', 'manager'), updateStock);

export default router;