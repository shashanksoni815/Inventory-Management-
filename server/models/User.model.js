import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    index: true
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    // Note: minlength validation removed as password is hashed before save
    // Password length validation is done in pre-save hook and controllers
  },
  role: {
    type: String,
    enum: {
      values: ['admin', 'manager', 'sales'],
      message: 'Role must be one of: admin, manager, sales'
    },
    required: [true, 'Role is required'],
    index: true
  },
  franchise: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Franchise',
    required: false, // Made optional at schema level, validated in pre-save hook
    index: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
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
      default: 'INR',
      maxlength: [10, 'Currency code cannot exceed 10 characters']
    },
    taxRate: {
      type: Number,
      default: 10,
      min: [0, 'Tax rate cannot be negative'],
      max: [100, 'Tax rate cannot exceed 100%']
    },
    lowStockThreshold: {
      type: Number,
      default: 10,
      min: [0, 'Low stock threshold cannot be negative']
    },
    refreshInterval: {
      type: Number,
      default: 30,
      min: [5, 'Refresh interval must be at least 5 seconds'],
      max: [300, 'Refresh interval cannot exceed 300 seconds']
    }
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      // Remove password from JSON output
      delete ret.password;
      return ret;
    }
  },
  toObject: {
    transform: function(doc, ret) {
      // Remove password from object output
      delete ret.password;
      return ret;
    }
  }
});

// Compound indexes for common query patterns
userSchema.index({ franchise: 1, role: 1 });
userSchema.index({ franchise: 1, isActive: 1 });
userSchema.index({ role: 1, isActive: 1 });

// Validate franchise requirement and hash password before saving
userSchema.pre('save', async function(next) {
  // Validate franchise requirement
  // Franchise is required for manager and sales roles, but NOT for admin
  if ((this.role === 'manager' || this.role === 'sales') && !this.franchise) {
    return next(new Error('Franchise is required for manager and sales roles'));
  }
  
  // Admin should not have a franchise
  if (this.role === 'admin' && this.franchise) {
    return next(new Error('Admin role cannot be assigned to a franchise'));
  }
  
  // Hash password if it's been modified (or is new)
  if (this.isModified('password')) {
    // Validate password length before hashing
    if (!this.password || typeof this.password !== 'string' || this.password.length < 8) {
      return next(new Error('Password must be at least 8 characters'));
    }
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  } catch (error) {
      return next(error);
    }
  }
  
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!candidatePassword || typeof candidatePassword !== 'string') {
    return false;
  }
  
  if (!this.password) {
    return false;
  }
  
  try {
  return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    console.error('Error comparing password:', error);
    return false;
  }
};

// Instance method to get user without password
userSchema.methods.toSafeObject = function() {
  const userObject = this.toObject();
  delete userObject.password;
  return userObject;
};

export const User = mongoose.model('User', userSchema);