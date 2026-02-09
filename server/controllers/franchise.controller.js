// controllers/franchise.controller.js
import mongoose from 'mongoose';
import Franchise from '../models/Franchise.js';
import { Product } from '../models/Product.model.js';
import { Sale } from '../models/Sale.model.js';
import Transfer from '../models/Transfer.js';

/** Validate MongoDB ObjectId format (24 hex chars). Reject franchise code or numeric IDs. */
function isValidObjectId(id) {
  return typeof id === 'string' && /^[a-f0-9]{24}$/i.test(id);
}

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

// Get single franchise with stats.
// Resolves by MongoDB _id only (req.params.id). Do NOT query by franchise code or convert id to number.
export const getFranchise = async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req;

    // Validation: require MongoDB ObjectId so Network shows /api/franchises/65c9a8e2f... not /api/franchises/789456
    if (!id || !isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid franchise ID. Use MongoDB _id (e.g. 65c9a8e2f...), not franchise code (e.g. 789456).',
      });
    }

    // Resolve by MongoDB _id only — no code lookup, no number conversion
    const franchise = await Franchise.findById(id).lean();

    if (!franchise) {
      return res.status(404).json({
        success: false,
        message: 'Franchise not found'
      });
    }

    // Check access (after load so we can distinguish 404 from 403 if desired)
    if (user.role !== 'admin' && !user.franchises.some((f) => String(f) === String(id))) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this franchise'
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
        $expr: {
          $lt: [
            '$stockQuantity',
            { $ifNull: ['$replenishmentSettings.reorderPoint', '$minimumStock'] }
          ]
        }
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
            total: { $sum: '$grandTotal' }
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

    // Return standard shape: { success: true, data: franchise }
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
            total: { $sum: '$grandTotal' }
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
            total: { $sum: '$grandTotal' }
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
            total: { $sum: '$grandTotal' }
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
            totalRevenue: { $sum: '$grandTotal' }
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
            totalRevenue: { $sum: '$grandTotal' },
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

/**
 * Get global KPIs for Admin Master Dashboard (admin/superAdmin only).
 * Query: timeRange = 7d | 30d | 90d | 1y
 */
export const getAdminKpis = async (req, res) => {
  try {
    const { user } = req;
    if (user.role !== 'admin' && user.role !== 'superAdmin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { timeRange = '30d' } = req.query;
    const now = new Date();
    const endDate = new Date(now);
    let startDate = new Date(now);
    switch (timeRange) {
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        startDate.setDate(startDate.getDate() - 30);
    }

    // Use indexed fields: createdAt (indexed), status (indexed), transferDate (indexed)
    const [
      salesKpis,
      inventoryResult,
      transferCounts
    ] = await Promise.all([
      Sale.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate, $lte: endDate },
            status: 'completed'
          }
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$grandTotal' },
            totalProfit: { $sum: '$totalProfit' },
            totalSales: { $sum: 1 },
            avgOrderValue: { $avg: '$grandTotal' },
            franchiseIds: { $addToSet: '$franchise' }
          }
        },
        {
          $project: {
            _id: 0,
            totalRevenue: 1,
            totalProfit: 1,
            totalSales: 1,
            avgOrderValue: {
              $cond: [{ $gt: ['$totalSales', 0] }, '$avgOrderValue', 0]
            },
            activeFranchises: { $size: '$franchiseIds' }
          }
        }
      ]),
      Product.aggregate([
        { $match: {} },
        {
          $group: {
            _id: null,
            inventoryValue: { $sum: { $multiply: ['$stockQuantity', '$buyingPrice'] } }
          }
        },
        { $project: { _id: 0, inventoryValue: 1 } }
      ]),
      Transfer.aggregate([
        {
          $match: {
            transferDate: { $gte: startDate, $lte: endDate },
            status: 'completed'
          }
        },
        {
          $group: {
            _id: null,
            totalImports: { $sum: 1 },
            totalExports: { $sum: 1 }
          }
        },
        { $project: { _id: 0, totalImports: 1, totalExports: 1 } }
      ])
    ]);

    const sales = salesKpis[0] || {
      totalRevenue: 0,
      totalProfit: 0,
      totalSales: 0,
      avgOrderValue: 0,
      activeFranchises: 0
    };
    const inventory = inventoryResult[0] || { inventoryValue: 0 };
    const transfers = transferCounts[0] || { totalImports: 0, totalExports: 0 };

    res.status(200).json({
      success: true,
      data: {
        totalRevenue: sales.totalRevenue,
        totalProfit: sales.totalProfit,
        totalSales: sales.totalSales,
        activeFranchises: sales.activeFranchises,
        avgOrderValue: sales.avgOrderValue,
        inventoryValue: inventory.inventoryValue,
        totalImports: transfers.totalImports,
        totalExports: transfers.totalExports
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch admin KPIs',
      error: error.message
    });
  }
};

/**
 * Get global chart data for Admin Master Dashboard (admin/superAdmin only).
 * Query: timeRange = 7d | 30d | 90d | 1y
 * Returns: revenueProfitTrend, profitByFranchise, profitByCategory
 */
export const getAdminCharts = async (req, res) => {
  try {
    const { user } = req;
    if (user.role !== 'admin' && user.role !== 'superAdmin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { timeRange = '30d' } = req.query;
    const now = new Date();
    const endDate = new Date(now);
    let startDate = new Date(now);
    switch (timeRange) {
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        startDate.setDate(startDate.getDate() - 30);
    }

    const dateMatch = {
      createdAt: { $gte: startDate, $lte: endDate },
      status: 'completed'
    };
    const dateFormat = timeRange === '1y' ? '%Y-%m' : '%Y-%m-%d';

    // Use $facet to combine multiple aggregations in a single pipeline (indexed: createdAt, status, franchise)
    const [chartsResult] = await Sale.aggregate([
      { $match: dateMatch },
      {
        $facet: {
          revenueProfitTrend: [
            { $unwind: '$items' },
            {
              $group: {
                _id: { $dateToString: { format: dateFormat, date: '$createdAt' } },
                revenue: {
                  $sum: { $multiply: [{ $ifNull: ['$items.sellingPrice', 0] }, { $ifNull: ['$items.quantity', 0] }] }
                },
                cost: {
                  $sum: { $multiply: [{ $ifNull: ['$items.buyingPrice', 0] }, { $ifNull: ['$items.quantity', 0] }] }
                },
                profit: { $sum: { $ifNull: ['$items.profit', 0] } }
              }
            },
            { $sort: { _id: 1 } },
            { $project: { period: '$_id', revenue: 1, cost: 1, profit: 1, _id: 0 } }
          ],
          profitByFranchise: [
            {
              $group: {
                _id: '$franchise',
                profit: { $sum: '$totalProfit' }
              }
            },
            { $sort: { profit: -1 } },
            {
              $lookup: {
                from: 'franchises',
                localField: '_id',
                foreignField: '_id',
                as: 'franchiseDoc'
              }
            },
            { $unwind: '$franchiseDoc' },
            { $project: { franchiseName: '$franchiseDoc.name', profit: 1, _id: 0 } }
          ],
          profitByCategory: [
            { $unwind: '$items' },
            {
              $lookup: {
                from: 'products',
                localField: 'items.product',
                foreignField: '_id',
                as: 'productDoc'
              }
            },
            { $unwind: { path: '$productDoc', preserveNullAndEmptyArrays: true } },
            {
              $group: {
                _id: { $ifNull: ['$productDoc.category', 'Uncategorized'] },
                revenue: {
                  $sum: { $multiply: [{ $ifNull: ['$items.sellingPrice', 0] }, { $ifNull: ['$items.quantity', 0] }] }
                },
                cost: {
                  $sum: { $multiply: [{ $ifNull: ['$items.buyingPrice', 0] }, { $ifNull: ['$items.quantity', 0] }] }
                },
                profit: { $sum: { $ifNull: ['$items.profit', 0] } }
              }
            },
            { $sort: { profit: -1 } },
            { $project: { category: '$_id', revenue: 1, cost: 1, profit: 1, _id: 0 } }
          ]
        }
      }
    ]);

    const { revenueProfitTrend = [], profitByFranchise = [], profitByCategory = [] } = chartsResult || {};

    res.status(200).json({
      success: true,
      data: {
        revenueProfitTrend,
        profitByFranchise,
        profitByCategory
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch admin charts',
      error: error.message
    });
  }
};

/**
 * Get franchise performance table for Admin Master Dashboard (admin/superAdmin only).
 * Query: timeRange = 7d | 30d | 90d | 1y
 * Returns: array of { franchiseId, franchiseName, revenue, profit, sales, stockValue }
 */
export const getAdminFranchisePerformance = async (req, res) => {
  try {
    const { user } = req;
    if (user.role !== 'admin' && user.role !== 'superAdmin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { timeRange = '30d' } = req.query;
    const now = new Date();
    const endDate = new Date(now);
    let startDate = new Date(now);
    switch (timeRange) {
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        startDate.setDate(startDate.getDate() - 30);
    }

    const dateMatch = {
      createdAt: { $gte: startDate, $lte: endDate },
      status: 'completed'
    };

    // Use $lookup instead of JS Map operations - single aggregation pipeline (indexed: createdAt, status, franchise)
    const performance = await Franchise.aggregate([
      {
        $lookup: {
          from: 'sales',
          let: { franchiseId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$franchise', '$$franchiseId'] },
                    { $gte: ['$createdAt', startDate] },
                    { $lte: ['$createdAt', endDate] },
                    { $eq: ['$status', 'completed'] }
                  ]
                }
              }
            },
            {
              $group: {
                _id: null,
                revenue: { $sum: '$grandTotal' },
                profit: { $sum: '$totalProfit' },
                sales: { $sum: 1 }
              }
            }
          ],
          as: 'salesData'
        }
      },
      {
        $lookup: {
          from: 'products',
          let: { franchiseId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$franchise', '$$franchiseId'] }
              }
            },
            {
              $group: {
                _id: null,
                stockValue: { $sum: { $multiply: ['$stockQuantity', '$buyingPrice'] } }
              }
            }
          ],
          as: 'stockData'
        }
      },
      {
        $project: {
          franchiseId: { $toString: '$_id' },
          franchiseName: { $ifNull: ['$name', 'Unknown'] },
          revenue: { $ifNull: [{ $arrayElemAt: ['$salesData.revenue', 0] }, 0] },
          profit: { $ifNull: [{ $arrayElemAt: ['$salesData.profit', 0] }, 0] },
          sales: { $ifNull: [{ $arrayElemAt: ['$salesData.sales', 0] }, 0] },
          stockValue: { $ifNull: [{ $arrayElemAt: ['$stockData.stockValue', 0] }, 0] }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: performance
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch franchise performance',
      error: error.message
    });
  }
};

/**
 * Get auto-generated alerts & insights for Admin Dashboard (admin/superAdmin only).
 * Query: timeRange = 7d | 30d | 90d | 1y
 * Returns: lossMakingFranchises, lowMarginCategories, highDeadStockOutlets, suddenRevenueDrops
 */
export const getAdminInsights = async (req, res) => {
  try {
    const { user } = req;
    if (user.role !== 'admin' && user.role !== 'superAdmin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { timeRange = '30d' } = req.query;
    const now = new Date();
    const endDate = new Date(now);
    let startDate = new Date(now);
    switch (timeRange) {
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        startDate.setDate(startDate.getDate() - 30);
    }

    const dateMatch = {
      createdAt: { $gte: startDate, $lte: endDate },
      status: 'completed'
    };

    const ninetyDaysAgo = new Date(now);
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const currentWeekStart = new Date(now);
    currentWeekStart.setDate(currentWeekStart.getDate() - 7);
    const previousWeekStart = new Date(currentWeekStart);
    previousWeekStart.setDate(previousWeekStart.getDate() - 7);

    // Use $facet to combine Sale aggregations (indexed: createdAt, status, franchise)
    const [insightsResult, deadStockByFranchise, suddenRevenueDrops] = await Promise.all([
      Sale.aggregate([
        { $match: dateMatch },
        {
          $facet: {
            lossMaking: [
              { $group: { _id: '$franchise', revenue: { $sum: '$grandTotal' }, profit: { $sum: '$totalProfit' }, sales: { $sum: 1 } } },
              { $match: { profit: { $lt: 0 } } },
              { $lookup: { from: 'franchises', localField: '_id', foreignField: '_id', as: 'f' } },
              { $unwind: '$f' },
              { $project: { franchiseId: { $toString: '$_id' }, franchiseName: '$f.name', revenue: 1, profit: 1, sales: 1, _id: 0 } }
            ],
            lowMarginCategories: [
              { $unwind: '$items' },
              { $lookup: { from: 'products', localField: 'items.product', foreignField: '_id', as: 'p' } },
              { $unwind: { path: '$p', preserveNullAndEmptyArrays: true } },
              {
                $group: {
                  _id: { $ifNull: ['$p.category', 'Uncategorized'] },
                  revenue: { $sum: { $multiply: [{ $ifNull: ['$items.sellingPrice', 0] }, { $ifNull: ['$items.quantity', 0] }] } },
                  profit: { $sum: { $ifNull: ['$items.profit', 0] } }
                }
              },
              { $match: { revenue: { $gt: 0 } } },
              {
                $addFields: {
                  marginPercent: { $multiply: [{ $divide: ['$profit', '$revenue'] }, 100] }
                }
              },
              { $match: { marginPercent: { $lt: 10 } } },
              { $sort: { marginPercent: 1 } },
              { $project: { category: '$_id', revenue: 1, profit: 1, marginPercent: 1, _id: 0 } }
            ]
          }
        }
      ]),
      // Dead stock (indexed: franchise)
      Product.aggregate([
        { $match: {} },
        {
          $addFields: {
            isDead: {
              $or: [
                { $eq: ['$lastSold', null] },
                { $lt: ['$lastSold', ninetyDaysAgo] }
              ]
            }
          }
        },
        {
          $group: {
            _id: '$franchise',
            totalValue: { $sum: { $multiply: ['$stockQuantity', '$buyingPrice'] } },
            deadStockValue: {
              $sum: {
                $cond: [
                  '$isDead',
                  { $multiply: ['$stockQuantity', '$buyingPrice'] },
                  0
                ]
              }
            }
          }
        },
        { $match: { totalValue: { $gt: 0 }, deadStockValue: { $gt: 0 } } },
        { $lookup: { from: 'franchises', localField: '_id', foreignField: '_id', as: 'f' } },
        { $unwind: '$f' },
        {
          $addFields: {
            deadStockPercent: { $multiply: [{ $divide: ['$deadStockValue', '$totalValue'] }, 100] }
          }
        },
        { $sort: { deadStockValue: -1 } },
        { $limit: 10 },
        { $project: { franchiseId: { $toString: '$_id' }, franchiseName: '$f.name', deadStockValue: 1, totalInventoryValue: '$totalValue', deadStockPercent: 1, _id: 0 } }
      ]),
      // Sudden revenue drops: current vs previous week (indexed: createdAt, status, franchise)
      Sale.aggregate([
        { $match: { createdAt: { $gte: currentWeekStart, $lte: endDate }, status: 'completed' } },
        { $group: { _id: '$franchise', currentRevenue: { $sum: '$grandTotal' } } },
        {
          $lookup: {
            from: 'sales',
            let: { fid: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$franchise', '$$fid'] },
                      { $gte: ['$createdAt', previousWeekStart] },
                      { $lt: ['$createdAt', currentWeekStart] },
                      { $eq: ['$status', 'completed'] }
                    ]
                  }
                }
              },
              { $group: { _id: null, revenue: { $sum: '$grandTotal' } } }
            ],
            as: 'prev'
          }
        },
        {
          $addFields: {
            previousRevenue: { $ifNull: [{ $arrayElemAt: ['$prev.revenue', 0] }, 0] }
          }
        },
        {
          $addFields: {
            dropPercent: {
              $cond: [
                { $gt: ['$previousRevenue', 0] },
                { $multiply: [{ $divide: [{ $subtract: ['$previousRevenue', '$currentRevenue'] }, '$previousRevenue'] }, 100] },
                0
              ]
            }
          }
        },
        { $match: { dropPercent: { $gte: 25 }, previousRevenue: { $gt: 0 } } },
        { $lookup: { from: 'franchises', localField: '_id', foreignField: '_id', as: 'f' } },
        { $unwind: '$f' },
        { $sort: { dropPercent: -1 } },
        {
          $project: {
            franchiseId: { $toString: '$_id' },
            franchiseName: '$f.name',
            currentRevenue: 1,
            previousRevenue: 1,
            dropPercent: 1,
            _id: 0
          }
        }
      ])
    ]);

    const { lossMaking = [], lowMarginCategories = [] } = insightsResult[0] || {};

    res.status(200).json({
      success: true,
      data: {
        lossMakingFranchises: lossMaking,
        lowMarginCategories: lowMarginCategories,
        highDeadStockOutlets: deadStockByFranchise,
        suddenRevenueDrops: suddenRevenueDrops
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch admin insights',
      error: error.message
    });
  }
};
