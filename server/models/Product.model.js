import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  sku: {
    type: String,
    required: true,
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
  
  // New Franchise Fields
  franchise: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Franchise',
    required: true,
    index: true
  },
  isGlobal: {
    type: Boolean,
    default: false
  },
  sharedWith: [{
    franchise: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Franchise'
    },
    quantity: {
      type: Number,
      default: 0,
      min: 0
    }
  }],
  originalFranchise: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Franchise'
  },
  transferable: {
    type: Boolean,
    default: true
  },
  
  // Existing Fields
  images: [{
    url: String,
    publicId: String
  }],
  status: {
    type: String,
    enum: ['active', 'inactive', 'discontinued'],
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
    date: {
      type: Date,
      default: Date.now
    },
    quantity: Number,
    type: {
      type: String,
      enum: ['purchase', 'sale', 'adjustment', 'return', 'transfer_in', 'transfer_out']
    },
    reference: String,
    note: String,
    franchise: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Franchise'
    }
  }],
  
  // Franchise-specific pricing
  franchisePricing: [{
    franchise: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Franchise'
    },
    sellingPrice: Number,
    buyingPrice: Number,
    effectiveFrom: Date,
    effectiveTo: Date
  }],
  
  // Replenishment settings per franchise
  replenishmentSettings: {
    reorderPoint: {
      type: Number,
      default: 10
    },
    reorderQuantity: {
      type: Number,
      default: 50
    },
    supplier: String,
    leadTimeDays: {
      type: Number,
      default: 7
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound index for SKU + Franchise uniqueness
productSchema.index({ sku: 1, franchise: 1 }, { unique: true });

// Index for franchise queries
productSchema.index({ franchise: 1, category: 1 });
productSchema.index({ category: 1 }); // CRITICAL: Standalone index for category aggregations
productSchema.index({ franchise: 1, status: 1 });
productSchema.index({ franchise: 1, stockQuantity: 1 });
productSchema.index({ franchise: 1, isGlobal: 1 });

// Text search index for franchise-specific searches
productSchema.index({ 
  franchise: 1, 
  name: 'text', 
  description: 'text', 
  sku: 'text', 
  brand: 'text' 
});

// Pre-save middleware
productSchema.pre('save', function(next) {
  // Calculate profit margin
  if (this.buyingPrice && this.sellingPrice) {
    const profit = this.sellingPrice - this.buyingPrice;
    this.profitMargin = (profit / this.buyingPrice) * 100;
  }
  
  // Set original franchise for shared products
  if (this.isGlobal && !this.originalFranchise) {
    this.originalFranchise = this.franchise;
  }
  
  next();
});

// Virtuals
productSchema.virtual('stockStatus').get(function() {
  if (this.stockQuantity === 0) return 'out-of-stock';
  if (this.stockQuantity <= (this.replenishmentSettings?.reorderPoint || this.minimumStock)) {
    return 'low-stock';
  }
  return 'in-stock';
});

productSchema.virtual('inventoryValue').get(function() {
  return this.stockQuantity * this.buyingPrice;
});

productSchema.virtual('daysSinceLastSale').get(function() {
  if (!this.lastSold) return null;
  const diff = Date.now() - this.lastSold.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
});

productSchema.virtual('availableInFranchises').get(function() {
  const franchises = [this.franchise];
  if (this.isGlobal) {
    return [...franchises, ...this.sharedWith.map(s => s.franchise)];
  }
  return franchises;
});

// Instance methods
productSchema.methods.getFranchiseStock = function(franchiseId) {
  if (this.franchise.toString() === franchiseId.toString()) {
    return {
      franchise: this.franchise,
      quantity: this.stockQuantity,
      isOriginal: true
    };
  }
  
  const shared = this.sharedWith.find(s => 
    s.franchise.toString() === franchiseId.toString()
  );
  
  if (shared) {
    return {
      franchise: shared.franchise,
      quantity: shared.quantity,
      isOriginal: false
    };
  }
  
  return null;
};

productSchema.methods.transferStock = async function(toFranchiseId, quantity, note = '') {
  if (!this.transferable) {
    throw new Error('Product is not transferable');
  }
  
  if (this.stockQuantity < quantity) {
    throw new Error('Insufficient stock for transfer');
  }
  
  // Find or create shared entry
  let sharedEntry = this.sharedWith.find(s => 
    s.franchise.toString() === toFranchiseId.toString()
  );
  
  if (!sharedEntry) {
    sharedEntry = {
      franchise: toFranchiseId,
      quantity: 0
    };
    this.sharedWith.push(sharedEntry);
  }
  
  // Update quantities
  this.stockQuantity -= quantity;
  sharedEntry.quantity += quantity;
  
  // Add to stock history
  this.stockHistory.push({
    quantity: quantity,
    type: 'transfer_out',
    note: `Transferred ${quantity} units to franchise ${toFranchiseId}. ${note}`,
    franchise: toFranchiseId
  });
  
  await this.save();
  
  // Create transfer record
  const Transfer = mongoose.model('Transfer');
  await Transfer.create({
    product: this._id,
    fromFranchise: this.franchise,
    toFranchise: toFranchiseId,
    quantity: quantity,
    note: note,
    status: 'completed'
  });
  
  return this;
};

productSchema.methods.getFranchisePrice = function(franchiseId) {
  const pricing = this.franchisePricing.find(p => 
    p.franchise.toString() === franchiseId.toString() &&
    (!p.effectiveFrom || p.effectiveFrom <= new Date()) &&
    (!p.effectiveTo || p.effectiveTo >= new Date())
  );
  
  return {
    sellingPrice: pricing?.sellingPrice || this.sellingPrice,
    buyingPrice: pricing?.buyingPrice || this.buyingPrice
  };
};

// Static methods
productSchema.statics.findByFranchise = function(franchiseId, query = {}) {
  return this.find({
    $or: [
      { franchise: franchiseId },
      { isGlobal: true, 'sharedWith.franchise': franchiseId },
      { isGlobal: true, franchise: franchiseId }
    ],
    ...query
  });
};

productSchema.statics.getLowStockProducts = function(franchiseId) {
  return this.find({
    $or: [
      { 
        franchise: franchiseId,
        stockQuantity: { $lte: '$replenishmentSettings.reorderPoint' }
      },
      {
        'sharedWith.franchise': franchiseId,
        'sharedWith.quantity': { $lte: '$replenishmentSettings.reorderPoint' }
      }
    ],
    status: 'active'
  });
};

productSchema.statics.getFranchiseInventoryValue = async function(franchiseId) {
  const result = await this.aggregate([
    {
      $match: {
        $or: [
          { franchise: franchiseId },
          { isGlobal: true, 'sharedWith.franchise': franchiseId }
        ]
      }
    },
    {
      $project: {
        franchiseStock: {
          $cond: {
            if: { $eq: ['$franchise', franchiseId] },
            then: {
              quantity: '$stockQuantity',
              buyingPrice: '$buyingPrice'
            },
            else: {
              $let: {
                vars: {
                  shared: {
                    $arrayElemAt: [
                      {
                        $filter: {
                          input: '$sharedWith',
                          as: 'item',
                          cond: { $eq: ['$$item.franchise', franchiseId] }
                        }
                      },
                      0
                    ]
                  }
                },
                in: {
                  quantity: '$$shared.quantity',
                  buyingPrice: '$buyingPrice'
                }
              }
            }
          }
        }
      }
    },
    {
      $project: {
        value: {
          $multiply: ['$franchiseStock.quantity', '$franchiseStock.buyingPrice']
        }
      }
    },
    {
      $group: {
        _id: null,
        totalValue: { $sum: '$value' }
      }
    }
  ]);
  
  return result[0]?.totalValue || 0;
};

export const Product = mongoose.model('Product', productSchema);