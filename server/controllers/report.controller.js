import mongoose from 'mongoose';
import { Product } from '../models/Product.model.js';
import { Sale } from '../models/Sale.model.js';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';

export const generateSalesReport = async (req, res) => {
  try {
    const { startDate, endDate, format: reportFormat = 'excel' } = req.query;

    const query = {
      createdAt: {
        $gte: new Date(startDate || subMonths(new Date(), 1)),
        $lte: new Date(endDate || new Date()),
      },
      status: 'completed',
    };

    const sales = await Sale.find(query)
      .populate('items.product', 'name sku category')
      .lean();

    // Aggregated data
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
          summary: aggregated[0] || {},
          dailyTrend,
          categoryPerformance,
          sales: sales.map(s => ({
            invoice: s.invoiceNumber,
            date: s.createdAt,
            total: s.grandTotal,
            profit: s.totalProfit,
            type: s.saleType,
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

    // Check access if franchise is specified
    if (franchise && user.role !== 'admin') {
      const userFranchises = (user.franchises || []).map((f) => f?.toString() || f);
      if (!userFranchises.includes(franchise.toString())) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this franchise',
        });
      }
    }

    // Build query with franchise filter
    const query = {
      createdAt: {
        $gte: new Date(startDate || subMonths(new Date(), 1)),
        $lte: new Date(endDate || new Date()),
      },
      status: 'completed',
    };

    // Filter by franchise if provided
    if (franchise) {
      query.franchise = new mongoose.Types.ObjectId(franchise);
    }

    // Get all completed sales in period (filtered by franchise)
    const sales = await Sale.find(query)
      .populate('items.product', 'name sku category')
      .lean();

    // Calculate Total Revenue
    const totalRevenue = sales.reduce((sum, sale) => sum + (sale.grandTotal || 0), 0);

    // Calculate COGS (Cost of Goods Sold) from sale items
    const cogs = sales.reduce((sum, sale) => {
      if (sale.items && Array.isArray(sale.items)) {
        return sum + sale.items.reduce((itemSum, item) => {
          const quantity = item.quantity || 0;
          const buyingPrice = item.buyingPrice || 0;
          return itemSum + (quantity * buyingPrice);
        }, 0);
      }
      return sum;
    }, 0);

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

    // Build response
    const report = {
      summary: {
        totalRevenue,
        cogs,
        grossProfit,
        operatingExpenses,
        netProfit,
        grossMargin,
        netMargin,
      },
      categoryBreakdown: categoryWiseBreakdown,
      period: {
        startDate: startDate || subMonths(new Date(), 1).toISOString(),
        endDate: endDate || new Date().toISOString(),
      },
      franchise: franchise || null,
    };

    res.status(200).json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error('Error generating profit & loss report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate profit & loss report',
      error: error.message,
    });
  }
};