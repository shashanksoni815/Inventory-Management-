import { Product } from '../models/Product.model.js';
import { Sale } from '../models/Sale.model.js';
import { startOfDay, endOfDay, subDays, startOfMonth, endOfMonth } from 'date-fns';

export const getDashboardStats = async (req, res) => {
  try {
    const today = new Date();
    const startOfToday = startOfDay(today);
    const endOfToday = endOfDay(today);
    const thirtyDaysAgo = subDays(today, 30);

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
      // Total products
      Product.countDocuments({ status: 'active' }),
      
      // Low stock products
      Product.find({
        stockQuantity: { $gt: 0 },
        $expr: { $lte: ['$stockQuantity', '$minimumStock'] }
      }).countDocuments(),
      
      // Today's sales
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
            totalRevenue: { $sum: '$grandTotal' },
            totalProfit: { $sum: '$totalProfit' }
          }
        }
      ]),
      
      // Today's online sales
      Sale.aggregate([
        {
          $match: {
            createdAt: { $gte: startOfToday, $lte: endOfToday },
            saleType: 'online',
            status: 'completed'
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
      
      // Today's offline sales
      Sale.aggregate([
        {
          $match: {
            createdAt: { $gte: startOfToday, $lte: endOfToday },
            saleType: 'offline',
            status: 'completed'
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
      
      // Inventory value
      Product.aggregate([
        { $match: { status: 'active' } },
        {
          $group: {
            _id: null,
            totalValue: { $sum: { $multiply: ['$stockQuantity', '$buyingPrice'] } }
          }
        }
      ]),
      
      // Last 30 days sales trend
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
    
    const matchStage = {
      createdAt: { $gte: startDate },
      status: 'completed'
    };
    
    if (type !== 'all') {
      matchStage.saleType = type;
    }
    
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