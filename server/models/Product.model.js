import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  sku: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    enum: ['Electronics', 'Clothing', 'Books', 'Home & Kitchen', 'Sports', 'Other'],
    index: true
  },
  brand: {
    type: String,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  buyingPrice: {
    type: Number,
    required: true,
    min: 0
  },
  sellingPrice: {
    type: Number,
    required: true,
    min: 0
  },
  profitMargin: {
    type: Number,
    default: 0,
    min: -100,
    max: 1000
  },
  stockQuantity: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  minimumStock: {
    type: Number,
    default: 10
  },
  images: [{
    url: String,
    publicId: String
  }],
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  lastSold: {
    type: Date
  },
  totalSold: {
    type: Number,
    default: 0
  },
  totalRevenue: {
    type: Number,
    default: 0
  },
  totalProfit: {
    type: Number,
    default: 0
  },
  stockHistory: [{
    date: Date,
    quantity: Number,
    type: {
      type: String,
      enum: ['purchase', 'sale', 'adjustment', 'return']
    },
    reference: String,
    note: String
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Calculate profit margin before saving
productSchema.pre('save', function(next) {
  if (this.buyingPrice && this.sellingPrice) {
    const profit = this.sellingPrice - this.buyingPrice;
    this.profitMargin = (profit / this.buyingPrice) * 100;
  }
  next();
});

// Virtual for stock status
productSchema.virtual('stockStatus').get(function() {
  if (this.stockQuantity === 0) return 'out-of-stock';
  if (this.stockQuantity <= this.minimumStock) return 'low-stock';
  return 'in-stock';
});

// Virtual for inventory value
productSchema.virtual('inventoryValue').get(function() {
  return this.stockQuantity * this.buyingPrice;
});

// Indexes
productSchema.index({ name: 'text', description: 'text', sku: 'text' });
productSchema.index({ category: 1, brand: 1 });
productSchema.index({ stockStatus: 1 });
productSchema.index({ lastSold: -1 });

export const Product = mongoose.model('Product', productSchema);