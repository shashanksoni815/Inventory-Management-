/**
 * Franchise Access Control Middleware
 * 
 * Role-Based Access Control:
 * - Admin/SuperAdmin: Can access all franchises
 * - Franchise Manager: Can access their assigned franchise(s) only
 * - Staff: Can access their assigned franchise(s) only (read-only elsewhere)
 * 
 * Usage:
 * - Use checkFranchiseAccess(req, res, next) to validate franchise access
 * - Use requireFranchiseAccess(franchiseId) to create a middleware that checks specific franchise
 */

import mongoose from 'mongoose';

/**
 * Check if user has access to a specific franchise
 * @param {Object} user - User object from req.user
 * @param {String|ObjectId} franchiseId - Franchise ID to check access for
 * @returns {Boolean} - True if user has access, false otherwise
 */
export const hasFranchiseAccess = (user, franchiseId) => {
  if (!user) return false;
  
  // Admin and SuperAdmin can access all franchises
  if (user.role === 'admin' || user.role === 'superAdmin') {
    return true;
  }
  
  // Manager and Sales: single franchise (user.franchise)
  if (user.role === 'manager' || user.role === 'sales') {
    const userFranchiseId = user.franchise?._id?.toString() || user.franchise?.toString();
    if (!userFranchiseId) return false;
    return userFranchiseId === String(franchiseId);
  }
  
  // Legacy: Franchise managers and staff can only access their assigned franchises
  if (user.role === 'franchise_manager' || user.role === 'staff') {
    if (!user.franchises || !Array.isArray(user.franchises) || user.franchises.length === 0) {
      return false;
    }
    const franchiseIdStr = franchiseId?.toString();
    return user.franchises.some(f => f?.toString() === franchiseIdStr);
  }
  
  // Unknown role - deny access
  return false;
};

/**
 * Middleware to check franchise access from query parameter or body
 * Checks req.query.franchise or req.body.franchise or req.params.franchiseId
 */
export const checkFranchiseAccess = (req, res, next) => {
  const user = req.user;
  
  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
  }
  
  // Admin/SuperAdmin can access all franchises
  if (user.role === 'admin' || user.role === 'superAdmin') {
    return next();
  }
  
  // Manager and Sales: single franchise access
  if (user.role === 'manager' || user.role === 'sales') {
    const franchiseId = req.query.franchise || req.body.franchise || req.params.franchiseId || req.params.franchise;
    if (!franchiseId) {
      if (!user.franchise) {
        return res.status(403).json({ success: false, message: 'Access denied: No franchise assigned' });
      }
      return next();
    }
    const userFranchiseId = user.franchise?._id?.toString() || user.franchise?.toString();
    if (!userFranchiseId || userFranchiseId !== String(franchiseId)) {
      return res.status(403).json({ success: false, message: 'Access denied: You do not have access to this franchise' });
    }
    return next();
  }
  
  // Franchise managers and staff need franchise access check
  if (user.role === 'franchise_manager' || user.role === 'staff') {
    // Get franchise ID from query, body, or params
    const franchiseId = req.query.franchise || 
                       req.body.franchise || 
                       req.params.franchiseId ||
                       req.params.franchise;
    
    // If no franchise specified, check if user has any franchises assigned
    if (!franchiseId) {
      if (!user.franchises || !Array.isArray(user.franchises) || user.franchises.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: No franchises assigned to your account',
        });
      }
      // User has franchises, allow access (will be filtered by their franchises)
      return next();
    }
    
    // Check if user has access to the specified franchise
    if (!hasFranchiseAccess(user, franchiseId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You do not have access to this franchise',
      });
    }
  }
  
  // Unknown role - deny access
  if (!['admin', 'superAdmin', 'manager', 'sales', 'franchise_manager', 'staff'].includes(user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied: Invalid user role',
    });
  }
  
  next();
};

/**
 * Create middleware to require access to a specific franchise
 * @param {String} franchiseParamName - Name of parameter containing franchise ID (default: 'franchiseId')
 */
export const requireFranchiseAccess = (franchiseParamName = 'franchiseId') => {
  return (req, res, next) => {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }
    
  // Admin/SuperAdmin can access all franchises
  if (user.role === 'admin' || user.role === 'superAdmin') {
    return next();
  }
  
  // Manager and Sales: single franchise
  if (user.role === 'manager' || user.role === 'sales') {
    const franchiseId = req.params[franchiseParamName] || req.query[franchiseParamName] || req.body[franchiseParamName];
    if (!franchiseId) {
      return res.status(400).json({ success: false, message: 'Franchise ID is required' });
    }
    if (!hasFranchiseAccess(user, franchiseId)) {
      return res.status(403).json({ success: false, message: 'Access denied: You do not have access to this franchise' });
    }
    return next();
  }
  
  // Franchise managers and staff
  if (user.role === 'franchise_manager' || user.role === 'staff') {
    const franchiseId = req.params[franchiseParamName] || req.query[franchiseParamName] || req.body[franchiseParamName];
    if (!franchiseId) {
      return res.status(400).json({ success: false, message: 'Franchise ID is required' });
    }
    if (!hasFranchiseAccess(user, franchiseId)) {
      return res.status(403).json({ success: false, message: 'Access denied: You do not have access to this franchise' });
    }
    return next();
  }
    
  return res.status(403).json({ success: false, message: 'Access denied: Invalid user role' });
  };
};

/**
 * Helper function to filter franchises based on user role
 * Used in queries to automatically filter by user's franchises
 * @param {Object} user - User object
 * @returns {Object} - MongoDB query filter for franchises
 */
export const getFranchiseFilter = (user) => {
  if (!user) {
    return { _id: { $exists: false } }; // Return empty result for no user
  }
  
  // Admin/SuperAdmin can see all franchises
  if (user.role === 'admin' || user.role === 'superAdmin') {
    return {}; // No filter - show all
  }
  
  // Manager and Sales: single franchise
  if (user.role === 'manager' || user.role === 'sales') {
    const raw = user.franchise;
    const userFranchiseId = raw?._id?.toString() || (typeof raw === 'object' && raw?.toString ? raw.toString() : raw);
    if (!userFranchiseId || !mongoose.Types.ObjectId.isValid(userFranchiseId)) {
      return { _id: { $exists: false } };
    }
    return { _id: new mongoose.Types.ObjectId(userFranchiseId) };
  }
  
  // Franchise managers and staff can only see their assigned franchises
  if (user.role === 'franchise_manager' || user.role === 'staff') {
    if (!user.franchises || !Array.isArray(user.franchises) || user.franchises.length === 0) {
      return { _id: { $exists: false } }; // No franchises assigned - return empty
    }
    
    return { _id: { $in: user.franchises } };
  }
  
  // Unknown role - return empty
  return { _id: { $exists: false } };
};
