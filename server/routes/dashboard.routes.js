import express from 'express';
import { 
  getDashboardStats, 
  getSalesAnalytics 
} from '../controllers/dashboard.controller.js';

const router = express.Router();

router.get('/stats', getDashboardStats);
router.get('/analytics', getSalesAnalytics);

export default router;