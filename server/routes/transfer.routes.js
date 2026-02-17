// routes/transfer.routes.js
import express from 'express';
import {
  getAllTransfers,
  getTransferById,
  createTransfer,
  updateTransfer,
  approveTransfer,
  rejectTransfer,
  completeTransfer,
  cancelTransfer,
  getTransferStatistics,
  getAdminTransfersOverview,
  importStock,
  exportStock,
} from '../controllers/transfer.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

// Admin-only routes
router.get('/admin/overview', protect, authorize('admin'), getAdminTransfersOverview);

// View routes - accessible to all authenticated users (admin, manager, sales)
router.get('/', protect, authorize('admin', 'manager', 'sales'), getAllTransfers);
router.get('/statistics/:franchiseId', protect, authorize('admin', 'manager', 'sales'), getTransferStatistics);
router.get('/:id', protect, authorize('admin', 'manager', 'sales'), getTransferById);

// Management routes - admin and manager only
router.post('/import', protect, authorize('admin', 'manager'), importStock); // Stock import route before /:id to avoid route conflict
router.post('/export', protect, authorize('admin', 'manager'), exportStock); // Stock export route before /:id to avoid route conflict
router.post('/', protect, authorize('admin', 'manager'), createTransfer);
router.put('/:id', protect, authorize('admin', 'manager'), updateTransfer);
router.post('/:id/approve', protect, authorize('admin', 'manager'), approveTransfer);
router.post('/:id/reject', protect, authorize('admin', 'manager'), rejectTransfer);
router.post('/:id/complete', protect, authorize('admin', 'manager'), completeTransfer);
router.post('/:id/cancel', protect, authorize('admin', 'manager'), cancelTransfer);

export default router;
