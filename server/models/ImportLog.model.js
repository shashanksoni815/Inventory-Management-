// models/ImportLog.model.js
import mongoose from 'mongoose';

const importLogSchema = new mongoose.Schema({
  importType: {
    type: String,
    enum: ['products', 'sales', 'transfers'],
    required: true
  },
  fileName: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number, // in bytes
    required: true
  },
  totalRows: {
    type: Number,
    required: true
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
  importedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  franchise: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Franchise',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'partial'],
    default: 'pending'
  },
  startedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date
  },
  duration: {
    type: Number // in milliseconds
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Indexes
importLogSchema.index({ importedBy: 1, createdAt: -1 });
importLogSchema.index({ franchise: 1, createdAt: -1 });
importLogSchema.index({ importType: 1, createdAt: -1 });
importLogSchema.index({ status: 1 });

export const ImportLog = mongoose.model('ImportLog', importLogSchema);
