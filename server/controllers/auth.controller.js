import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { User } from '../models/User.model.js';
import Franchise from '../models/Franchise.js';
import bcrypt from 'bcryptjs';

const getJwtSecret = () => process.env.JWT_SECRET || 'your-secret-key';

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    // Find user by email (email is stored lowercase per schema)
    const user = await User.findOne({ email: String(email).trim().toLowerCase() }).populate('franchise', 'name code');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Check password
    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated',
      });
    }

    // Generate JWT token containing id, role, and franchise
    const tokenPayload = {
      id: user._id.toString(),
      role: user.role,
    };
    
    // Include franchise in JWT if user has one (manager/sales)
    if (user.franchise) {
      tokenPayload.franchise = user.franchise._id.toString();
    }

    const token = jwt.sign(
      tokenPayload,
      getJwtSecret(),
      { expiresIn: '1d' } // JWT expires in 1 day
    );

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    res.status(200).json({
      success: true,
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          franchise: user.franchise ? {
            id: user.franchise._id,
            name: user.franchise.name,
            code: user.franchise.code,
          } : null,
          settings: user.settings,
        },
      },
      message: 'Login successful',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: error.message,
    });
  }
};

export const register = async (req, res) => {
  try {
    // Registration request received
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
    const validRoles = ['admin', 'manager', 'sales'];
    const userRole = role || 'admin'; // Default to admin if not provided
    if (!validRoles.includes(userRole)) {
      return res.status(400).json({
        success: false,
        message: `Role must be one of: ${validRoles.join(', ')}`,
      });
    }

    // Validate franchise requirement for manager and sales
    // Check for both undefined/null and empty string
    const hasFranchise = franchise && String(franchise).trim() !== '';
    if ((userRole === 'manager' || userRole === 'sales') && !hasFranchise) {
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

    // Create user data object
    const userData = {
      name: name.trim(),
      email: normalizedEmail,
      password, // Will be hashed by pre-save hook
      role: userRole,
      isActive: true,
      settings: {
        theme: 'light',
        currency: 'INR',
        taxRate: 10,
        lowStockThreshold: 10,
        refreshInterval: 30,
      },
    };

    // Validate franchise assignment: admin should NOT have franchise
    const adminHasFranchise = franchise && String(franchise).trim() !== '';
    if (userRole === 'admin' && adminHasFranchise) {
      return res.status(400).json({
        success: false,
        message: 'Admin role cannot be assigned to a franchise',
      });
    }

    // Add franchise if provided (for manager/sales)
    if (hasFranchise && (userRole === 'manager' || userRole === 'sales')) {
      const franchiseId = String(franchise).trim();
      
      // Validate franchise ID format
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
      
      userData.franchise = franchiseId;
    }

    // Create user (password will be hashed by pre-save hook)
    const user = await User.create(userData);
    
    // Populate franchise for response
    await user.populate('franchise', 'name code');

    // Generate JWT token containing id, role, and franchise
    const tokenPayload = {
      id: user._id.toString(),
      role: user.role,
    };
    
    // Include franchise in JWT if user has one (manager/sales)
    if (user.franchise) {
      tokenPayload.franchise = user.franchise._id.toString();
    }

    const token = jwt.sign(
      tokenPayload,
      getJwtSecret(),
      { expiresIn: '1d' } // JWT expires in 1 day
    );

    // Registration successful
    
    res.status(201).json({
      success: true,
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          franchise: user.franchise ? {
            id: user.franchise._id,
            name: user.franchise.name,
            code: user.franchise.code,
          } : null,
          settings: user.settings || {},
        },
      },
      message: 'Registration successful',
    });
  } catch (error) {
    console.error('Registration error:', error);
    // Mongoose duplicate key (email already exists)
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Email already registered',
      });
    }
    // Mongoose validation error
    if (error.name === 'ValidationError' && error.errors) {
      const firstError = Object.values(error.errors)[0];
      const message = firstError?.message || 'Validation failed';
      return res.status(400).json({
        success: false,
        message,
        error: error.errors,
      });
    }
    res.status(500).json({
      success: false,
      message: error.message || 'Registration failed',
      error: error.message,
    });
  }
};

export const logout = async (req, res) => {
  try {
    // In a real app, you might want to blacklist the token
    // For now, we'll just return success
    res.status(200).json({
      success: true,
      message: 'Logout successful',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Logout failed',
      error: error.message,
    });
  }
};

export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password')
      .populate('franchise', 'name code');
    
    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile',
      error: error.message,
    });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { name, email, settings } = req.body;
    
    const updateData = {};
    if (name) updateData.name = name.trim();
    if (email) updateData.email = String(email).trim().toLowerCase();
    if (settings) updateData.settings = settings;
    
    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password').populate('franchise', 'name code');
    
    res.status(200).json({
      success: true,
      data: user,
      message: 'Profile updated successfully',
    });
  } catch (error) {
    // Mongoose duplicate key (email already exists)
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Email already registered',
      });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to update profile',
      error: error.message,
    });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    // Get user with password
    const user = await User.findById(req.user._id);
    
    // Verify current password
    const isValid = await user.comparePassword(currentPassword);
    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect',
      });
    }
    
    // Update password
    user.password = newPassword;
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to change password',
      error: error.message,
    });
  }
};