import express from 'express';
import {
  generateSalesReport,
  generateInventoryReport,
  generateProfitLossReport,
} from '../controllers/report.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = express.Router();

// All report routes require authentication
router.use(authMiddleware);

router.get('/sales', generateSalesReport);
router.get('/inventory', generateInventoryReport);
router.get('/profit-loss', generateProfitLossReport);

export default router;