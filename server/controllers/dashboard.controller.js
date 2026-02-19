import { Product } from '../models/Product.model.js';
import { Sale } from '../models/Sale.model.js';
import { Order } from '../models/Order.model.js';
import Franchise from '../models/Franchise.js';
import { startOfDay, endOfDay, subDays, startOfMonth, endOfMonth } from 'date-fns';
import mongoose from 'mongoose';
import { applyFranchiseFilter } from '../utils/franchiseFilter.js';

export const getDashboardStats = async (req, res) => {
  try {
    const today = new Date();
    const startOfToday = startOfDay(today);
    const endOfToday = endOfDay(today);
    const thirtyDaysAgo = subDays(today, 30);

    // Build franchise filter for non-admin users
    const franchiseFilter = applyFranchiseFilter(req);
    const productFilter = applyFranchiseFilter(req, { status: 'active' }, { includeGlobal: true });
    const saleFilter = applyFranchiseFilter(req, {
      createdAt: { $gte: startOfToday, $lte: endOfToday },
      status: 'completed'
    });

    // Parallel database queries for performance
    const [
      totalProducts,
      lowStockProducts,
      totalSalesToday,
      totalOnlineSalesToday,
      totalOfflineSalesToday,
      inventoryValue,
      salesData,
      profitLossData,
      topProducts
    ] = await Promise.all([
      // Total products (with franchise isolation)
      Product.countDocuments(productFilter),
      
      // Low stock products (with franchise isolation)
      Product.find({
        ...productFilter,
        stockQuantity: { $gt: 0 },
        $expr: { $lte: ['$stockQuantity', '$minimumStock'] }
      }).countDocuments(),
      
      // Today's sales (with franchise isolation)
      Sale.aggregate([
        {
          $match: saleFilter
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$grandTotal' },
            totalProfit: { $sum: '$totalProfit' }
          }
        }
      ]),
      
      // Today's online sales (with franchise isolation)
      Sale.aggregate([
        {
          $match: {
            ...saleFilter,
            saleType: 'online'
          }
        },
        {
          $group: {
            _id: null,
            revenue: { $sum: '$grandTotal' },
            count: { $sum: 1 }
          }
        }
      ]),
      
      // Today's offline sales (with franchise isolation)
      Sale.aggregate([
        {
          $match: {
            ...saleFilter,
            saleType: 'offline'
          }
        },
        {
          $group: {
            _id: null,
            revenue: { $sum: '$grandTotal' },
            count: { $sum: 1 }
          }
        }
      ]),
      
      // Inventory value (with franchise isolation)
      Product.aggregate([
        { $match: productFilter },
        {
          $group: {
            _id: null,
            totalValue: { $sum: { $multiply: ['$stockQuantity', '$buyingPrice'] } }
          }
        }
      ]),
      
      // Last 30 days sales trend (with franchise isolation)
      Sale.aggregate([
        {
          $match: applyFranchiseFilter(req, {
            createdAt: { $gte: thirtyDaysAgo },
            status: 'completed'
          })
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
            },
            revenue: { $sum: '$grandTotal' },
            profit: { $sum: '$totalProfit' },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id': 1 } }
      ]),
      
      // Profit vs Loss by category
      Sale.aggregate([
        {
          $match: {
            createdAt: { $gte: thirtyDaysAgo },
            status: 'completed'
          }
        },
        { $unwind: '$items' },
        {
          $lookup: {
            from: 'products',
            localField: 'items.product',
            foreignField: '_id',
            as: 'product'
          }
        },
        { $unwind: '$product' },
        {
          $group: {
            _id: '$product.category',
            totalProfit: { $sum: '$items.profit' },
            totalRevenue: { $sum: { $multiply: ['$items.sellingPrice', '$items.quantity'] } }
          }
        }
      ]),
      
      // Top 5 products by revenue
      Sale.aggregate([
        {
          $match: {
            createdAt: { $gte: thirtyDaysAgo },
            status: 'completed'
          }
        },
        { $unwind: '$items' },
        {
          $group: {
            _id: {
              productId: '$items.product',
              name: '$items.name',
              sku: '$items.sku'
            },
            revenue: { $sum: { $multiply: ['$items.sellingPrice', '$items.quantity'] } },
            profit: { $sum: '$items.profit' },
            quantitySold: { $sum: '$items.quantity' }
          }
        },
        { $sort: { revenue: -1 } },
        { $limit: 5 }
      ])
    ]);

    // Dead stock (no sales in last 90 days)
    const ninetyDaysAgo = subDays(today, 90);
    const deadStock = await Product.find({
      lastSold: { $lt: ninetyDaysAgo },
      stockQuantity: { $gt: 0 },
      status: 'active'
    })
    .select('name sku category stockQuantity lastSold buyingPrice')
    .limit(10)
    .lean();

    // Format response
    const stats = {
      kpis: {
        totalRevenue: salesData.reduce((sum, day) => sum + day.revenue, 0),
        totalProfit: profitLossData.reduce((sum, cat) => sum + (cat.totalProfit > 0 ? cat.totalProfit : 0), 0),
        totalLoss: Math.abs(profitLossData.reduce((sum, cat) => sum + (cat.totalProfit < 0 ? cat.totalProfit : 0), 0)),
        inventoryValue: inventoryValue[0]?.totalValue || 0,
        totalProducts: totalProducts,
        lowStockAlerts: lowStockProducts,
        onlineSalesToday: {
          revenue: totalOnlineSalesToday[0]?.revenue || 0,
          count: totalOnlineSalesToday[0]?.count || 0
        },
        offlineSalesToday: {
          revenue: totalOfflineSalesToday[0]?.revenue || 0,
          count: totalOfflineSalesToday[0]?.count || 0
        }
      },
      charts: {
        salesTrend: salesData.map(day => ({
          date: day._id,
          revenue: day.revenue,
          profit: day.profit,
          orders: day.count
        })),
        profitByCategory: profitLossData.map(cat => ({
          category: cat._id,
          profit: cat.totalProfit,
          revenue: cat.totalRevenue
        })),
        topProducts: topProducts.map(product => ({
          name: product._id.name,
          sku: product._id.sku,
          revenue: product.revenue,
          profit: product.profit,
          quantitySold: product.quantitySold
        })),
        deadStock: deadStock
      }
    };

    // Cache control headers
    res.set('Cache-Control', 'public, max-age=30');
    
    res.status(200).json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard stats',
      error: error.message
    });
  }
};

export const getSalesAnalytics = async (req, res) => {
  try {
    const { period = '30d', type = 'all' } = req.query;
    let days = 30;
    
    if (period === '7d') days = 7;
    if (period === '90d') days = 90;
    if (period === '1y') days = 365;
    
    const startDate = subDays(new Date(), days);
    
    const baseMatch = {
      createdAt: { $gte: startDate },
      status: 'completed'
    };
    
    if (type !== 'all') {
      baseMatch.saleType = type;
    }
    
    // Apply franchise isolation
    const matchStage = applyFranchiseFilter(req, baseMatch);
    
    const analytics = await Sale.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          revenue: { $sum: '$grandTotal' },
          profit: { $sum: '$totalProfit' },
          orders: { $sum: 1 },
          avgOrderValue: { $avg: '$grandTotal' },
          itemsSold: { $sum: { $sum: '$items.quantity' } }
        }
      },
      { $sort: { '_id': 1 } }
    ]);
    
    res.status(200).json({
      success: true,
      data: analytics
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sales analytics',
      error: error.message
    });
  }
};


/**
 * Admin Master Dashboard
 * GET /api/dashboard/admin
 * 
 * Returns comprehensive global metrics across all franchises:
 * - Total franchises, products, revenue, profit, orders
 * - Pending orders count
 * - Low stock alerts
 * - Today's revenue
 * - Revenue trend (last 30 days)
 * - Franchise performance ranking
 * - Order statistics
 * - Category breakdown
 * 
 * Uses optimized MongoDB aggregations with $facet for parallel queries
 */
export const getAdminDashboard = async (req, res) => {
  try {
    const { user } = req;
    
    // Check admin access
    if (user.role !== 'admin' && user.role !== 'superAdmin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
      });
    }

    const today = new Date();
    const startOfToday = startOfDay(today);
    const endOfToday = endOfDay(today);
    const thirtyDaysAgo = subDays(today, 30);

    // Parallel queries using Promise.all for optimal performance
    const [
      totalFranchises,
      totalProducts,
      lowStockCount,
      todayRevenueResult,
      revenueTrendResult,
      franchisePerformanceResult,
      orderStatsResult,
      categoryBreakdownResult,
      allTimeStatsResult
    ] = await Promise.all([
      // Total franchises (active only)
      Franchise.countDocuments({ status: 'active' }),

      // Total products (active only)
      Product.countDocuments({ status: 'active' }),

      // Low stock count
      Product.countDocuments({
        status: 'active',
        stockQuantity: { $gt: 0 },
        $expr: { $lte: ['$stockQuantity', '$minimumStock'] }
      }),

      // Today's revenue and sales count
      Sale.aggregate([
        {
          $match: {
            createdAt: { $gte: startOfToday, $lte: endOfToday },
            status: 'completed'
          }
        },
        {
          $group: {
            _id: null,
            revenue: { $sum: '$grandTotal' },
            profit: { $sum: '$totalProfit' },
            count: { $sum: 1 }
          }
        }
      ]),

      // Revenue trend (last 30 days)
      Sale.aggregate([
        {
          $match: {
            createdAt: { $gte: thirtyDaysAgo },
            status: 'completed'
          }
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
            },
            revenue: { $sum: '$grandTotal' },
            profit: { $sum: '$totalProfit' },
            sales: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } },
        {
          $project: {
            _id: 0,
            date: '$_id',
            revenue: 1,
            profit: 1,
            sales: 1
          }
        }
      ]),

      // Franchise performance (all-time, sorted by revenue)
      Sale.aggregate([
        {
          $match: {
            status: 'completed'
          }
        },
        {
          $lookup: {
            from: 'franchises',
            localField: 'franchise',
            foreignField: '_id',
            as: 'franchiseDoc',
            pipeline: [{ $project: { name: 1, code: 1, status: 1 } }]
          }
        },
        { $unwind: '$franchiseDoc' },
        {
          $match: {
            'franchiseDoc.status': 'active'
          }
        },
        {
          $group: {
            _id: '$franchise',
            franchiseName: { $first: '$franchiseDoc.name' },
            franchiseCode: { $first: '$franchiseDoc.code' },
            totalRevenue: { $sum: '$grandTotal' },
            totalProfit: { $sum: '$totalProfit' },
            totalSales: { $sum: 1 },
            avgOrderValue: { $avg: '$grandTotal' }
          }
        },
        { $sort: { totalRevenue: -1 } },
        { $limit: 10 },
        {
          $project: {
            _id: 0,
            franchiseId: { $toString: '$_id' },
            franchiseName: 1,
            franchiseCode: 1,
            totalRevenue: 1,
            totalProfit: 1,
            totalSales: 1,
            avgOrderValue: { $round: ['$avgOrderValue', 2] },
            profitMargin: {
              $cond: [
                { $gt: ['$totalRevenue', 0] },
                { $multiply: [{ $divide: ['$totalProfit', '$totalRevenue'] }, 100] },
                0
              ]
            }
          }
        }
      ]),

      // Order statistics (using $facet for multiple metrics)
      Order.aggregate([
        {
          $match: {
            isDeleted: { $ne: true },
            deletedAt: null
          }
        },
        {
          $facet: {
            totalOrders: [
              { $count: 'count' }
            ],
            pendingOrders: [
              {
                $match: {
                  orderStatus: { $in: ['Pending', 'Confirmed', 'Packed', 'Shipped'] }
                }
              },
              { $count: 'count' }
            ],
            orderStatsByStatus: [
              {
                $group: {
                  _id: '$orderStatus',
                  count: { $sum: 1 },
                  totalRevenue: { $sum: '$totals.grandTotal' }
                }
              },
              {
                $project: {
                  _id: 0,
                  status: '$_id',
                  count: 1,
                  totalRevenue: 1
                }
              }
            ],
            recentOrders: [
              { $sort: { createdAt: -1 } },
              { $limit: 10 },
              {
                $project: {
                  _id: 1,
                  orderNumber: 1,
                  orderStatus: 1,
                  'customer.name': 1,
                  'totals.grandTotal': 1,
                  createdAt: 1
                }
              }
            ]
          }
        }
      ]),

      // Category breakdown (all-time)
      Sale.aggregate([
        {
          $match: {
            status: 'completed'
          }
        },
        { $unwind: '$items' },
        {
          $lookup: {
            from: 'products',
            localField: 'items.product',
            foreignField: '_id',
            as: 'productDoc',
            pipeline: [{ $project: { category: 1 } }]
          }
        },
        { $unwind: { path: '$productDoc', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: { $ifNull: ['$productDoc.category', 'Other'] },
            revenue: {
              $sum: {
                $multiply: [
                  { $ifNull: ['$items.sellingPrice', 0] },
                  { $ifNull: ['$items.quantity', 0] }
                ]
              }
            },
            cost: {
              $sum: {
                $multiply: [
                  { $ifNull: ['$items.buyingPrice', 0] },
                  { $ifNull: ['$items.quantity', 0] }
                ]
              }
            },
            profit: { $sum: { $ifNull: ['$items.profit', 0] } },
            quantitySold: { $sum: { $ifNull: ['$items.quantity', 0] } }
          }
        },
        { $sort: { revenue: -1 } },
        {
          $project: {
            _id: 0,
            category: '$_id',
            revenue: 1,
            cost: 1,
            profit: 1,
            quantitySold: 1,
            profitMargin: {
              $cond: [
                { $gt: ['$revenue', 0] },
                { $multiply: [{ $divide: ['$profit', '$revenue'] }, 100] },
                0
              ]
            }
          }
        }
      ]),

      // All-time total revenue and profit
      Sale.aggregate([
        {
          $match: {
            status: 'completed'
          }
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$grandTotal' },
            totalProfit: { $sum: '$totalProfit' },
            totalSales: { $sum: 1 }
          }
        }
      ])
    ]);

    // Extract results
    const todayRevenue = todayRevenueResult[0] || { revenue: 0, profit: 0, count: 0 };
    const orderStats = orderStatsResult[0] || {
      totalOrders: [{ count: 0 }],
      pendingOrders: [{ count: 0 }],
      orderStatsByStatus: [],
      recentOrders: []
    };
    const allTimeStats = allTimeStatsResult[0] || {
      totalRevenue: 0,
      totalProfit: 0,
      totalSales: 0
    };

    // Format response
    const response = {
      success: true,
      data: {
        totalFranchises,
        totalProducts,
        totalRevenue: allTimeStats.totalRevenue,
        totalProfit: allTimeStats.totalProfit,
        totalOrders: orderStats.totalOrders[0]?.count || 0,
        pendingOrders: orderStats.pendingOrders[0]?.count || 0,
        lowStockCount,
        todayRevenue: todayRevenue.revenue,
        todayProfit: todayRevenue.profit,
        todaySales: todayRevenue.count,
        revenueTrend: revenueTrendResult,
        franchisePerformance: franchisePerformanceResult,
        orderStats: {
          total: orderStats.totalOrders[0]?.count || 0,
          pending: orderStats.pendingOrders[0]?.count || 0,
          byStatus: orderStats.orderStatsByStatus,
          recentOrders: orderStats.recentOrders.map((order) => ({
            _id: order._id,
            orderNumber: order.orderNumber,
            orderStatus: order.orderStatus,
            customerName: order.customer?.name || 'N/A',
            grandTotal: order.totals?.grandTotal || 0,
            createdAt: order.createdAt
          }))
        },
        categoryBreakdown: categoryBreakdownResult
      },
      timestamp: new Date().toISOString()
    };

    res.set('Cache-Control', 'private, max-age=60');
    res.status(200).json(response);
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch admin dashboard',
      error: error.message
    });
  }
};