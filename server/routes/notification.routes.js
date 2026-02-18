/**
 * Notification routes
 * Security: All routes protected by JWT (protect middleware).
 * Role validation on delete; no cross-franchise access enforced in controller.
 */
import express from 'express';
import {
  createNotification,
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteAllNotifications,
  deleteNotification,
} from '../controllers/notification.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

// Create notification - admin/manager only (manual create)
router.post('/', protect, authorize('admin', 'manager'), createNotification);

// Get notifications - admin sees all; manager/sales see their franchise
router.get('/', protect, authorize('admin', 'manager', 'sales'), getNotifications);

// Mark as read (read-all must come before :id/read)
router.patch('/read-all', protect, authorize('admin', 'manager', 'sales'), markAllNotificationsAsRead);
router.patch('/:id/read', protect, authorize('admin', 'manager', 'sales'), markNotificationAsRead);

// Delete all - admin only (must be before /:id)
router.delete('/all', protect, authorize('admin'), deleteAllNotifications);
// Delete single - admin or manager
router.delete('/:id', protect, authorize('admin', 'manager'), deleteNotification);

export default router;
