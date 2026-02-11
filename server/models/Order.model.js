import mongoose from 'mongoose';

const deliveryAddressSchema = new mongoose.Schema({
  addressLine: {
    type: String,
    required: true,
    trim: true
  },
  city: {
    type: String,
    required: true,
    trim: true
  },
  state: {
    type: String,
    trim: true
  },
  pincode: {
    type: String,
    required: true,
    trim: true
  }
}, { _id: false });

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  productName: {
    type: String,
    required: true,
    trim: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  unitPrice: {
    type: Number,
    required: true,
    min: 0
  },
  tax: {
    type: Number,
    default: 0,
    min: 0
  },
  subtotal: {
    type: Number,
    required: true,
    min: 0
  }
}, { _id: false });

const paymentSchema = new mongoose.Schema({
  method: {
    type: String,
    enum: ['UPI', 'Card', 'COD'],
    required: true
  },
  status: {
    type: String,
    enum: ['Paid', 'Pending', 'Failed'],
    required: true
  },
  transactionId: {
    type: String,
    trim: true
  },
  gateway: {
    type: String,
    trim: true
  }
}, { _id: false });

const totalsSchema = new mongoose.Schema({
  itemTotal: {
    type: Number,
    required: true,
    min: 0
  },
  taxTotal: {
    type: Number,
    default: 0,
    min: 0
  },
  deliveryFee: {
    type: Number,
    default: 0,
    min: 0
  },
  discount: {
    type: Number,
    default: 0,
    min: 0
  },
  grandTotal: {
    type: Number,
    required: true,
    min: 0
  }
}, { _id: false });

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  franchise: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Franchise',
    required: true,
    index: true
  },
  customer: {
    name: {
      type: String,
      required: true,
      trim: true
    },
    phone: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      trim: true,
      lowercase: true
    }
  },
  deliveryAddress: {
    type: deliveryAddressSchema,
    required: true
  },
  items: {
    type: [orderItemSchema],
    required: true,
    validate: {
      validator(v) {
        return Array.isArray(v) && v.length > 0;
      },
      message: 'Order must have at least one item'
    }
  },
  payment: {
    type: paymentSchema,
    required: true
  },
  orderStatus: {
    type: String,
    enum: ['Pending', 'Confirmed', 'Packed', 'Shipped', 'Delivered', 'Cancelled'],
    default: 'Pending',
    index: true
  },
  totals: {
    type: totalsSchema,
    required: true
  },
  // Audit & soft delete fields
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  deletedAt: {
    type: Date,
    default: null,
    index: true
  },
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  }
}, {
  timestamps: true
});

// Compound index: orderNumber unique per franchise
orderSchema.index({ franchise: 1, orderNumber: 1 }, { unique: true });

// Indexes for common queries
orderSchema.index({ franchise: 1, createdAt: -1 });
orderSchema.index({ orderStatus: 1, franchise: 1 });
orderSchema.index({ 'payment.status': 1 });
orderSchema.index({ createdAt: -1 });

export const Order = mongoose.model('Order', orderSchema);
