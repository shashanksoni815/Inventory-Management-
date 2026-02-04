import express from 'express';
import {
  getAllSales,
  createSale,
  getSaleById,
  refundSale,
  generateInvoice,
  exportSalesReport,
  getSalesSummary,
} from '../controllers/sale.controller.js';

const router = express.Router();

router.get('/', getAllSales);
router.get('/summary', getSalesSummary);
router.get('/export', exportSalesReport);
router.get('/:id', getSaleById);
router.get('/:id/invoice', generateInvoice);
router.post('/', createSale);
router.post('/:id/refund', refundSale);

export default router;