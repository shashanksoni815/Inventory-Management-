import express from 'express';
import { 
  getDashboardStats, 
  getSalesAnalytics,
  getAdminDashboard
} from '../controllers/dashboard.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

// View routes - accessible to all authenticated users (admin, manager, sales)
router.get('/stats', protect, authorize('admin', 'manager', 'sales'), getDashboardStats);
router.get('/analytics', protect, authorize('admin', 'manager', 'sales'), getSalesAnalytics);

// Admin-only route
router.get('/admin', protect, authorize('admin'), getAdminDashboard);

export default router;