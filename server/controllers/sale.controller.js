import { Sale } from '../models/Sale.model.js';
import { Product } from '../models/Product.model.js';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';

export const getAllSales = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const { startDate, endDate, type, paymentMethod, status, search, franchise, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    const query = {};

    // STRICT FRANCHISE SCOPING: Filter by franchise if provided
    if (franchise) {
      query.franchise = franchise;
    }

    // Date range filter (defensive parsing)
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        const d = new Date(startDate);
        if (!Number.isNaN(d.getTime())) query.createdAt.$gte = d;
      }
      if (endDate) {
        const d = new Date(endDate);
        if (!Number.isNaN(d.getTime())) query.createdAt.$lte = d;
      }
    }

    if (type) query.saleType = type;
    if (paymentMethod) query.paymentMethod = paymentMethod;
    if (status) query.status = status;

    if (search && String(search).trim()) {
      query.$or = [
        { invoiceNumber: { $regex: String(search).trim(), $options: 'i' } },
        { customerName: { $regex: String(search).trim(), $options: 'i' } },
        { customerEmail: { $regex: String(search).trim(), $options: 'i' } },
      ];
    }

    const sortOptions = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    // STRICT FRANCHISE SCOPING: Query already filtered by franchise if provided
    const [sales, total] = await Promise.all([
      Sale.find(query)
        .sort(sortOptions)
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('items.product', 'name sku')
        .lean(),
      Sale.countDocuments(query),
    ]);

    // Calculate summary - STRICTLY SCOPED BY FRANCHISE
    const summaryAgg = await Sale.aggregate([
      { $match: query }, // Query already includes franchise filter if provided
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$grandTotal' },
          totalProfit: { $sum: '$totalProfit' },
          totalSales: { $sum: 1 },
          avgOrderValue: { $avg: '$grandTotal' },
        },
      },
    ]);
    
    const summary = summaryAgg[0] || {
      totalRevenue: 0,
      totalProfit: 0,
      totalSales: 0,
      avgOrderValue: 0,
    };

    res.status(200).json({
      success: true,
      data: {
        sales,
        summary: summary || {
          totalRevenue: 0,
          totalProfit: 0,
          totalSales: 0,
          avgOrderValue: 0,
        },
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit) || 1,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sales',
      error: error.message,
    });
  }
};

export const createSale = async (req, res) => {
  try {
    const {
      items,
      customerName,
      customerEmail,
      paymentMethod,
      saleType,
      notes,
    } = req.body;

    // Validate required fields
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one item is required',
      });
    }

    const validPaymentMethods = ['cash', 'card', 'upi', 'bank_transfer', 'credit'];
    if (!paymentMethod || !validPaymentMethods.includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: 'Valid payment method is required',
      });
    }

    const validSaleTypes = ['online', 'offline'];
    if (!saleType || !validSaleTypes.includes(saleType)) {
      return res.status(400).json({
        success: false,
        message: 'Sale type must be online or offline',
      });
    }

    // Normalize items: ensure product and quantity exist and are valid
    for (const item of items) {
      if (!item.product) {
        return res.status(400).json({
          success: false,
          message: 'Each item must have a product id',
        });
      }
      const qty = Number(item.quantity);
      if (!Number.isInteger(qty) || qty < 1) {
        return res.status(400).json({
          success: false,
          message: `Invalid quantity for product ${item.product}`,
        });
      }
      item.quantity = qty;
    }

    // STRICT FRANCHISE SCOPING: Determine franchise from products
    let saleFranchise = null;
    const user = req.user;
    
    // Validate items and attach product data
    for (const item of items) {
      const product = await Product.findById(item.product);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: `Product ${item.product} not found`,
        });
      }
      if (product.stockQuantity < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.name}`,
        });
      }

      // STRICT FRANCHISE SCOPING: Set franchise from first product
      // All products in a sale must belong to the same franchise
      if (!saleFranchise) {
        saleFranchise = product.franchise;
      } else if (product.franchise.toString() !== saleFranchise.toString()) {
        return res.status(400).json({
          success: false,
          message: 'All products in a sale must belong to the same franchise',
        });
      }

      // Attach product data to item (ensure numbers for schema)
      item.sku = product.sku;
      item.name = product.name;
      item.buyingPrice = Number(product.buyingPrice);
      item.sellingPrice = Number(item.sellingPrice) || Number(product.sellingPrice);
      item.discount = Number(item.discount) || 0;
      item.tax = Number(item.tax) || 0;
      item.profit = (item.sellingPrice - item.buyingPrice) * item.quantity;
    }

    // Calculate totals so validation passes (pre('save') may run after validation in some Mongoose versions)
    const subTotal = items.reduce((sum, item) => sum + (item.sellingPrice * item.quantity), 0);
    const totalDiscount = items.reduce((sum, item) =>
      sum + (item.sellingPrice * item.quantity * (item.discount / 100)), 0);
    const totalTax = items.reduce((sum, item) =>
      sum + (item.sellingPrice * item.quantity * (1 - item.discount / 100) * (item.tax / 100)), 0);
    const grandTotal = subTotal - totalDiscount + totalTax;
    const totalProfit = items.reduce((sum, item) => sum + item.profit, 0);

    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const invoiceNumber = `INV-${year}${month}${day}-${random}`;

    // STRICT FRANCHISE SCOPING: Ensure franchise is set
    if (!saleFranchise) {
      // Fallback: use user's franchise if available
      if (user && user.franchises && user.franchises.length > 0) {
        saleFranchise = user.franchises[0];
      } else {
        return res.status(400).json({
          success: false,
          message: 'Unable to determine franchise for sale',
        });
      }
    }

    const saleDoc = {
      items,
      customerName: customerName?.trim() || undefined,
      customerEmail: customerEmail?.trim() || undefined,
      paymentMethod,
      saleType,
      notes: notes?.trim() || undefined,
      status: 'completed',
      invoiceNumber,
      subTotal,
      totalDiscount,
      totalTax,
      grandTotal,
      totalProfit,
      franchise: saleFranchise, // STRICT FRANCHISE SCOPING
    };

    const sale = await Sale.create(saleDoc);

    res.status(201).json({
      success: true,
      data: sale,
      message: 'Sale completed successfully',
    });
  } catch (error) {
    console.error('Create sale error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create sale',
      error: error.message,
    });
  }
};

export const getSaleById = async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id)
      .populate('items.product', 'name sku category images')
      .lean();

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found',
      });
    }

    res.status(200).json({
      success: true,
      data: sale,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sale',
      error: error.message,
    });
  }
};

export const refundSale = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, reason } = req.body;

    const sale = await Sale.findById(id);

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found',
      });
    }

    if (sale.status === 'refunded') {
      return res.status(400).json({
        success: false,
        message: 'Sale already refunded',
      });
    }

    // Validate refund amount
    const maxRefund = sale.grandTotal - sale.refundedAmount;
    if (amount > maxRefund) {
      return res.status(400).json({
        success: false,
        message: `Maximum refund amount is ${maxRefund}`,
      });
    }

    // Update sale
    sale.refundedAmount += amount;
    sale.refundReason = reason;
    
    if (sale.refundedAmount >= sale.grandTotal) {
      sale.status = 'refunded';
    }

    // Restore stock for items
    for (const item of sale.items) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: {
          stockQuantity: item.quantity,
          totalSold: -item.quantity,
          totalRevenue: -(item.sellingPrice * item.quantity),
          totalProfit: -item.profit,
        },
      });
    }

    await sale.save();

    res.status(200).json({
      success: true,
      data: sale,
      message: 'Refund processed successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to process refund',
      error: error.message,
    });
  }
};

export const generateInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const sale = await Sale.findById(id).populate('items.product');

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found',
      });
    }

    // Create PDF document
    const doc = new PDFDocument({ margin: 50 });
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=invoice-${sale.invoiceNumber}.pdf`
    );

    // Pipe PDF to response
    doc.pipe(res);

    // Add company logo and info
    doc.fontSize(20).text('INVENTORY PRO', 50, 50);
    doc.fontSize(10).text('123 Business Street', 50, 80);
    doc.text('City, State 12345', 50, 95);
    doc.text('Phone: (123) 456-7890', 50, 110);
    doc.text('Email: info@inventorypro.com', 50, 125);

    // Invoice header
    doc.fontSize(25).text('INVOICE', 400, 50);
    doc.fontSize(10);
    doc.text(`Invoice #: ${sale.invoiceNumber}`, 400, 85);
    doc.text(`Date: ${new Date(sale.createdAt).toLocaleDateString()}`, 400, 100);
    doc.text(`Status: ${sale.status.toUpperCase()}`, 400, 115);

    // Customer info
    doc.fontSize(12).text('BILL TO:', 50, 150);
    doc.fontSize(10);
    doc.text(sale.customerName || 'Walk-in Customer', 50, 170);
    if (sale.customerEmail) {
      doc.text(sale.customerEmail, 50, 185);
    }

    // Table headers
    const tableTop = 230;
    doc.fontSize(10);
    doc.text('Description', 50, tableTop);
    doc.text('Quantity', 250, tableTop);
    doc.text('Price', 350, tableTop);
    doc.text('Amount', 450, tableTop);

    // Table rows
    let y = tableTop + 20;
    sale.items.forEach((item, i) => {
      doc.text(item.name, 50, y);
      doc.text(item.quantity.toString(), 250, y);
      doc.text(`$${item.sellingPrice.toFixed(2)}`, 350, y);
      doc.text(`$${(item.sellingPrice * item.quantity).toFixed(2)}`, 450, y);
      y += 20;
    });

    // Totals
    y += 20;
    doc.text('Subtotal:', 350, y);
    doc.text(`$${sale.subTotal.toFixed(2)}`, 450, y);
    
    y += 20;
    doc.text(`Discount (${sale.totalDiscount}):`, 350, y);
    doc.text(`-$${sale.totalDiscount.toFixed(2)}`, 450, y);
    
    y += 20;
    doc.text(`Tax (${sale.totalTax}):`, 350, y);
    doc.text(`$${sale.totalTax.toFixed(2)}`, 450, y);
    
    y += 30;
    doc.fontSize(12).font('Helvetica-Bold');
    doc.text('GRAND TOTAL:', 350, y);
    doc.text(`$${sale.grandTotal.toFixed(2)}`, 450, y);

    // Footer
    doc.fontSize(8).font('Helvetica');
    doc.text('Thank you for your business!', 50, 700);
    doc.text('Terms & Conditions: Payment due within 30 days', 50, 720);

    doc.end();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to generate invoice',
      error: error.message,
    });
  }
};

export const exportSalesReport = async (req, res) => {
  try {
    const { startDate, endDate, format = 'excel' } = req.query;

    const query = {};
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const sales = await Sale.find(query).lean();

    if (format === 'excel') {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Sales Report');

      // Add headers
      worksheet.columns = [
        { header: 'Invoice #', key: 'invoiceNumber', width: 20 },
        { header: 'Date', key: 'date', width: 15 },
        { header: 'Customer', key: 'customer', width: 25 },
        { header: 'Type', key: 'type', width: 10 },
        { header: 'Payment', key: 'payment', width: 15 },
        { header: 'Items', key: 'items', width: 10 },
        { header: 'Subtotal', key: 'subtotal', width: 15 },
        { header: 'Discount', key: 'discount', width: 15 },
        { header: 'Tax', key: 'tax', width: 15 },
        { header: 'Total', key: 'total', width: 15 },
        { header: 'Profit', key: 'profit', width: 15 },
        { header: 'Status', key: 'status', width: 12 },
      ];

      // Add rows
      sales.forEach(sale => {
        worksheet.addRow({
          invoiceNumber: sale.invoiceNumber,
          date: new Date(sale.createdAt).toLocaleDateString(),
          customer: sale.customerName || 'N/A',
          type: sale.saleType,
          payment: sale.paymentMethod,
          items: sale.items.reduce((sum, item) => sum + item.quantity, 0),
          subtotal: sale.subTotal,
          discount: sale.totalDiscount,
          tax: sale.totalTax,
          total: sale.grandTotal,
          profit: sale.totalProfit,
          status: sale.status,
        });
      });

      // Add summary row
      worksheet.addRow([]);
      const summaryRow = worksheet.addRow({
        invoiceNumber: 'SUMMARY',
        total: sales.reduce((sum, sale) => sum + sale.grandTotal, 0),
        profit: sales.reduce((sum, sale) => sum + sale.totalProfit, 0),
      });
      summaryRow.font = { bold: true };

      // Set response headers
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
    } else if (format === 'csv') {
      // CSV export implementation
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=sales-report.csv');
      
      // CSV header
      const headers = [
        'Invoice #', 'Date', 'Customer', 'Type', 'Payment',
        'Items', 'Subtotal', 'Discount', 'Tax', 'Total', 'Profit', 'Status'
      ];
      res.write(headers.join(',') + '\n');
      
      // CSV rows
      sales.forEach(sale => {
        const row = [
          sale.invoiceNumber,
          new Date(sale.createdAt).toLocaleDateString(),
          sale.customerName || 'N/A',
          sale.saleType,
          sale.paymentMethod,
          sale.items.reduce((sum, item) => sum + item.quantity, 0),
          sale.subTotal,
          sale.totalDiscount,
          sale.totalTax,
          sale.grandTotal,
          sale.totalProfit,
          sale.status,
        ].map(field => `"${field}"`).join(',');
        
        res.write(row + '\n');
      });
      
      res.end();
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to export sales report',
      error: error.message,
    });
  }
};

export const getSalesSummary = async (req, res) => {
  try {
    const { period = 'today' } = req.query;
    let startDate, endDate;

    const now = new Date();
    switch (period) {
      case 'today':
        startDate = new Date(now.setHours(0, 0, 0, 0));
        endDate = new Date(now.setHours(23, 59, 59, 999));
        break;
      case 'yesterday':
        startDate = new Date(now.setDate(now.getDate() - 1));
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'week':
        startDate = new Date(now.setDate(now.getDate() - 7));
        endDate = new Date();
        break;
      case 'month':
        startDate = new Date(now.setMonth(now.getMonth() - 1));
        endDate = new Date();
        break;
      default:
        startDate = new Date(period);
        endDate = new Date();
    }

    const summary = await Sale.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: 'completed',
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$grandTotal' },
          totalProfit: { $sum: '$totalProfit' },
          totalSales: { $sum: 1 },
          onlineSales: {
            $sum: { $cond: [{ $eq: ['$saleType', 'online'] }, '$grandTotal', 0] },
          },
          offlineSales: {
            $sum: { $cond: [{ $eq: ['$saleType', 'offline'] }, '$grandTotal', 0] },
          },
          onlineCount: {
            $sum: { $cond: [{ $eq: ['$saleType', 'online'] }, 1, 0] },
          },
          offlineCount: {
            $sum: { $cond: [{ $eq: ['$saleType', 'offline'] }, 1, 0] },
          },
          avgOrderValue: { $avg: '$grandTotal' },
        },
      },
    ]);

    // Get top products
    const topProducts = await Sale.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: 'completed',
        },
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          name: { $first: '$items.name' },
          sku: { $first: '$items.sku' },
          quantitySold: { $sum: '$items.quantity' },
          revenue: { $sum: { $multiply: ['$items.sellingPrice', '$items.quantity'] } },
          profit: { $sum: '$items.profit' },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 5 },
    ]);

    res.status(200).json({
      success: true,
      data: {
        summary: summary[0] || {
          totalRevenue: 0,
          totalProfit: 0,
          totalSales: 0,
          onlineSales: 0,
          offlineSales: 0,
          onlineCount: 0,
          offlineCount: 0,
          avgOrderValue: 0,
        },
        topProducts,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sales summary',
      error: error.message,
    });
  }
};