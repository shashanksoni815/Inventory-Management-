// models/Transfer.js
import mongoose from 'mongoose';

const transferSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true
  },
  fromFranchise: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Franchise',
    required: true,
    index: true
  },
  toFranchise: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Franchise',
    required: true,
    index: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  unitPrice: {
    type: Number,
    min: 0
  },
  totalValue: {
    type: Number,
    min: 0
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'in_transit', 'completed', 'cancelled'],
    default: 'pending'
  },
  initiatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  transferDate: {
    type: Date,
    default: Date.now
  },
  expectedDelivery: Date,
  actualDelivery: Date,
  trackingNumber: String,
  carrier: String,
  shippingCost: {
    type: Number,
    default: 0,
    min: 0
  },
  notes: String,
  documents: [{
    name: String,
    url: String,
    type: String
  }],
  history: [{
    date: Date,
    status: String,
    note: String,
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }]
}, {
  timestamps: true
});

// Pre-save middleware
transferSchema.pre('save', function(next) {
  // Calculate total value
  if (this.unitPrice && this.quantity) {
    this.totalValue = this.unitPrice * this.quantity;
  }
  
  // Add to history
  if (this.isModified('status')) {
    this.history.push({
      date: new Date(),
      status: this.status,
      note: `Status changed to ${this.status}`
    });
  }
  
  next();
});

// Indexes
transferSchema.index({ fromFranchise: 1, status: 1 });
transferSchema.index({ toFranchise: 1, status: 1 });
transferSchema.index({ transferDate: -1 });
transferSchema.index({ product: 1, status: 1 });

export const Transfer = mongoose.model('Transfer', transferSchema);