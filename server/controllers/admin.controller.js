// controllers/admin.controller.js
import { Sale } from '../models/Sale.model.js';
import { cache, adminDashboardCacheKey } from '../utils/cache.js';

/**
 * Optimized global admin dashboard.
 * Performance rules:
 * - $match as early as possible (indexed: createdAt, status)
 * - $project to limit fields (lookup only _id/name, product only category)
 * - $facet instead of multiple queries (kpis, profitByFranchise, profitTrend, profitByCategory)
 * - No large array populate in Node (all via aggregation $lookup)
 * - Cache response 30–60s (see utils/cache.js)
 * GET /api/admin/dashboard?timeRange=7d|30d|90d|1y
 */
export const getAdminDashboard = async (req, res) => {
  try {
    const { user } = req;
    if (user.role !== 'admin' && user.role !== 'superAdmin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
      });
    }

    const { timeRange = '30d' } = req.query;
    const cacheKey = adminDashboardCacheKey(timeRange);
    const cached = cache.get(cacheKey);
    if (cached) {
      res.set('Cache-Control', 'private, max-age=45');
      return res.status(200).json(cached.value);
    }

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

    const dateFormat = timeRange === '1y' ? '%Y-%m' : '%Y-%m-%d';

    // $match as early as possible (uses indexed: createdAt, status)
    const [result] = await Sale.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: 'completed',
        },
      },
      {
        $lookup: {
          from: 'franchises',
          localField: 'franchise',
          foreignField: '_id',
          as: 'franchiseDoc',
          pipeline: [{ $project: { _id: 1, name: 1 } }],
        },
      },
      { $unwind: '$franchiseDoc' },
      // $project to limit fields before $facet (no large arrays, only needed fields)
      {
        $project: {
          grandTotal: 1,
          totalProfit: 1,
          createdAt: 1,
          items: { $ifNull: ['$items', []] },
          franchiseDoc: 1,
        },
      },
      {
        $facet: {
          kpis: [
            {
              $group: {
                _id: null,
                totalRevenue: { $sum: '$grandTotal' },
                totalProfit: { $sum: '$totalProfit' },
                totalSales: { $sum: 1 },
                avgOrderValue: { $avg: '$grandTotal' },
              },
            },
            {
              $project: {
                _id: 0,
                totalRevenue: 1,
                totalProfit: 1,
                totalSales: 1,
                avgOrderValue: { $cond: [{ $gt: ['$totalSales', 0] }, '$avgOrderValue', 0] },
              },
            },
          ],
          profitByFranchise: [
            {
              $group: {
                _id: '$franchiseDoc._id',
                name: { $first: '$franchiseDoc.name' },
                revenue: { $sum: '$grandTotal' },
                profit: { $sum: '$totalProfit' },
              },
            },
            { $sort: { profit: -1 } },
            {
              $project: {
                franchiseId: { $toString: '$_id' },
                franchiseName: '$name',
                revenue: 1,
                profit: 1,
                _id: 0,
              },
            },
          ],
          profitTrend: [
            {
              $group: {
                _id: { $dateToString: { format: dateFormat, date: '$createdAt' } },
                revenue: { $sum: '$grandTotal' },
                profit: { $sum: '$totalProfit' },
              },
            },
            { $sort: { _id: 1 } },
            {
              $project: {
                period: '$_id',
                revenue: 1,
                profit: 1,
                _id: 0,
              },
            },
          ],
          profitByCategory: [
            { $unwind: '$items' },
            {
              $lookup: {
                from: 'products',
                localField: 'items.product',
                foreignField: '_id',
                as: 'product',
                pipeline: [{ $project: { category: 1 } }],
              },
            },
            { $unwind: '$product' },
            {
              $group: {
                _id: '$product.category',
                revenue: {
                  $sum: { $multiply: [{ $ifNull: ['$items.sellingPrice', 0] }, { $ifNull: ['$items.quantity', 0] }] },
                },
                cost: {
                  $sum: { $multiply: [{ $ifNull: ['$items.buyingPrice', 0] }, { $ifNull: ['$items.quantity', 0] }] },
                },
                profit: { $sum: { $ifNull: ['$items.profit', 0] } },
              },
            },
            { $sort: { profit: -1 } },
            {
              $project: {
                category: '$_id',
                revenue: 1,
                cost: 1,
                profit: 1,
                _id: 0,
              },
            },
          ],
        },
      },
    ]);

    const kpis = result?.kpis?.[0] || {
      totalRevenue: 0,
      totalProfit: 0,
      totalSales: 0,
      avgOrderValue: 0,
    };
    const profitByFranchise = result?.profitByFranchise || [];
    const profitTrend = result?.profitTrend || [];
    const profitByCategory = result?.profitByCategory || [];

    const payload = {
      success: true,
      data: {
        kpis,
        profitByFranchise,
        profitTrend,
        profitByCategory,
        period: { startDate, endDate, timeRange },
      },
    };

    cache.set(cacheKey, payload);
    res.set('Cache-Control', 'private, max-age=45'); // Align with server cache TTL
    res.status(200).json(payload);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch admin dashboard',
      error: error.message,
    });
  }
};
