import mongoose from 'mongoose';
import { Product } from '../models/Product.model.js';
import { Sale } from '../models/Sale.model.js';
import Transfer from '../models/Transfer.js';
import { AuditLog } from '../models/AuditLog.model.js';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';

export const generateSalesReport = async (req, res) => {
  try {
    const { startDate, endDate, format: reportFormat = 'excel', franchise } = req.query;
    const { user } = req;

    const query = {
      createdAt: {
        $gte: new Date(startDate || subMonths(new Date(), 1)),
        $lte: new Date(endDate || new Date()),
      },
      status: 'completed',
    };
    // STRICT FRANCHISE SCOPING: Filter sales by franchise when provided
    if (franchise) {
      if (user && user.role !== 'admin') {
        const userFranchises = (user.franchises || []).map((f) => f?.toString?.() || f);
        if (!userFranchises.includes(String(franchise))) {
          return res.status(403).json({
            success: false,
            message: 'Access denied to this franchise',
          });
        }
      }
      query.franchise = franchise;
    }

    const sales = await Sale.find(query)
      .populate('items.product', 'name sku category')
      .populate('order', 'orderNumber')
      .lean();

    // Aggregated data (includes revenue from order-derived sales)
    const aggregated = await Sale.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$grandTotal' },
          totalProfit: { $sum: '$totalProfit' },
          totalSales: { $sum: 1 },
          avgOrderValue: { $avg: '$grandTotal' },
          onlineSales: {
            $sum: { $cond: [{ $eq: ['$saleType', 'online'] }, '$grandTotal', 0] },
          },
          offlineSales: {
            $sum: { $cond: [{ $eq: ['$saleType', 'offline'] }, '$grandTotal', 0] },
          },
          revenueFromOrders: {
            $sum: { $cond: [{ $ne: ['$order', null] }, '$grandTotal', 0] },
          },
        },
      },
    ]);

    // Daily trend
    const dailyTrend = await Sale.aggregate([
      { $match: query },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          revenue: { $sum: '$grandTotal' },
          profit: { $sum: '$totalProfit' },
          orders: { $sum: 1 },
        },
      },
      { $sort: { '_id': 1 } },
    ]);

    // Category performance
    const categoryPerformance = await Sale.aggregate([
      { $match: query },
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'products',
          localField: 'items.product',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $unwind: '$product' },
      {
        $group: {
          _id: '$product.category',
          revenue: { $sum: { $multiply: ['$items.sellingPrice', '$items.quantity'] } },
          profit: { $sum: '$items.profit' },
          itemsSold: { $sum: '$items.quantity' },
        },
      },
      { $sort: { revenue: -1 } },
    ]);

    if (reportFormat === 'excel') {
      const workbook = new ExcelJS.Workbook();
      
      // Sales Summary Sheet
      const summarySheet = workbook.addWorksheet('Sales Summary');
      summarySheet.columns = [
        { header: 'Metric', key: 'metric', width: 30 },
        { header: 'Value', key: 'value', width: 20 },
      ];
      
      if (aggregated[0]) {
        const summary = aggregated[0];
        summarySheet.addRows([
          { metric: 'Total Revenue', value: summary.totalRevenue },
          { metric: 'Total Profit', value: summary.totalProfit },
          { metric: 'Total Sales', value: summary.totalSales },
          { metric: 'Average Order Value', value: summary.avgOrderValue.toFixed(2) },
          { metric: 'Online Sales', value: summary.onlineSales },
          { metric: 'Offline Sales', value: summary.offlineSales },
          { metric: 'Revenue from Orders (delivered)', value: summary.revenueFromOrders ?? 0 },
        ]);
      }

      // Daily Trend Sheet
      const trendSheet = workbook.addWorksheet('Daily Trend');
      trendSheet.columns = [
        { header: 'Date', key: 'date', width: 15 },
        { header: 'Revenue', key: 'revenue', width: 15 },
        { header: 'Profit', key: 'profit', width: 15 },
        { header: 'Orders', key: 'orders', width: 10 },
      ];
      
      dailyTrend.forEach(day => {
        trendSheet.addRow({
          date: day._id,
          revenue: day.revenue,
          profit: day.profit,
          orders: day.orders,
        });
      });

      // Category Performance Sheet
      const categorySheet = workbook.addWorksheet('Category Performance');
      categorySheet.columns = [
        { header: 'Category', key: 'category', width: 20 },
        { header: 'Revenue', key: 'revenue', width: 15 },
        { header: 'Profit', key: 'profit', width: 15 },
        { header: 'Items Sold', key: 'itemsSold', width: 15 },
        { header: 'Profit Margin', key: 'margin', width: 15 },
      ];
      
      categoryPerformance.forEach(cat => {
        const margin = cat.revenue > 0 ? (cat.profit / cat.revenue) * 100 : 0;
        categorySheet.addRow({
          category: cat._id,
          revenue: cat.revenue,
          profit: cat.profit,
          itemsSold: cat.itemsSold,
          margin: `${margin.toFixed(2)}%`,
        });
      });

      // Detailed Sales Sheet
      const detailsSheet = workbook.addWorksheet('Sales Details');
      detailsSheet.columns = [
        { header: 'Invoice #', key: 'invoice', width: 20 },
        { header: 'Date', key: 'date', width: 15 },
        { header: 'Customer', key: 'customer', width: 25 },
        { header: 'Type', key: 'type', width: 10 },
        { header: 'Payment', key: 'payment', width: 15 },
        { header: 'Total', key: 'total', width: 15 },
        { header: 'Profit', key: 'profit', width: 15 },
        { header: 'Status', key: 'status', width: 12 },
        { header: 'Order #', key: 'orderNo', width: 18 },
      ];
      
      sales.forEach(sale => {
        detailsSheet.addRow({
          invoice: sale.invoiceNumber,
          date: format(new Date(sale.createdAt), 'yyyy-MM-dd'),
          customer: sale.customerName || 'N/A',
          type: sale.saleType,
          payment: sale.paymentMethod,
          total: sale.grandTotal,
          profit: sale.totalProfit,
          status: sale.status,
          orderNo: sale.order?.orderNumber ?? '—',
        });
      });

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        'attachment; filename=sales-report.xlsx'
      );

      await workbook.xlsx.write(res);
      res.end();
    } else if (reportFormat === 'pdf') {
      const doc = new PDFDocument({ margin: 50 });
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename=sales-report.pdf'
      );

      doc.pipe(res);

      // Header
      doc.fontSize(20).text('Sales Report', 50, 50);
      doc.fontSize(10).text(`Period: ${format(new Date(startDate), 'yyyy-MM-dd')} to ${format(new Date(endDate || new Date()), 'yyyy-MM-dd')}`, 50, 80);
      doc.text(`Generated: ${format(new Date(), 'yyyy-MM-dd HH:mm')}`, 50, 95);

      // Summary
      doc.fontSize(12).text('Summary', 50, 130);
      doc.fontSize(10);
      
      if (aggregated[0]) {
        const summary = aggregated[0];
        const summaryY = 150;
        doc.text(`Total Revenue: $${summary.totalRevenue.toFixed(2)}`, 50, summaryY);
        doc.text(`Total Profit: $${summary.totalProfit.toFixed(2)}`, 50, summaryY + 15);
        doc.text(`Total Sales: ${summary.totalSales}`, 50, summaryY + 30);
        doc.text(`Average Order: $${summary.avgOrderValue.toFixed(2)}`, 50, summaryY + 45);
        doc.text(`Revenue from Orders (delivered): $${(summary.revenueFromOrders ?? 0).toFixed(2)}`, 50, summaryY + 60);
      }

      // Category Performance Table
      let y = 220;
      doc.fontSize(12).text('Category Performance', 50, y);
      y += 20;
      
      doc.fontSize(9);
      categoryPerformance.forEach((cat, index) => {
        if (y > 700) {
          doc.addPage();
          y = 50;
        }
        
        const margin = cat.revenue > 0 ? (cat.profit / cat.revenue) * 100 : 0;
        doc.text(cat._id, 50, y);
        doc.text(`$${cat.revenue.toFixed(2)}`, 150, y);
        doc.text(`$${cat.profit.toFixed(2)}`, 250, y);
        doc.text(`${margin.toFixed(1)}%`, 350, y);
        y += 15;
      });

      doc.end();
    } else {
      res.status(200).json({
        success: true,
        data: {
          summary: { ...(aggregated[0] || {}), revenueFromOrders: aggregated[0]?.revenueFromOrders ?? 0 },
          dailyTrend,
          categoryPerformance,
          sales: sales.map(s => ({
            invoice: s.invoiceNumber,
            date: s.createdAt,
            total: s.grandTotal,
            profit: s.totalProfit,
            type: s.saleType,
            orderNumber: s.order?.orderNumber ?? null,
          })),
        },
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to generate sales report',
      error: error.message,
    });
  }
};

export const generateInventoryReport = async (req, res) => {
  try {
    const { includeValuation = true, format: reportFormat = 'excel' } = req.query;

    const products = await Product.find({ status: 'active' }).lean();

    // Calculate inventory metrics
    const totalProducts = products.length;
    const totalStock = products.reduce((sum, p) => sum + p.stockQuantity, 0);
    const totalValue = products.reduce((sum, p) => sum + (p.stockQuantity * p.buyingPrice), 0);
    const lowStockCount = products.filter(p => p.stockQuantity > 0 && p.stockQuantity <= p.minimumStock).length;
    const outOfStockCount = products.filter(p => p.stockQuantity === 0).length;

    // Category analysis
    const categoryAnalysis = await Product.aggregate([
      { $match: { status: 'active' } },
      {
        $group: {
          _id: '$category',
          totalProducts: { $sum: 1 },
          totalStock: { $sum: '$stockQuantity' },
          totalValue: { $sum: { $multiply: ['$stockQuantity', '$buyingPrice'] } },
          avgMargin: { $avg: '$profitMargin' },
        },
      },
      { $sort: { totalValue: -1 } },
    ]);

    // Stock health analysis
    const stockHealth = {
      healthy: products.filter(p => p.stockQuantity > p.minimumStock * 2).length,
      low: lowStockCount,
      out: outOfStockCount,
      dead: products.filter(p => {
        if (!p.lastSold) return true;
        const daysSinceLastSale = (Date.now() - new Date(p.lastSold).getTime()) / (1000 * 60 * 60 * 24);
        return daysSinceLastSale > 90 && p.stockQuantity > 0;
      }).length,
    };

    if (reportFormat === 'excel') {
      const workbook = new ExcelJS.Workbook();
      
      // Summary Sheet
      const summarySheet = workbook.addWorksheet('Inventory Summary');
      summarySheet.columns = [
        { header: 'Metric', key: 'metric', width: 30 },
        { header: 'Value', key: 'value', width: 20 },
      ];
      
      summarySheet.addRows([
        { metric: 'Total Products', value: totalProducts },
        { metric: 'Total Stock Units', value: totalStock },
        { metric: 'Total Inventory Value', value: totalValue },
        { metric: 'Low Stock Items', value: lowStockCount },
        { metric: 'Out of Stock Items', value: outOfStockCount },
        { metric: 'Average Profit Margin', value: `${(products.reduce((sum, p) => sum + p.profitMargin, 0) / totalProducts).toFixed(1)}%` },
      ]);

      // Category Analysis Sheet
      const categorySheet = workbook.addWorksheet('Category Analysis');
      categorySheet.columns = [
        { header: 'Category', key: 'category', width: 20 },
        { header: 'Products', key: 'products', width: 10 },
        { header: 'Stock Units', key: 'stock', width: 15 },
        { header: 'Inventory Value', key: 'value', width: 15 },
        { header: 'Avg Margin', key: 'margin', width: 15 },
      ];
      
      categoryAnalysis.forEach(cat => {
        categorySheet.addRow({
          category: cat._id,
          products: cat.totalProducts,
          stock: cat.totalStock,
          value: cat.totalValue,
          margin: `${cat.avgMargin.toFixed(1)}%`,
        });
      });

      // Product Details Sheet
      const detailsSheet = workbook.addWorksheet('Product Details');
      detailsSheet.columns = [
        { header: 'SKU', key: 'sku', width: 15 },
        { header: 'Name', key: 'name', width: 30 },
        { header: 'Category', key: 'category', width: 15 },
        { header: 'Stock', key: 'stock', width: 10 },
        { header: 'Min Stock', key: 'min', width: 10 },
        { header: 'Buying Price', key: 'buying', width: 15 },
        { header: 'Selling Price', key: 'selling', width: 15 },
        { header: 'Margin', key: 'margin', width: 10 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Last Sold', key: 'lastSold', width: 15 },
      ];
      
      products.forEach(product => {
        let status = 'Healthy';
        if (product.stockQuantity === 0) status = 'Out of Stock';
        else if (product.stockQuantity <= product.minimumStock) status = 'Low Stock';
        
        detailsSheet.addRow({
          sku: product.sku,
          name: product.name,
          category: product.category,
          stock: product.stockQuantity,
          min: product.minimumStock,
          buying: product.buyingPrice,
          selling: product.sellingPrice,
          margin: `${product.profitMargin.toFixed(1)}%`,
          status,
          lastSold: product.lastSold ? format(new Date(product.lastSold), 'yyyy-MM-dd') : 'Never',
        });
      });

      // Stock Health Sheet
      const healthSheet = workbook.addWorksheet('Stock Health');
      healthSheet.columns = [
        { header: 'Health Level', key: 'level', width: 20 },
        { header: 'Count', key: 'count', width: 15 },
        { header: 'Percentage', key: 'percentage', width: 15 },
      ];
      
      const total = stockHealth.healthy + stockHealth.low + stockHealth.out + stockHealth.dead;
      healthSheet.addRows([
        { level: 'Healthy Stock', count: stockHealth.healthy, percentage: `${((stockHealth.healthy / total) * 100).toFixed(1)}%` },
        { level: 'Low Stock', count: stockHealth.low, percentage: `${((stockHealth.low / total) * 100).toFixed(1)}%` },
        { level: 'Out of Stock', count: stockHealth.out, percentage: `${((stockHealth.out / total) * 100).toFixed(1)}%` },
        { level: 'Dead Stock', count: stockHealth.dead, percentage: `${((stockHealth.dead / total) * 100).toFixed(1)}%` },
      ]);

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        'attachment; filename=inventory-report.xlsx'
      );

      await workbook.xlsx.write(res);
      res.end();
    } else {
      res.status(200).json({
        success: true,
        data: {
          summary: {
            totalProducts,
            totalStock,
            totalValue,
            lowStockCount,
            outOfStockCount,
          },
          categoryAnalysis,
          stockHealth,
          products: products.map(p => ({
            sku: p.sku,
            name: p.name,
            stock: p.stockQuantity,
            status: p.stockQuantity === 0 ? 'out' : p.stockQuantity <= p.minimumStock ? 'low' : 'healthy',
            value: p.stockQuantity * p.buyingPrice,
          })),
        },
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to generate inventory report',
      error: error.message,
    });
  }
};

export const generateProfitLossReport = async (req, res) => {
  try {
    const { franchise, startDate, endDate } = req.query;
    const { user } = req;

    // Validate franchise parameter if provided
    if (franchise && !mongoose.Types.ObjectId.isValid(franchise)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid franchise ID',
      });
    }

    // Role-Based Access Control: Check franchise access
    if (franchise) {
      // Admin/SuperAdmin can access all franchises
      if (user.role === 'admin' || user.role === 'superAdmin') {
        // No access check needed - admins can access all
      } else if (user.role === 'franchise_manager') {
        // Franchise managers can only access their assigned franchises
        const userFranchises = (user.franchises || []).map((f) => f?.toString() || f);
        if (!userFranchises.includes(franchise.toString())) {
          return res.status(403).json({
            success: false,
            message: 'Access denied: You do not have access to this franchise',
          });
        }
      } else {
        // Unknown role - deny access
        return res.status(403).json({
          success: false,
          message: 'Access denied: Invalid user role',
        });
      }
    } else if (user.role === 'franchise_manager') {
      // Franchise managers must have at least one franchise assigned
      if (!user.franchises || !Array.isArray(user.franchises) || user.franchises.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: No franchises assigned to your account',
        });
      }
    }

    // Parse dates
    const start = startDate ? new Date(startDate) : subMonths(new Date(), 1);
    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    // Build date filter for transfers
    const transferDateFilter = {
      transferDate: {
        $gte: start,
        $lte: end,
      },
      status: 'completed', // Only count completed transfers
    };

    // Build query with franchise filter for sales
    const salesQuery = {
      createdAt: {
        $gte: start,
        $lte: end,
      },
      status: 'completed',
    };

    // Filter by franchise if provided
    const franchiseFilter = franchise ? new mongoose.Types.ObjectId(franchise) : null;
    if (franchiseFilter) {
      salesQuery.franchise = franchiseFilter;
    }

    // Get all completed sales in period (filtered by franchise; includes order-derived sales)
    const sales = await Sale.find(salesQuery)
      .populate('franchise', 'name code')
      .populate('items.product', 'name sku category')
      .populate('order', 'orderNumber')
      .lean();

    // Calculate Total Revenue from sales
    const totalRevenue = sales.reduce((sum, sale) => sum + (sale.grandTotal || 0), 0);

    // Calculate COGS (Cost of Goods Sold) from sale items
    // COGS = Cost of products sold (buyingPrice × quantity sold)
    const cogsFromSales = sales.reduce((sum, sale) => {
      if (sale.items && Array.isArray(sale.items)) {
        return sum + sale.items.reduce((itemSum, item) => {
          const quantity = item.quantity || 0;
          const buyingPrice = item.buyingPrice || 0;
          return itemSum + (quantity * buyingPrice);
        }, 0);
      }
      return sum;
    }, 0);

    // Calculate imported stock costs (affects COGS - inventory cost)
    // When stock is imported, the cost is added to inventory and affects COGS when sold
    const importedStockQuery = {
      ...transferDateFilter,
      toFranchise: franchiseFilter || { $exists: true },
    };
    if (franchiseFilter) {
      importedStockQuery.toFranchise = franchiseFilter;
    }

    const importedStockCosts = await Transfer.aggregate([
      { $match: importedStockQuery },
      {
        $group: {
          _id: null,
          totalCost: {
            $sum: {
              $ifNull: [
                '$totalValue',
                { $multiply: ['$unitPrice', '$quantity'] },
              ],
            },
          },
          totalQuantity: { $sum: '$quantity' },
        },
      },
    ]);

    const importedStockCost = importedStockCosts[0]?.totalCost || 0;

    // Calculate exported stock value (reduces inventory value)
    const exportedStockQuery = {
      ...transferDateFilter,
      fromFranchise: franchiseFilter || { $exists: true },
    };
    if (franchiseFilter) {
      exportedStockQuery.fromFranchise = franchiseFilter;
    }

    const exportedStockValue = await Transfer.aggregate([
      { $match: exportedStockQuery },
      {
        $group: {
          _id: null,
          totalValue: {
            $sum: {
              $ifNull: [
                '$totalValue',
                { $multiply: ['$unitPrice', '$quantity'] },
              ],
            },
          },
          totalQuantity: { $sum: '$quantity' },
        },
      },
    ]);

    const exportedStockValueAmount = exportedStockValue[0]?.totalValue || 0;

    // Calculate current inventory value
    const inventoryQuery = franchiseFilter
      ? {
          $or: [
            { franchise: franchiseFilter },
            { isGlobal: true, 'sharedWith.franchise': franchiseFilter },
            { isGlobal: true, franchise: franchiseFilter },
          ],
          status: 'active',
        }
      : { status: 'active' };

    const currentInventoryValue = await Product.aggregate([
      { $match: inventoryQuery },
      {
        $project: {
          franchiseStock: {
            $cond: {
              if: franchiseFilter
                ? { $eq: ['$franchise', franchiseFilter] }
                : false,
              then: {
                quantity: '$stockQuantity',
                buyingPrice: '$buyingPrice',
              },
              else: {
                $let: {
                  vars: {
                    shared: {
                      $arrayElemAt: [
                        {
                          $filter: {
                            input: { $ifNull: ['$sharedWith', []] },
                            as: 'item',
                            cond: franchiseFilter
                              ? {
                                  $eq: [
                                    '$$item.franchise',
                                    franchiseFilter,
                                  ],
                                }
                              : true,
                          },
                        },
                        0,
                      ],
                    },
                  },
                  in: {
                    quantity: '$$shared.quantity',
                    buyingPrice: '$buyingPrice',
                  },
                },
              },
            },
          },
        },
      },
      {
        $project: {
          value: {
            $multiply: [
              '$franchiseStock.quantity',
              '$franchiseStock.buyingPrice',
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          totalValue: { $sum: '$value' },
        },
      },
    ]);

    const inventoryValue = currentInventoryValue[0]?.totalValue || 0;

    // Total COGS = COGS from sales (products sold)
    // Note: Imported stock cost is part of inventory, and becomes COGS when products are sold
    // So COGS is already correctly calculated from sales
    const cogs = cogsFromSales;

    // Calculate Gross Profit
    const grossProfit = totalRevenue - cogs;

    // Calculate Operating Expenses (currently 0, but structure for future expansion)
    // TODO: Add operating expenses tracking (rent, utilities, salaries, etc.)
    const operatingExpenses = 0;

    // Calculate Net Profit
    const netProfit = grossProfit - operatingExpenses;

    // Calculate Margins
    const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
    const netMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    // Category-wise breakdown
    const categoryBreakdown = await Sale.aggregate([
      { $match: salesQuery },
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'products',
          localField: 'items.product',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $unwind: '$product' },
      {
        $group: {
          _id: '$product.category',
          category: { $first: '$product.category' },
          revenue: {
            $sum: {
              $multiply: [
                { $ifNull: ['$items.sellingPrice', 0] },
                { $ifNull: ['$items.quantity', 0] }
              ]
            }
          },
          cogs: {
            $sum: {
              $multiply: [
                { $ifNull: ['$items.buyingPrice', 0] },
                { $ifNull: ['$items.quantity', 0] }
              ]
            }
          },
          profit: {
            $sum: { $ifNull: ['$items.profit', 0] }
          },
          quantitySold: { $sum: { $ifNull: ['$items.quantity', 0] } },
        },
      },
      {
        $project: {
          _id: 1,
          category: 1,
          revenue: 1,
          cogs: 1,
          profit: 1,
          quantitySold: 1,
          grossMargin: {
            $cond: [
              { $gt: ['$revenue', 0] },
              { $multiply: [{ $divide: [{ $subtract: ['$revenue', '$cogs'] }, '$revenue'] }, 100] },
              0
            ]
          },
          netMargin: {
            $cond: [
              { $gt: ['$revenue', 0] },
              { $multiply: [{ $divide: ['$profit', '$revenue'] }, 100] },
              0
            ]
          },
        },
      },
      { $sort: { profit: -1 } },
    ]);

    // Format category breakdown
    const categoryWiseBreakdown = categoryBreakdown.map((cat) => ({
      category: cat.category || cat._id || 'Uncategorized',
      revenue: cat.revenue || 0,
      cogs: cat.cogs || 0,
      grossProfit: (cat.revenue || 0) - (cat.cogs || 0),
      netProfit: cat.profit || 0,
      quantitySold: cat.quantitySold || 0,
      grossMargin: cat.grossMargin || 0,
      netMargin: cat.netMargin || 0,
    }));

    // Calculate beginning inventory value (at start of period)
    // This requires calculating inventory value before the period started
    // For simplicity, we'll use current inventory - imports + exports for the period
    // Beginning Inventory ≈ Current Inventory - Net Imports (Imports - Exports)
    const netInventoryChange = importedStockCost - exportedStockValueAmount;
    const beginningInventoryValue = Math.max(0, inventoryValue - netInventoryChange);

    // COGS Calculation (Backend-driven):
    // COGS = Beginning Inventory + Purchases (Imports) - Ending Inventory
    // OR: COGS = Cost of products sold (from sales) - this is more accurate
    // We use the sales-based COGS as it's more accurate for actual goods sold
    const cogsFromInventoryMethod = beginningInventoryValue + importedStockCost - inventoryValue;
    
    // Use sales-based COGS (more accurate) but include inventory context
    const finalCogs = cogs; // Already calculated from sales

    // Calculate inventory changes
    const inventoryChanges = {
      beginningInventory: beginningInventoryValue,
      importedStockCost: importedStockCost,
      exportedStockValue: exportedStockValueAmount,
      endingInventory: inventoryValue,
      netInventoryChange: netInventoryChange,
    };

    // Build response
    const report = {
      summary: {
        totalRevenue,
        cogs: finalCogs,
        grossProfit,
        operatingExpenses,
        netProfit,
        grossMargin,
        netMargin,
        // Additional P&L metrics
        inventoryChanges,
      },
      categoryBreakdown: categoryWiseBreakdown,
      period: {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      },
      franchise: franchise || null,
      // Detailed breakdown for transparency
      breakdown: {
        revenue: {
          totalSales: sales.length,
          totalRevenue: totalRevenue,
          avgOrderValue: sales.length > 0 ? totalRevenue / sales.length : 0,
        },
        cogs: {
          cogsFromSales: cogs,
          cogsFromInventoryMethod: cogsFromInventoryMethod,
          // Note: Sales-based COGS is more accurate as it reflects actual cost of goods sold
        },
        inventory: {
          beginningValue: beginningInventoryValue,
          importedCost: importedStockCost,
          exportedValue: exportedStockValueAmount,
          endingValue: inventoryValue,
          netChange: netInventoryChange,
        },
      },
    };

    // Check if export format is requested
    const { format = 'json' } = req.query;
    
    // Create audit log entry for export (if format is excel or pdf)
    let auditLog = null;
    const startTime = Date.now();
    if (format === 'excel' || format === 'pdf') {
      const dateStr = start.toISOString().slice(0, 10);
      const endDateStr = end.toISOString().slice(0, 10);
      const fileName = `profit-loss-${franchise || 'all'}-${dateStr}_to_${endDateStr}.${format === 'excel' ? 'xlsx' : 'pdf'}`;
      auditLog = new AuditLog({
        actionType: 'export',
        operationType: 'profit_loss',
        fileName: fileName,
        format: format,
        user: user._id,
        franchise: franchise || null,
        totalRecords: sales.length,
        exportedRecords: sales.length,
        status: 'processing',
        startedAt: new Date(),
        requestParams: new Map(Object.entries({
          franchise: franchise || 'all',
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          format: format
        })),
        ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
        userAgent: req.headers['user-agent']
      });
      await auditLog.save();
    }
    
    if (format === 'excel') {
      // Generate Excel export - Structured format: Table with IDs, Names, Dates, Franchise, Totals
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Profit & Loss Report');

      // Prepare sales data for table format (sorted by date, latest first; includes order-derived sales)
      const salesData = sales.map(sale => {
        const saleRevenue = sale.grandTotal || 0;
        const saleCost = sale.items?.reduce((sum, item) => 
          sum + ((item.buyingPrice || 0) * (item.quantity || 0)), 0) || 0;
        const saleProfit = sale.totalProfit || (saleRevenue - saleCost);
        
        return {
          saleId: sale._id.toString(),
          invoiceNo: sale.invoiceNumber || 'N/A',
          orderNo: sale.order?.orderNumber ?? '—',
          date: new Date(sale.createdAt).toISOString().split('T')[0],
          dateFormatted: new Date(sale.createdAt).toLocaleDateString(),
          franchise: sale.franchise?.name || 'N/A',
          franchiseCode: sale.franchise?.code || 'N/A',
          customerName: sale.customerName || 'Walk-in Customer',
          revenue: saleRevenue,
          cost: saleCost,
          profit: saleProfit,
          margin: saleRevenue > 0 ? ((saleProfit / saleRevenue) * 100) : 0,
        };
      }).sort((a, b) => b.date.localeCompare(a.date)); // Sort by date descending (latest first)

      // Define columns - Structured format: IDs, Names, Dates, Franchise, Order #
      worksheet.columns = [
        { header: 'Sale ID', key: 'saleId', width: 25 },
        { header: 'Invoice No', key: 'invoiceNo', width: 20 },
        { header: 'Order #', key: 'orderNo', width: 18 },
        { header: 'Date', key: 'dateFormatted', width: 12 },
        { header: 'Franchise', key: 'franchise', width: 20 },
        { header: 'Franchise Code', key: 'franchiseCode', width: 15 },
        { header: 'Customer Name', key: 'customerName', width: 25 },
        { header: 'Revenue', key: 'revenue', width: 15 },
        { header: 'Cost', key: 'cost', width: 15 },
        { header: 'Profit', key: 'profit', width: 15 },
        { header: 'Margin %', key: 'margin', width: 12 },
      ];

      // Style header row
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };

      // Add data rows (already sorted by date descending)
      salesData.forEach(sale => {
        const row = worksheet.addRow({
          saleId: sale.saleId,
          invoiceNo: sale.invoiceNo,
          orderNo: sale.orderNo,
          dateFormatted: sale.dateFormatted,
          franchise: sale.franchise,
          franchiseCode: sale.franchiseCode,
          customerName: sale.customerName,
          revenue: sale.revenue,
          cost: sale.cost,
          profit: sale.profit,
          margin: sale.margin / 100, // Convert to decimal for Excel percentage format
        });
        
        // Format numeric columns
        row.getCell('revenue').numFmt = '$#,##0.00';
        row.getCell('cost').numFmt = '$#,##0.00';
        row.getCell('profit').numFmt = '$#,##0.00';
        row.getCell('margin').numFmt = '0.00%';
        
        // Color code profit (red for negative, green for positive)
        if (sale.profit < 0) {
          row.getCell('profit').fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFE0E0' }
          };
        } else {
          row.getCell('profit').fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0FFE0' }
          };
        }
      });

      // Add empty row before totals
      worksheet.addRow([]);

      // Add totals row at bottom
      const totalsRow = worksheet.addRow({
        saleId: 'TOTALS',
        invoiceNo: '',
        orderNo: '',
        dateFormatted: '',
        franchise: '',
        franchiseCode: '',
        customerName: '',
        revenue: totalRevenue,
        cost: finalCogs,
        profit: netProfit,
        margin: totalRevenue > 0 ? (netProfit / totalRevenue) : 0,
      });

      totalsRow.font = { bold: true };
      totalsRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD0D0D0' }
      };
      
      // Format totals row numeric columns
      totalsRow.getCell('revenue').numFmt = '$#,##0.00';
      totalsRow.getCell('cost').numFmt = '$#,##0.00';
      totalsRow.getCell('profit').numFmt = '$#,##0.00';
      totalsRow.getCell('margin').numFmt = '0.00%';

      // Set response headers
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=profit-loss-${franchise || 'all'}-${start.toISOString().slice(0, 10)}.xlsx`);

      await workbook.xlsx.write(res);
      res.end();
      return;
    } else if (format === 'pdf') {
      // Generate PDF export - Structured format: Table with IDs, Names, Dates, Franchise, Totals
      const doc = new PDFDocument({ margin: 50 });
      const filename = `profit-loss-${franchise || 'all'}-${start.toISOString().slice(0, 10)}.pdf`;
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
      
      // Track PDF generation for audit log
      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', async () => {
        const buffer = Buffer.concat(chunks);
        if (auditLog) {
          auditLog.fileSize = buffer.length;
          auditLog.status = 'completed';
          auditLog.completedAt = new Date();
          auditLog.duration = Date.now() - startTime;
          auditLog.exportedRecords = sales.length;
          await auditLog.save().catch(console.error);
        }
      });
      
      doc.pipe(res);

      // Title
      doc.fontSize(20).text('Profit & Loss Statement', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Period: ${start.toLocaleDateString()} to ${end.toLocaleDateString()}`, { align: 'center' });
      if (franchise) {
        doc.text(`Franchise: ${franchise}`, { align: 'center' });
      }
      doc.fontSize(9).fillColor('#555555').text('Revenue includes sales from delivered online orders.', { align: 'center' });
      doc.fillColor('#000000').moveDown(2);

      // Prepare sales data for table (sorted by date, latest first; includes order-derived sales)
      const salesData = sales.map(sale => {
        const saleRevenue = sale.grandTotal || 0;
        const saleCost = sale.items?.reduce((sum, item) => 
          sum + ((item.buyingPrice || 0) * (item.quantity || 0)), 0) || 0;
        const saleProfit = sale.totalProfit || (saleRevenue - saleCost);
        
        return {
          saleId: sale._id.toString().substring(0, 12) + '...',
          invoiceNo: sale.invoiceNumber || 'N/A',
          orderNo: sale.order?.orderNumber ?? '—',
          date: new Date(sale.createdAt).toLocaleDateString(),
          dateSort: new Date(sale.createdAt).toISOString(),
          franchise: sale.franchise?.name || 'N/A',
          franchiseCode: sale.franchise?.code || 'N/A',
          customerName: (sale.customerName || 'Walk-in').substring(0, 15),
          revenue: saleRevenue,
          cost: saleCost,
          profit: saleProfit,
          margin: saleRevenue > 0 ? ((saleProfit / saleRevenue) * 100) : 0,
        };
      }).sort((a, b) => b.dateSort.localeCompare(a.dateSort)); // Sort by date descending

      // Table header - Structured format: IDs, Names, Dates, Franchise, Order #
      let y = doc.y;
      doc.fontSize(10);
      const colWidths = [45, 50, 42, 42, 50, 40, 45, 45, 45, 45, 40];
      const headers = ['Sale ID', 'Invoice', 'Order #', 'Date', 'Franchise', 'Code', 'Customer', 'Revenue', 'Cost', 'Profit', 'Margin'];
      
      // Draw header background
      doc.rect(50, y, 500, 20).fill('#E0E0E0');
      
      // Draw header text
      let xPos = 55;
      headers.forEach((header, i) => {
        doc.fillColor('#000000')
          .fontSize(9)
          .font('Helvetica-Bold')
          .text(header, xPos, y + 5, { width: colWidths[i], align: 'left' });
        xPos += colWidths[i];
      });
      y += 25;
      doc.moveTo(50, y).lineTo(550, y).stroke();
      y += 5;

      // Draw table rows (sorted by date descending)
      salesData.forEach((sale, index) => {
        if (y > 700) {
          doc.addPage();
          y = 50;
        }
        
        // Alternate row colors
        if (index % 2 === 0) {
          doc.rect(50, y, 500, 18).fill('#F5F5F5');
        }
        
        // Draw row data
        xPos = 55;
        const rowData = [
          sale.saleId,
          sale.invoiceNo.substring(0, 10),
          (sale.orderNo || '—').toString().substring(0, 10),
          sale.date,
          sale.franchise.substring(0, 10),
          sale.franchiseCode,
          sale.customerName,
          `$${sale.revenue.toFixed(2)}`,
          `$${sale.cost.toFixed(2)}`,
          `$${sale.profit.toFixed(2)}`,
          `${sale.margin.toFixed(1)}%`,
        ];
        
        rowData.forEach((data, i) => {
          doc.fillColor(sale.profit < 0 && i === 8 ? '#FF0000' : '#000000')
            .fontSize(8)
            .font('Helvetica')
            .text(data || '', xPos, y + 3, { width: colWidths[i], align: 'left' });
          xPos += colWidths[i];
        });
        
        y += 18;
      });

      // Draw totals row at bottom
      if (y > 700) {
        doc.addPage();
        y = 50;
      }
      
      doc.rect(50, y, 500, 20).fill('#D0D0D0');
      doc.font('Helvetica-Bold').fontSize(9);
      xPos = 55;
      const totalsData = [
        'TOTALS',
        '',
        '',
        '',
        '',
        '',
        '',
        `$${totalRevenue.toFixed(2)}`,
        `$${finalCogs.toFixed(2)}`,
        `$${netProfit.toFixed(2)}`,
        `${netMargin.toFixed(1)}%`,
      ];
      
      totalsData.forEach((data, i) => {
        doc.text(data || '', xPos, y + 5, { width: colWidths[i], align: 'left' });
        xPos += colWidths[i];
      });

      doc.end();
      return;
    }

    // Default: return JSON
    res.status(200).json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error('Error generating profit & loss report:', error);
    
    // Update audit log on error
    if (auditLog) {
      auditLog.status = 'failed';
      auditLog.completedAt = new Date();
      auditLog.duration = Date.now() - (auditLog.startedAt?.getTime() || Date.now());
      auditLog.errors.push({
        row: 0,
        field: 'export',
        message: error.message || 'Export failed',
        value: null
      });
      await auditLog.save().catch(console.error);
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to generate profit & loss report',
      error: error.message,
    });
  }
};