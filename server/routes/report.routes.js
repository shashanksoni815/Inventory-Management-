import express from 'express';
import {
  generateSalesReport,
  generateInventoryReport,
  generateProfitLossReport,
} from '../controllers/report.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

// Report routes - admin, manager, and sales (managers/sales can generate reports for their franchise)
router.get('/sales', protect, authorize('admin', 'manager', 'sales'), generateSalesReport);
router.get('/inventory', protect, authorize('admin', 'manager', 'sales'), generateInventoryReport);
router.get('/profit-loss', protect, authorize('admin', 'manager', 'sales'), generateProfitLossReport);

export default router;