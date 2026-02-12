import { Notification } from '../models/Notification.model.js';
import mongoose from 'mongoose';

/**
 * Get notifications for the authenticated user
 * GET /api/notifications
 * 
 * Query params:
 * - limit: number of notifications to return (default: 50)
 * - offset: pagination offset (default: 0)
 * - unreadOnly: return only unread notifications (default: false)
 * - type: filter by notification type
 * - category: filter by category
 */
export const getNotifications = async (req, res) => {
  try {
    const { user } = req;
    const { limit = 50, offset = 0, unreadOnly = false, type, category } = req.query;

    if (!user || !user._id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Build query
    const query = {
      user: user._id,
      ...(unreadOnly === 'true' && { isRead: false }),
      ...(type && { type }),
      ...(category && { category }),
      // Exclude expired notifications
      $or: [
        { expiresAt: null },
        { expiresAt: { $gt: new Date() } }
      ]
    };

    // Get notifications
    const [notifications, totalCount, unreadCount] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .limit(Number(limit))
        .skip(Number(offset))
        .lean(),
      Notification.countDocuments(query),
      Notification.countDocuments({
        user: user._id,
        isRead: false,
        $or: [
          { expiresAt: null },
          { expiresAt: { $gt: new Date() } }
        ]
      })
    ]);

    res.json({
      success: true,
      data: {
        notifications,
        pagination: {
          total: totalCount,
          limit: Number(limit),
          offset: Number(offset),
          hasMore: Number(offset) + notifications.length < totalCount
        },
        unreadCount
      }
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications',
      error: error.message
    });
  }
};

/**
 * Mark notification as read
 * PATCH /api/notifications/:id/read
 */
export const markNotificationAsRead = async (req, res) => {
  try {
    const { user } = req;
    const { id } = req.params;

    if (!user || !user._id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid notification ID'
      });
    }

    // Find notification and verify ownership
    const notification = await Notification.findOne({
      _id: id,
      user: user._id
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    // Mark as read if not already read
    if (!notification.isRead) {
      notification.isRead = true;
      notification.readAt = new Date();
      await notification.save();
    }

    // Get updated unread count
    const unreadCount = await Notification.countDocuments({
      user: user._id,
      isRead: false,
      $or: [
        { expiresAt: null },
        { expiresAt: { $gt: new Date() } }
      ]
    });

    res.json({
      success: true,
      data: {
        notification,
        unreadCount
      },
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read',
      error: error.message
    });
  }
};

/**
 * Mark all notifications as read for the user
 * PATCH /api/notifications/read-all
 */
export const markAllNotificationsAsRead = async (req, res) => {
  try {
    const { user } = req;

    if (!user || !user._id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const result = await Notification.updateMany(
      {
        user: user._id,
        isRead: false,
        $or: [
          { expiresAt: null },
          { expiresAt: { $gt: new Date() } }
        ]
      },
      {
        $set: {
          isRead: true,
          readAt: new Date()
        }
      }
    );

    res.json({
      success: true,
      data: {
        updatedCount: result.modifiedCount
      },
      message: `${result.modifiedCount} notification(s) marked as read`
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark all notifications as read',
      error: error.message
    });
  }
};

/**
 * Delete a notification
 * DELETE /api/notifications/:id
 */
export const deleteNotification = async (req, res) => {
  try {
    const { user } = req;
    const { id } = req.params;

    if (!user || !user._id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid notification ID'
      });
    }

    const notification = await Notification.findOneAndDelete({
      _id: id,
      user: user._id
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete notification',
      error: error.message
    });
  }
};
