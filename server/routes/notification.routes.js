import express from 'express';
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification
} from '../controllers/notification.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

// Notification routes - accessible to all authenticated users (admin, manager, sales)
router.get('/', protect, authorize('admin', 'manager', 'sales'), getNotifications);
router.patch('/:id/read', protect, authorize('admin', 'manager', 'sales'), markNotificationAsRead);
router.patch('/read-all', protect, authorize('admin', 'manager', 'sales'), markAllNotificationsAsRead);
router.delete('/:id', protect, authorize('admin', 'manager', 'sales'), deleteNotification);

export default router;
