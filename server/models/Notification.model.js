import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['info', 'success', 'warning', 'error', 'order', 'sale', 'inventory', 'system'],
    default: 'info'
  },
  category: {
    type: String,
    enum: ['order', 'sale', 'inventory', 'system', 'transfer', 'product', 'franchise'],
    default: 'system'
  },
  isRead: {
    type: Boolean,
    default: false,
    index: true
  },
  readAt: {
    type: Date,
    default: null
  },
  link: {
    type: String,
    trim: true,
    default: null
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  expiresAt: {
    type: Date,
    default: null,
    index: true
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index for auto-deletion

// Static method to create notification
notificationSchema.statics.createNotification = async function(userId, data) {
  const notification = new this({
    user: userId,
    title: data.title,
    message: data.message,
    type: data.type || 'info',
    category: data.category || 'system',
    link: data.link || null,
    metadata: data.metadata || {},
    priority: data.priority || 'medium',
    expiresAt: data.expiresAt || null
  });
  return await notification.save();
};

// Instance method to mark as read
notificationSchema.methods.markAsRead = async function() {
  this.isRead = true;
  this.readAt = new Date();
  return await this.save();
};

export const Notification = mongoose.model('Notification', notificationSchema);
