// models/Franchise.js
import mongoose from 'mongoose';

const franchiseSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  location: {
    type: String,
    required: true
  },
  manager: {
    type: String,
    required: true
  },
  contact: {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },
    phone: {
      type: String,
      required: true
    },
    address: {
      type: String,
      required: true
    }
  },
  settings: {
    currency: {
      type: String,
      default: 'INR'
    },
    taxRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    openingHours: {
      type: String,
      default: '9:00 AM - 6:00 PM'
    },
    timezone: {
      type: String,
      default: 'UTC'
    }
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'maintenance'],
    default: 'active'
  },
  metadata: {
    color: {
      type: String,
      default: '#3B82F6'
    },
    icon: {
      type: String,
      default: '🏪'
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Update updatedAt on save
franchiseSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

export default mongoose.model('Franchise', franchiseSchema);