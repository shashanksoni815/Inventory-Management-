import mongoose from 'mongoose';
import { User } from '../models/User.model.js';
import Franchise from '../models/Franchise.js';
import jwt from 'jsonwebtoken';

const getJwtSecret = () => process.env.JWT_SECRET || 'your-secret-key';

/**
 * GET /api/users
 * Get all users (admin only)
 * Supports filtering by role and franchise
 */
export const getAllUsers = async (req, res) => {
  try {
    const { role, franchise, search, page = 1, limit = 50 } = req.query;
    
    const query = {};
    
    // Filter by role
    if (role && ['admin', 'manager', 'sales'].includes(role)) {
      query.role = role;
    }
    
    // Filter by franchise
    if (franchise && mongoose.Types.ObjectId.isValid(franchise)) {
      query.franchise = new mongoose.Types.ObjectId(franchise);
    }
    
    // Search by name or email
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { name: searchRegex },
        { email: searchRegex },
      ];
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [users, total] = await Promise.all([
      User.find(query)
        .select('-password')
        .populate('franchise', 'name code')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      User.countDocuments(query),
    ]);
    
    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: error.message,
    });
  }
};

/**
 * GET /api/users/:id
 * Get user by ID (admin only)
 */
export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID',
      });
    }
    
    const user = await User.findById(id)
      .select('-password')
      .populate('franchise', 'name code')
      .lean();
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }
    
    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user',
      error: error.message,
    });
  }
};

/**
 * POST /api/users
 * Create new user (admin only)
 * Can create manager or sales users
 */
export const createUser = async (req, res) => {
  try {
    const { name, email, password, role, franchise } = req.body;
    
    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required',
      });
    }
    
    // Validate password length
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters',
      });
    }
    
    // Validate role
    const validRoles = ['manager', 'sales'];
    const userRole = role || 'sales';
    if (!validRoles.includes(userRole)) {
      return res.status(400).json({
        success: false,
        message: `Role must be one of: ${validRoles.join(', ')}. Admin accounts cannot be created through this endpoint.`,
      });
    }
    
    // Validate franchise requirement for manager and sales
    const hasFranchise = franchise && String(franchise).trim() !== '';
    if (!hasFranchise) {
      return res.status(400).json({
        success: false,
        message: 'Franchise is required for manager and sales roles',
      });
    }
    
    // Normalize email
    const normalizedEmail = String(email).trim().toLowerCase();
    
    // Check if email already exists
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Email already registered',
      });
    }
    
    // Validate franchise ID format
    const franchiseId = String(franchise).trim();
    if (!mongoose.Types.ObjectId.isValid(franchiseId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid franchise ID format',
      });
    }
    
    // Verify franchise exists
    const franchiseExists = await Franchise.findById(franchiseId);
    if (!franchiseExists) {
      return res.status(400).json({
        success: false,
        message: 'Selected franchise does not exist',
      });
    }
    
    // Create user data object
    const userData = {
      name: name.trim(),
      email: normalizedEmail,
      password, // Will be hashed by pre-save hook
      role: userRole,
      franchise: franchiseId,
      isActive: true,
      settings: {
        theme: 'light',
        currency: 'INR',
        taxRate: 10,
        lowStockThreshold: 10,
        refreshInterval: 30,
      },
    };
    
    // Create user (password will be hashed by pre-save hook)
    const user = await User.create(userData);
    
    // Populate franchise for response
    await user.populate('franchise', 'name code');
    
    // Remove password from response
    const userResponse = user.toObject();
    delete userResponse.password;
    
    res.status(201).json({
      success: true,
      data: userResponse,
      message: `${userRole.charAt(0).toUpperCase() + userRole.slice(1)} user created successfully`,
    });
  } catch (error) {
    console.error('Error creating user:', error);
    
    // Handle duplicate email error
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Email already registered',
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to create user',
      error: error.message,
    });
  }
};

/**
 * PUT /api/users/:id
 * Update user (admin only)
 */
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID',
      });
    }
    
    const user = await User.findById(id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }
    
    // Prevent role change to admin through this endpoint
    if (updates.role === 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Cannot change user role to admin through this endpoint',
      });
    }
    
    // If updating franchise, validate it exists
    if (updates.franchise) {
      if (!mongoose.Types.ObjectId.isValid(updates.franchise)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid franchise ID format',
        });
      }
      
      const franchiseExists = await Franchise.findById(updates.franchise);
      if (!franchiseExists) {
        return res.status(400).json({
          success: false,
          message: 'Selected franchise does not exist',
        });
      }
    }
    
    // Normalize email if provided
    if (updates.email) {
      updates.email = String(updates.email).trim().toLowerCase();
      
      // Check if email is already taken by another user
      const existing = await User.findOne({ 
        email: updates.email,
        _id: { $ne: id }
      });
      if (existing) {
        return res.status(409).json({
          success: false,
          message: 'Email already registered',
        });
      }
    }
    
    // Update user fields
    Object.keys(updates).forEach(key => {
      if (key !== '_id' && key !== '__v' && key !== 'createdAt' && key !== 'updatedAt' && key !== 'password') {
        user[key] = updates[key];
      }
    });
    
    // Handle password update separately (will be hashed by pre-save hook)
    if (updates.password) {
      if (updates.password.length < 8) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 8 characters',
        });
      }
      user.password = updates.password;
    }
    
    await user.save();
    
    // Populate franchise for response
    await user.populate('franchise', 'name code');
    
    // Remove password from response
    const userResponse = user.toObject();
    delete userResponse.password;
    
    res.json({
      success: true,
      data: userResponse,
      message: 'User updated successfully',
    });
  } catch (error) {
    console.error('Error updating user:', error);
    
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Email already registered',
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to update user',
      error: error.message,
    });
  }
};

/**
 * DELETE /api/users/:id
 * Delete user (admin only)
 */
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID',
      });
    }
    
    const user = await User.findById(id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }
    
    // Prevent deleting admin users
    if (user.role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Cannot delete admin users',
      });
    }
    
    await User.findByIdAndDelete(id);
    
    res.json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete user',
      error: error.message,
    });
  }
};

/**
 * PATCH /api/users/:id/status
 * Toggle user active status (admin only)
 */
export const toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID',
      });
    }
    
    const user = await User.findById(id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }
    
    // Prevent deactivating admin users
    if (user.role === 'admin' && !user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Cannot deactivate admin users',
      });
    }
    
    user.isActive = !user.isActive;
    await user.save();
    
    // Populate franchise for response
    await user.populate('franchise', 'name code');
    
    // Remove password from response
    const userResponse = user.toObject();
    delete userResponse.password;
    
    res.json({
      success: true,
      data: userResponse,
      message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully`,
    });
  } catch (error) {
    console.error('Error toggling user status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user status',
      error: error.message,
    });
  }
};
