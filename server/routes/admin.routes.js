// routes/admin.routes.js
import express from 'express';
import { getAdminDashboard } from '../controllers/admin.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/dashboard', getAdminDashboard);

export default router;
