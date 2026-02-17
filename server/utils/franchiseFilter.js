import mongoose from 'mongoose';

/**
 * Build franchise filter for data isolation
 * Admin: sees all data (no filter)
 * Manager & Sales: only see their franchise data
 * 
 * @param {Object} req - Express request object with req.user
 * @param {Object} options - Options object
 * @param {boolean} options.includeGlobal - For products, include global products (isGlobal: true)
 * @returns {Object} MongoDB query filter object
 */
export const buildFranchiseFilter = (req, options = {}) => {
  const user = req.user;
  const { includeGlobal = false } = options;
  
  // Admin sees all data - no filter
  if (user && user.role === 'admin') {
    return {};
  }
  
  // Manager and Sales only see their franchise data
  if (user && (user.role === 'manager' || user.role === 'sales')) {
    // user.franchise can be ObjectId or populated { _id, name, code }
    const raw = user.franchise;
    const userFranchiseId = raw?._id?.toString() || (typeof raw === 'string' ? raw : raw?.toString?.());
    
    if (!userFranchiseId || !mongoose.Types.ObjectId.isValid(userFranchiseId)) {
      if (includeGlobal) {
        return { isGlobal: true };
      }
      return { _id: { $exists: false } };
    }
    
    const franchiseId = new mongoose.Types.ObjectId(userFranchiseId);
    
    // If including global products, use $or to include both franchise and global products
    if (includeGlobal) {
      return {
        $or: [
          { franchise: franchiseId },
          { isGlobal: true }
        ]
      };
    }
    
    return { franchise: franchiseId };
  }
  
  // Default: no access (empty result)
  return { _id: { $exists: false } };
};

/**
 * Merge franchise filter with existing query
 * 
 * @param {Object} req - Express request object with req.user
 * @param {Object} baseQuery - Existing query object
 * @param {Object} options - Options object (passed to buildFranchiseFilter)
 * @returns {Object} Merged query object
 */
export const applyFranchiseFilter = (req, baseQuery = {}, options = {}) => {
  const franchiseFilter = buildFranchiseFilter(req, options);
  
  // If admin (no filter), return base query as-is
  if (Object.keys(franchiseFilter).length === 0) {
    return baseQuery;
  }
  
  // If franchise filter uses $or (for global products), we need to merge carefully
  if (franchiseFilter.$or) {
    // If baseQuery also has $or, we need to combine them
    if (baseQuery.$or) {
      return {
        ...baseQuery,
        $and: [
          { $or: baseQuery.$or },
          { $or: franchiseFilter.$or }
        ]
      };
    }
    // Otherwise, merge the $or with other baseQuery conditions
    return {
      ...baseQuery,
      $or: franchiseFilter.$or
    };
  }
  
  // If franchise filter exists, merge it with base query
  return {
    ...baseQuery,
    ...franchiseFilter,
  };
};
