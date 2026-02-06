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
} from '../controllers/product.controller.js';

const router = express.Router();

router.get('/', getAllProducts);
router.get('/low-stock', getLowStockProducts);
router.get('/franchise/:franchiseId/analytics', getProductAnalytics);
router.get('/:id', getProductById);
router.post('/', createProduct);
router.post('/:id/share', shareProduct);
router.post('/:id/transfer', transferStock);
router.put('/:id', updateProduct);
router.delete('/:id', deleteProduct);
router.post('/bulk-delete', bulkDeleteProducts);
router.post('/:id/stock', updateStock);

export default router;