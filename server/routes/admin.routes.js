// routes/admin.routes.js
import express from 'express';
import { getAdminDashboard } from '../controllers/admin.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

// Admin-only route
router.get('/dashboard', protect, authorize('admin'), getAdminDashboard);

export default router;
