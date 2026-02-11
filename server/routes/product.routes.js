import express from 'express';
import {
  getAllProducts,
  getProductById,
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
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = express.Router();

// Apply auth middleware to all product routes
router.use(authMiddleware);

router.get('/', getAllProducts);
router.get('/export', exportProducts); // Export route before /:id to avoid route conflict
router.get('/low-stock', getLowStockProducts);
router.get('/franchise/:franchiseId/analytics', getProductAnalytics);
router.get('/:id', getProductById);
router.post('/', createProduct);
router.post('/import', uploadExcel, importProducts); // Import route before /:id to avoid route conflict
router.post('/:id/share', shareProduct);
router.post('/:id/transfer', transferStock);
router.put('/:id', updateProduct);
router.delete('/:id', deleteProduct);
router.post('/bulk-delete', bulkDeleteProducts);
router.post('/:id/stock', updateStock);

export default router;