import express from 'express';
import {
  getAllSales,
  createSale,
  getSaleById,
  refundSale,
  generateInvoice,
  exportSalesReport,
  getSalesSummary,
  importSales,
} from '../controllers/sale.controller.js';
import { uploadExcel } from '../middleware/upload.middleware.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = express.Router();

// Apply auth middleware to all sale routes
router.use(authMiddleware);

router.get('/', getAllSales);
router.get('/summary', getSalesSummary);
router.get('/export', exportSalesReport);
router.post('/import', uploadExcel, importSales); // Import route before /:id to avoid route conflict
router.get('/:id', getSaleById);
router.get('/:id/invoice', generateInvoice);
router.post('/', createSale);
router.post('/:id/refund', refundSale);

export default router;