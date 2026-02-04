import express from 'express';
import {
  generateSalesReport,
  generateInventoryReport,
  generateProfitLossReport,
} from '../controllers/report.controller.js';

const router = express.Router();

router.get('/sales', generateSalesReport);
router.get('/inventory', generateInventoryReport);
router.get('/profit-loss', generateProfitLossReport);

export default router;