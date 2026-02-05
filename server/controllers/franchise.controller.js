// controllers/franchise.controller.js
import Franchise from '../models/Franchise.js';
import Product from '../models/Product.js';
import Sale from '../models/Sale.js';

// Get all franchises accessible to user
export const getFranchises = async (req, res) => {
  try {
    const { user } = req;
    
    let query = {};
    
    // Non-admin users can only see their assigned franchises
    if (user.role !== 'admin') {
      query._id = { $in: user.franchises };
    }
    
    const franchises = await Franchise.find(query)
      .sort({ name: 1 })
      .lean();
    
    res.json({
      success: true,
      data: franchises
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching franchises',
      error: error.message
    });
  }
};

// Get single franchise with stats
export const getFranchise = async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req;
    
    // Check access
    if (user.role !== 'admin' && !user.franchises.includes(id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this franchise'
      });
    }
    
    const franchise = await Franchise.findById(id).lean();
    
    if (!franchise) {
      return res.status(404).json({
        success: false,
        message: 'Franchise not found'
      });
    }
    
    // Get franchise statistics
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const stats = await Promise.all([
      // Total products count
      Product.countDocuments({ franchise: id }),
      
      // Low stock products (below reorder point)
      Product.countDocuments({ 
        franchise: id, 
        quantity: { $lt: '$reorderPoint' }
      }),
      
      // Today's sales count
      Sale.countDocuments({ 
        franchise: id, 
        createdAt: { $gte: today },
        status: 'completed'
      }),
      
      // Today's revenue
      Sale.aggregate([
        {
          $match: {
            franchise: id,
            createdAt: { $gte: today },
            status: 'completed'
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$total' }
          }
        }
      ]),
      
      // Total inventory value
      Product.aggregate([
        {
          $match: { franchise: id }
        },
        {
          $project: {
            value: { $multiply: ['$quantity', '$cost'] }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$value' }
          }
        }
      ])
    ]);
    
    const franchiseWithStats = {
      ...franchise,
      stats: {
        totalProducts: stats[0],
        lowStockProducts: stats[1],
        todaySales: stats[2],
        todayRevenue: stats[3][0]?.total || 0,
        inventoryValue: stats[4][0]?.total || 0
      }
    };
    
    res.json({
      success: true,
      data: franchiseWithStats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching franchise',
      error: error.message
    });
  }
};

// Create new franchise (admin only)
export const createFranchise = async (req, res) => {
  try {
    const { user } = req;
    
    if (user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }
    
    const franchiseData = req.body;
    
    // Generate code if not provided
    if (!franchiseData.code) {
      const count = await Franchise.countDocuments();
      franchiseData.code = `FR-${String(count + 1).padStart(3, '0')}`;
    }
    
    const franchise = new Franchise(franchiseData);
    await franchise.save();
    
    res.status(201).json({
      success: true,
      data: franchise
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error creating franchise',
      error: error.message
    });
  }
};

// Update franchise
export const updateFranchise = async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req;
    
    // Check access
    if (user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }
    
    const franchise = await Franchise.findByIdAndUpdate(
      id,
      { ...req.body, updatedAt: Date.now() },
      { new: true, runValidators: true }
    );
    
    if (!franchise) {
      return res.status(404).json({
        success: false,
        message: 'Franchise not found'
      });
    }
    
    res.json({
      success: true,
      data: franchise
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error updating franchise',
      error: error.message
    });
  }
};

// Get consolidated network stats (admin only)
export const getNetworkStats = async (req, res) => {
  try {
    const { user } = req;
    
    if (user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }
    
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    
    const [
      franchiseCount,
      activeFranchises,
      totalRevenueToday,
      totalRevenueWeek,
      totalRevenueMonth,
      topProducts,
      franchisePerformance
    ] = await Promise.all([
      Franchise.countDocuments(),
      Franchise.countDocuments({ status: 'active' }),
      
      // Today's revenue across all franchises
      Sale.aggregate([
        {
          $match: {
            createdAt: { $gte: today },
            status: 'completed'
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$total' }
          }
        }
      ]),
      
      // Weekly revenue
      Sale.aggregate([
        {
          $match: {
            createdAt: { $gte: weekAgo },
            status: 'completed'
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$total' }
          }
        }
      ]),
      
      // Monthly revenue
      Sale.aggregate([
        {
          $match: {
            createdAt: { $gte: monthAgo },
            status: 'completed'
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$total' }
          }
        }
      ]),
      
      // Top selling products across franchises
      Sale.aggregate([
        {
          $match: {
            status: 'completed',
            createdAt: { $gte: monthAgo }
          }
        },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.product',
            totalSold: { $sum: '$items.quantity' },
            totalRevenue: { $sum: '$items.total' }
          }
        },
        { $sort: { totalSold: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: 'products',
            localField: '_id',
            foreignField: '_id',
            as: 'product'
          }
        },
        { $unwind: '$product' }
      ]),
      
      // Franchise performance ranking
      Sale.aggregate([
        {
          $match: {
            status: 'completed',
            createdAt: { $gte: monthAgo }
          }
        },
        {
          $group: {
            _id: '$franchise',
            totalRevenue: { $sum: '$total' },
            salesCount: { $sum: 1 }
          }
        },
        { $sort: { totalRevenue: -1 } },
        {
          $lookup: {
            from: 'franchises',
            localField: '_id',
            foreignField: '_id',
            as: 'franchise'
          }
        },
        { $unwind: '$franchise' }
      ])
    ]);
    
    res.json({
      success: true,
      data: {
        franchiseCount,
        activeFranchises,
        todayRevenue: totalRevenueToday[0]?.total || 0,
        weekRevenue: totalRevenueWeek[0]?.total || 0,
        monthRevenue: totalRevenueMonth[0]?.total || 0,
        topProducts: topProducts,
        franchisePerformance: franchisePerformance
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching network stats',
      error: error.message
    });
  }
};
