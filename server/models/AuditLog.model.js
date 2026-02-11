// models/AuditLog.model.js
import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  actionType: {
    type: String,
    enum: ['import', 'export'],
    required: true,
    index: true
  },
  operationType: {
    type: String,
    enum: ['products', 'sales', 'profit_loss', 'stock_import', 'stock_export', 'inventory', 'orders'],
    required: true,
    index: true
  },
  fileName: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number, // in bytes (for exports, this is the generated file size)
    default: 0
  },
  format: {
    type: String,
    enum: ['excel', 'pdf', 'csv', 'xlsx'],
    default: 'excel'
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  franchise: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Franchise',
    index: true
  },
  // For imports: row counts
  totalRows: {
    type: Number,
    default: 0
  },
  successfulRows: {
    type: Number,
    default: 0
  },
  failedRows: {
    type: Number,
    default: 0
  },
  skippedRows: {
    type: Number,
    default: 0
  },
  // For exports: record counts
  totalRecords: {
    type: Number,
    default: 0
  },
  exportedRecords: {
    type: Number,
    default: 0
  },
  // Status
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'partial'],
    default: 'pending',
    index: true
  },
  // Timestamps
  startedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  completedAt: {
    type: Date,
    index: true
  },
  duration: {
    type: Number // in milliseconds
  },
  // Error tracking
  errors: [{
    row: Number,
    field: String,
    message: String,
    value: mongoose.Schema.Types.Mixed
  }],
  warnings: [{
    row: Number,
    field: String,
    message: String,
    value: mongoose.Schema.Types.Mixed
  }],
  // Additional metadata
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  // Request details
  requestParams: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  ipAddress: {
    type: String
  },
  userAgent: {
    type: String
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
auditLogSchema.index({ user: 1, createdAt: -1 });
auditLogSchema.index({ franchise: 1, createdAt: -1 });
auditLogSchema.index({ actionType: 1, createdAt: -1 });
auditLogSchema.index({ operationType: 1, createdAt: -1 });
auditLogSchema.index({ status: 1 });
auditLogSchema.index({ createdAt: -1 });

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
