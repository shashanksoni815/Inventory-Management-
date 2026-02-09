import jwt from 'jsonwebtoken';
import { User } from '../models/User.model.js';
import bcrypt from 'bcryptjs';

const getJwtSecret = () => process.env.JWT_SECRET || 'your-secret-key';

export const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required',
      });
    }

    // Find user (username is stored lowercase per schema)
    const user = await User.findOne({ username: String(username).trim().toLowerCase() });
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

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      getJwtSecret(),
      { expiresIn: '7d' }
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
          username: user.username,
          role: user.role,
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
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required',
      });
    }
    const normalizedUsername = String(username).trim().toLowerCase();
    if (normalizedUsername.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Username must be at least 2 characters',
      });
    }
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters',
      });
    }

    const existing = await User.findOne({ username: normalizedUsername });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Username already taken',
      });
    }

    const user = await User.create({
      username: normalizedUsername,
      password,
      role: 'admin',
      isActive: true,
      settings: {
        theme: 'light',
        currency: 'USD',
        taxRate: 10,
        lowStockThreshold: 10,
        refreshInterval: 30,
      },
    });

    const token = jwt.sign(
      { userId: user._id, role: user.role },
      getJwtSecret(),
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      data: {
        token,
        user: {
          id: user._id,
          username: user.username,
          role: user.role,
          settings: user.settings || {},
        },
      },
      message: 'Registration successful',
    });
  } catch (error) {
    // Mongoose duplicate key (username already exists)
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Username already taken',
      });
    }
    // Mongoose validation error
    if (error.name === 'ValidationError' && error.errors) {
      const firstError = Object.values(error.errors)[0];
      const message = firstError?.message || 'Validation failed';
      return res.status(400).json({
        success: false,
        message,
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
    const user = await User.findById(req.user._id).select('-password');
    
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
    const { username, settings } = req.body;
    
    const updateData = {};
    if (username) updateData.username = username;
    if (settings) updateData.settings = settings;
    
    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');
    
    res.status(200).json({
      success: true,
      data: user,
      message: 'Profile updated successfully',
    });
  } catch (error) {
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