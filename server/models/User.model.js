import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters']
  },
  role: {
    type: String,
    enum: {
      values: ['admin', 'manager', 'sales'],
      message: 'Role must be one of: admin, manager, sales'
    },
    required: [true, 'Role is required']
  },
  franchise: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Franchise',
    required: function() {
      // franchise is required for manager and sales, but NOT for admin
      return this.role === 'manager' || this.role === 'sales';
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  },
  settings: {
    theme: {
      type: String,
      enum: ['light', 'dark'],
      default: 'light'
    },
    currency: {
      type: String,
      default: 'INR'
    },
    taxRate: {
      type: Number,
      default: 10
    },
    lowStockThreshold: {
      type: Number,
      default: 10
    },
    refreshInterval: {
      type: Number,
      default: 30
    }
  }
}, {
  timestamps: true
});

// Index for email (already unique, but adding explicit index for performance)
userSchema.index({ email: 1 });
// Index for franchise (for franchise-scoped queries)
userSchema.index({ franchise: 1 });
// Index for role (for role-based queries)
userSchema.index({ role: 1 });

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

export const User = mongoose.model('User', userSchema);