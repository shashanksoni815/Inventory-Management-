import express from 'express';
import {
  getFranchises,
  getFranchise,
  createFranchise,
  updateFranchise,
  getNetworkStats,
  getAdminKpis,
  getAdminCharts,
  getAdminFranchisePerformance,
  getAdminInsights,
  getFranchiseImportsExports,
  getFranchiseDashboard,
  getFranchiseOrdersSummary,
} from '../controllers/franchise.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/', getFranchises);
router.get('/network/stats', getNetworkStats);
router.get('/admin/kpis', getAdminKpis);
router.get('/admin/charts', getAdminCharts);
router.get('/admin/performance', getAdminFranchisePerformance);
router.get('/admin/insights', getAdminInsights);
router.get('/:franchiseId/dashboard', getFranchiseDashboard);
router.get('/:franchiseId/imports', getFranchiseImportsExports);
router.get('/:franchiseId/orders-summary', getFranchiseOrdersSummary);
router.get('/:id', getFranchise);
router.post('/', createFranchise);
router.put('/:id', updateFranchise);

export default router;
