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
import { protect, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

// Admin-only routes
router.get('/network/stats', protect, authorize('admin', 'manager', 'sales'), getNetworkStats);
router.get('/admin/kpis', protect, authorize('admin'), getAdminKpis);
router.get('/admin/charts', protect, authorize('admin'), getAdminCharts);
router.get('/admin/performance', protect, authorize('admin'), getAdminFranchisePerformance);
router.get('/admin/insights', protect, authorize('admin'), getAdminInsights);
router.post('/', protect, authorize('admin'), createFranchise);
router.put('/:id', protect, authorize('admin'), updateFranchise);

// Public route for registration (franchise list needed during signup)
router.get('/', getFranchises);
// View routes - accessible to all authenticated users (admin, manager, sales)
router.get('/:id', protect, authorize('admin', 'manager', 'sales'), getFranchise);
router.get('/:franchiseId/dashboard', protect, authorize('admin', 'manager', 'sales'), getFranchiseDashboard);
router.get('/:franchiseId/imports', protect, authorize('admin', 'manager', 'sales'), getFranchiseImportsExports);
router.get('/:franchiseId/orders-summary', protect, authorize('admin', 'manager', 'sales'), getFranchiseOrdersSummary);

export default router;
