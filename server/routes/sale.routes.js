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
import { protect, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

// View routes - accessible to all authenticated users (admin, manager, sales)
router.get('/', protect, authorize('admin', 'manager', 'sales'), getAllSales);
router.get('/summary', protect, authorize('admin', 'manager', 'sales'), getSalesSummary);
router.get('/export', protect, authorize('admin', 'manager', 'sales'), exportSalesReport);
router.get('/:id', protect, authorize('admin', 'manager', 'sales'), getSaleById);
router.get('/:id/invoice', protect, authorize('admin', 'manager', 'sales'), generateInvoice);

// Create sale - accessible to all authenticated users (admin, manager, sales)
router.post('/', protect, authorize('admin', 'manager', 'sales'), createSale);

// Management routes - admin and manager only
router.post('/import', protect, authorize('admin', 'manager'), uploadExcel, importSales); // Import route before /:id to avoid route conflict
router.post('/:id/refund', protect, authorize('admin', 'manager'), refundSale);

export default router;