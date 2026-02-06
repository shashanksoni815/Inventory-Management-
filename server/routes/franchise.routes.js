import express from 'express';
import {
  getFranchises,
  getFranchise,
  createFranchise,
  updateFranchise,
  getNetworkStats,
} from '../controllers/franchise.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/', getFranchises);
router.get('/network/stats', getNetworkStats);
router.get('/:id', getFranchise);
router.post('/', createFranchise);
router.put('/:id', updateFranchise);

export default router;
