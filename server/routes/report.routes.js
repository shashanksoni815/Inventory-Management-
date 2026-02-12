import express from 'express';
import {
  generateSalesReport,
  generateInventoryReport,
  generateProfitLossReport,
} from '../controllers/report.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

// Report routes - admin and manager only (managers can generate reports for their franchise)
router.get('/sales', protect, authorize('admin', 'manager'), generateSalesReport);
router.get('/inventory', protect, authorize('admin', 'manager'), generateInventoryReport);
router.get('/profit-loss', protect, authorize('admin', 'manager'), generateProfitLossReport);

export default router;