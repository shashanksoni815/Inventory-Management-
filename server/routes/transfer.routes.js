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
} from '../controllers/transfer.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/', getAllTransfers);
router.get('/statistics/:franchiseId', getTransferStatistics);
router.get('/:id', getTransferById);
router.post('/', createTransfer);
router.put('/:id', updateTransfer);
router.post('/:id/approve', approveTransfer);
router.post('/:id/reject', rejectTransfer);
router.post('/:id/complete', completeTransfer);
router.post('/:id/cancel', cancelTransfer);

export default router;
