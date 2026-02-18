/**
 * Notification Helper - Fire-and-forget system notifications
 * Does not block the main request; errors are logged but not thrown.
 */
import { Notification } from '../models/Notification.model.js';
import mongoose from 'mongoose';

/**
 * Create a system notification (async, non-blocking)
 * @param {Object} params
 * @param {string} params.title - Notification title
 * @param {string} params.message - Notification message
 * @param {string} params.type - inventory | order | sale | user | franchise | system
 * @param {string} [params.priority='medium'] - low | medium | high
 * @param {string|ObjectId|null} [params.franchise] - Franchise ID or null for system-wide
 */
export async function createSystemNotification({ title, message, type, priority = 'medium', franchise = null }) {
  try {
    const validTypes = ['inventory', 'order', 'sale', 'user', 'franchise', 'system'];
    const validPriorities = ['low', 'medium', 'high'];
    const notifType = validTypes.includes(type) ? type : 'system';
    const notifPriority = validPriorities.includes(priority) ? priority : 'medium';

    const doc = {
      title: String(title || 'Notification').trim(),
      message: String(message || '').trim(),
      type: notifType,
      priority: notifPriority,
    };

    if (franchise && mongoose.Types.ObjectId.isValid(franchise)) {
      doc.franchise = new mongoose.Types.ObjectId(franchise);
    }

    await Notification.create(doc);
  } catch (err) {
    console.error('[notificationHelper] Failed to create notification:', err.message);
  }
}
