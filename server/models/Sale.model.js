import mongoose from 'mongoose';

const saleItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  sku: String,
  name: String,
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  buyingPrice: {
    type: Number,
    required: true
  },
  sellingPrice: {
    type: Number,
    required: true
  },
  discount: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  tax: {
    type: Number,
    default: 0
  },
  profit: {
    type: Number,
    default: 0
  }
});

const saleSchema = new mongoose.Schema({
  invoiceNumber: {
    type: String,
    unique: true,
    uppercase: true
  },
  items: [saleItemSchema],
  customerName: {
    type: String,
    trim: true
  },
  customerEmail: {
    type: String,
    trim: true,
    lowercase: true
  },
  subTotal: {
    type: Number,
    required: true,
    min: 0
  },
  totalDiscount: {
    type: Number,
    default: 0,
    min: 0
  },
  totalTax: {
    type: Number,
    default: 0,
    min: 0
  },
  grandTotal: {
    type: Number,
    required: true,
    min: 0
  },
  totalProfit: {
    type: Number,
    default: 0
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'upi', 'bank_transfer', 'credit'],
    required: true
  },
  saleType: {
    type: String,
    enum: ['online', 'offline'],
    required: true
  },
  status: {
    type: String,
    enum: ['completed', 'pending', 'refunded', 'cancelled'],
    default: 'completed'
  },
  notes: {
    type: String,
    trim: true
  },
  refundedAmount: {
    type: Number,
    default: 0
  },
  refundReason: {
    type: String
  },
  franchise: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Franchise',
    required: true,
    index: true
  },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    default: null,
    index: true
  }
}, {
  timestamps: true
});

// Calculate totals before saving
saleSchema.pre('save', async function(next) {
  // Calculate item totals
  this.items.forEach(item => {
    const discountedPrice = item.sellingPrice * (1 - (item.discount / 100));
    const taxAmount = discountedPrice * (item.tax / 100);
    const finalPrice = discountedPrice + taxAmount;
    item.profit = (item.sellingPrice - item.buyingPrice) * item.quantity;
  });

  // Calculate sale totals
  this.subTotal = this.items.reduce((sum, item) => 
    sum + (item.sellingPrice * item.quantity), 0);
  
  this.totalDiscount = this.items.reduce((sum, item) => 
    sum + (item.sellingPrice * item.quantity * (item.discount / 100)), 0);
  
  this.totalTax = this.items.reduce((sum, item) => 
    sum + (item.sellingPrice * item.quantity * (1 - (item.discount / 100)) * (item.tax / 100)), 0);
  
  this.grandTotal = this.subTotal - this.totalDiscount + this.totalTax;
  this.totalProfit = this.items.reduce((sum, item) => sum + item.profit, 0);

  // Update product stock and sales data (skip when sale is from an order - order controller already updated stock)
  if (this.isNew && !this.order) {
    for (const item of this.items) {
      await mongoose.model('Product').findByIdAndUpdate(item.product, {
        $inc: {
          stockQuantity: -item.quantity,
          totalSold: item.quantity,
          totalRevenue: item.sellingPrice * item.quantity,
          totalProfit: item.profit
        },
        $set: { lastSold: new Date() }
      });
    }
  }

  next();
});

// Generate invoice number
saleSchema.pre('save', function(next) {
  if (!this.invoiceNumber) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    this.invoiceNumber = `INV-${year}${month}${day}-${random}`;
  }
  next();
});

// Indexes for efficient queries
saleSchema.index({ createdAt: -1 });
saleSchema.index({ createdAt: 1 }); // Ascending for date range queries
saleSchema.index({ saleType: 1, status: 1 });
saleSchema.index({ invoiceNumber: 'text', customerName: 'text', customerEmail: 'text' });
saleSchema.index({ totalProfit: -1 });
saleSchema.index({ 'items.product': 1 });
saleSchema.index({ franchise: 1, createdAt: -1 }); // For franchise-scoped queries (descending)
saleSchema.index({ franchise: 1, createdAt: 1 }); // For franchise-scoped queries (ascending) - CRITICAL for aggregations
saleSchema.index({ franchise: 1, status: 1 }); // For franchise status queries

export const Sale = mongoose.model('Sale', saleSchema);