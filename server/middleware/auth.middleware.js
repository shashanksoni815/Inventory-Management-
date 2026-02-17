import jwt from 'jsonwebtoken';
import { User } from '../models/User.model.js';

const getJwtSecret = () => process.env.JWT_SECRET || 'your-secret-key';

/**
 * Protect middleware - Verifies JWT token and attaches user to request
 * Reads token from Authorization header, verifies JWT, and attaches decoded data to req.user
 */
export const protect = async (req, res, next) => {
  try {
    // Read token from Authorization header
    const authHeader = req.header('Authorization');
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'No authentication token provided',
      });
    }

    // Extract token (format: "Bearer <token>")
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No authentication token provided',
      });
    }

    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, getJwtSecret());
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token has expired',
        });
      }
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: 'Invalid token',
        });
      }
      throw error;
    }

    // Find user by ID from decoded token (JWT contains 'id' field)
    const userId = decoded.id || decoded.userId; // Support both 'id' and 'userId' for backward compatibility
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token payload',
      });
    }

    const user = await User.findById(userId)
      .select('-password')
      .populate('franchise', 'name code');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found',
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated',
      });
    }

    // Verify token role matches user role (in case role was changed)
    if (decoded.role && decoded.role !== user.role) {
      return res.status(401).json({
        success: false,
        message: 'Token role mismatch',
      });
    }

    // Attach decoded data and user to request
    req.user = user;
    req.token = token;
    req.decoded = {
      id: decoded.id || decoded.userId,
      role: decoded.role || user.role,
      franchise: decoded.franchise || (user.franchise ? user.franchise._id.toString() : null),
    };

    // Update last login (non-blocking)
    if (user.lastLogin) {
      const hoursSinceLastLogin = (Date.now() - user.lastLogin.getTime()) / (1000 * 60 * 60);
      // Only update if last login was more than 1 hour ago (to avoid excessive DB writes)
      if (hoursSinceLastLogin >= 1) {
        user.lastLogin = new Date();
        user.save().catch(() => {}); // Don't block request if save fails
      }
    } else {
      user.lastLogin = new Date();
      user.save().catch(() => {}); // Don't block request if save fails
    }

    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Authentication failed',
      error: error.message,
    });
  }
};

/**
 * Authorize middleware - Checks if user role is allowed
 * Accepts roles array and checks if req.user.role is in the allowed roles
 * Returns 403 if not allowed
 */
export const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    // Ensure protect middleware was called first
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Check if user role is in allowed roles
    const userRole = req.user.role;
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required roles: ${allowedRoles.join(', ')}`,
      });
    }

    next();
  };
};

/**
 * Backward compatibility: export authMiddleware as alias for protect
 */
export const authMiddleware = protect;