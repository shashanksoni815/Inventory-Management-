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
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/', getAllTransfers);
router.get('/admin/overview', getAdminTransfersOverview);
router.get('/statistics/:franchiseId', getTransferStatistics);
router.post('/import', importStock); // Stock import route before /:id to avoid route conflict
router.post('/export', exportStock); // Stock export route before /:id to avoid route conflict
router.get('/:id', getTransferById);
router.post('/', createTransfer);
router.put('/:id', updateTransfer);
router.post('/:id/approve', approveTransfer);
router.post('/:id/reject', rejectTransfer);
router.post('/:id/complete', completeTransfer);
router.post('/:id/cancel', cancelTransfer);

export default router;
