import mongoose from 'mongoose';
import { Notification } from '../models/Notification.model.js';

const VALID_TYPES = ['inventory', 'order', 'sale', 'user', 'franchise', 'system'];
const VALID_PRIORITIES = ['low', 'medium', 'high'];

/**
 * Build franchise filter for notifications.
 * Admin: sees all notifications (no filter).
 * Non-admin (manager/sales): filter = { franchise: req.user.franchise }
 */
const buildNotificationFranchiseFilter = (req) => {
  const user = req.user;
  if (!user) return { _id: { $exists: false } };
  if (user.role === 'admin') return {};
  const raw = user.franchise;
  const userFranchiseId = raw?._id?.toString() || (typeof raw === 'string' ? raw : raw?.toString?.());
  if (!userFranchiseId || !mongoose.Types.ObjectId.isValid(userFranchiseId)) {
    return { _id: { $exists: false } };
  }
  return { franchise: new mongoose.Types.ObjectId(userFranchiseId) };
};

/**
 * Check if user has access to a specific notification (for mark read / delete).
 * Admin: all. Non-admin: only notifications where franchise === req.user.franchise.
 */
const canAccessNotification = (user, notification) => {
  if (!user || !notification) return false;
  if (user.role === 'admin') return true;
  const raw = user.franchise;
  const userFranchiseId = raw?._id?.toString() || (typeof raw === 'string' ? raw : raw?.toString?.());
  const notifFranchiseId = notification.franchise?.toString?.() || notification.franchise;
  return userFranchiseId && notifFranchiseId && notifFranchiseId === userFranchiseId;
};

/**
 * Validate MongoDB ObjectId before update/delete.
 * Returns null if valid, error response if invalid.
 */
const validateNotificationId = (id, res) => {
  if (!id || typeof id !== 'string' || !mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({
      success: false,
      message: 'Invalid notification ID',
    });
    return false;
  }
  return true;
};

/**
 * 1️⃣ Create Notification
 * POST /api/notifications
 * Accept: title, message, type, priority, franchise (optional)
 * Security: Manager can only create for their own franchise (no cross-franchise).
 */
export const createNotification = async (req, res) => {
  try {
    const user = req.user;
    const { title, message, type, priority, franchise } = req.body;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Title is required',
      });
    }
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Message is required',
      });
    }
    if (!type || !VALID_TYPES.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `Type must be one of: ${VALID_TYPES.join(', ')}`,
      });
    }

    const payload = {
      title: title.trim(),
      message: message.trim(),
      type,
      priority: priority && VALID_PRIORITIES.includes(priority) ? priority : 'medium',
    };

    // No cross-franchise: non-admin can only create for their own franchise
    if (user.role !== 'admin') {
      const userFranchiseId = user.franchise?._id?.toString() || user.franchise?.toString?.();
      if (!userFranchiseId || !mongoose.Types.ObjectId.isValid(userFranchiseId)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: No franchise assigned',
        });
      }
      if (franchise && mongoose.Types.ObjectId.isValid(franchise)) {
        if (String(franchise).trim() !== userFranchiseId) {
          return res.status(403).json({
            success: false,
            message: 'Access denied: Cannot create notifications for other franchises',
          });
        }
      }
      payload.franchise = new mongoose.Types.ObjectId(userFranchiseId);
    } else if (franchise && mongoose.Types.ObjectId.isValid(franchise)) {
      payload.franchise = new mongoose.Types.ObjectId(franchise);
    }

    const notification = await Notification.create(payload);

    res.status(201).json({
      success: true,
      data: notification,
      message: 'Notification created successfully',
    });
  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create notification',
      error: error.message,
    });
  }
};

/**
 * 2️⃣ Get Notifications
 * GET /api/notifications
 * Admin → all; Manager/Sales → their franchise only.
 * Query: ?unread=true, ?type=inventory, ?limit, ?page
 */
export const getNotifications = async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const { unread, read, type, limit = 50, page = 1 } = req.query;
    const franchiseFilter = buildNotificationFranchiseFilter(req);

    const query = { ...franchiseFilter };
    if (unread === 'true' || unread === true) {
      query.read = false;
    } else if (read === 'true' || read === true) {
      query.read = true;
    }
    if (type && VALID_TYPES.includes(type)) {
      query.type = type;
    }

    const limitNum = Math.min(100, Math.max(1, Number(limit) || 50));
    const pageNum = Math.max(1, Number(page) || 1);
    const skip = (pageNum - 1) * limitNum;

    const [notifications, total] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('franchise', 'name code')
        .lean(),
      Notification.countDocuments(query),
    ]);

    const unreadCount = await Notification.countDocuments({
      ...franchiseFilter,
      read: false,
    });

    res.json({
      success: true,
      data: {
        notifications,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(total / limitNum),
        },
        unreadCount,
      },
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications',
      error: error.message,
    });
  }
};

/**
 * 3️⃣ Mark As Read
 * PATCH /api/notifications/:id/read
 * Security: Validate ID; no cross-franchise access (canAccessNotification).
 */
export const markNotificationAsRead = async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }
    if (!validateNotificationId(id, res)) return;

    const notification = await Notification.findById(id);
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
    }

    if (!canAccessNotification(user, notification)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You do not have access to this notification',
      });
    }

    if (!notification.read) {
      notification.read = true;
      await notification.save();
    }

    const franchiseFilter = buildNotificationFranchiseFilter(req);
    const unreadCount = await Notification.countDocuments({
      ...franchiseFilter,
      read: false,
    });

    res.json({
      success: true,
      data: { notification, unreadCount },
      message: 'Notification marked as read',
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read',
      error: error.message,
    });
  }
};

/**
 * Mark all notifications as read (for current user's scope)
 * PATCH /api/notifications/read-all
 */
export const markAllNotificationsAsRead = async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const franchiseFilter = buildNotificationFranchiseFilter(req);
    const result = await Notification.updateMany(
      { ...franchiseFilter, read: false },
      { $set: { read: true } }
    );

    const unreadCount = await Notification.countDocuments({
      ...franchiseFilter,
      read: false,
    });

    res.json({
      success: true,
      data: { updatedCount: result.modifiedCount, unreadCount },
      message: `${result.modifiedCount} notification(s) marked as read`,
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark all notifications as read',
      error: error.message,
    });
  }
};

/**
 * Delete all notifications (admin only)
 * DELETE /api/notifications/all
 */
export const deleteAllNotifications = async (req, res) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }
    if (user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Only admin can delete all notifications',
      });
    }

    const result = await Notification.deleteMany({});

    res.json({
      success: true,
      message: `${result.deletedCount} notification(s) deleted`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error('Error deleting all notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete notifications',
      error: error.message,
    });
  }
};

/**
 * 4️⃣ Delete Notification
 * DELETE /api/notifications/:id
 * Security: JWT + role (admin/manager); validate ID; no cross-franchise (canAccessNotification).
 */
export const deleteNotification = async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }
    // Validate role before delete
    if (user.role !== 'admin' && user.role !== 'manager') {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Only admin or manager can delete notifications',
      });
    }
    if (!validateNotificationId(id, res)) return;

    const notification = await Notification.findById(id);
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
    }

    if (!canAccessNotification(user, notification)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You do not have access to this notification',
      });
    }

    await Notification.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Notification deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete notification',
      error: error.message,
    });
  }
};
