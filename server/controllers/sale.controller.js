import mongoose from 'mongoose';
import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import { Sale } from '../models/Sale.model.js';
import { Product } from '../models/Product.model.js';
import Franchise from '../models/Franchise.js';
import { ImportLog } from '../models/ImportLog.model.js';
import { AuditLog } from '../models/AuditLog.model.js';
import { applyFranchiseFilter } from '../utils/franchiseFilter.js';
import { createSystemNotification } from '../utils/notificationHelper.js';

// Helper function to create audit log from import log
const createAuditLogFromImportLog = async (importLog, req) => {
  if (!importLog) return null;
  
  try {
    const auditLog = new AuditLog({
      actionType: 'import',
      operationType: importLog.importType || 'sales',
      fileName: importLog.fileName,
      fileSize: importLog.fileSize,
      format: 'excel',
      user: importLog.importedBy,
      franchise: importLog.franchise,
      totalRows: importLog.totalRows,
      successfulRows: importLog.successfulRows,
      failedRows: importLog.failedRows,
      skippedRows: importLog.skippedRows,
      status: importLog.status,
      startedAt: importLog.startedAt,
      completedAt: importLog.completedAt,
      duration: importLog.duration,
      errors: importLog.errors,
      warnings: importLog.warnings,
      metadata: importLog.metadata,
      ipAddress: req?.ip || req?.headers?.['x-forwarded-for'] || req?.connection?.remoteAddress,
      userAgent: req?.headers?.['user-agent']
    });
    await auditLog.save();
    return auditLog;
  } catch (error) {
    console.error('Error creating audit log from import log:', error);
    return null;
  }
};
import PDFDocument from 'pdfkit';

export const getAllSales = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const { startDate, endDate, type, paymentMethod, status, search, franchise, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    // Build base query
    const baseQuery = {};

    // Apply franchise filter (admin sees all, manager/sales see only their franchise)
    // If explicit franchise param provided and user is admin, use it; otherwise use user's franchise
    if (req.user && req.user.role === 'admin' && franchise) {
      baseQuery.franchise = franchise;
    } else {
      // Apply franchise isolation filter
      const franchiseFilter = applyFranchiseFilter(req);
      Object.assign(baseQuery, franchiseFilter);
    }

    const query = { ...baseQuery };

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

    // Query already filtered by franchise isolation
    const [sales, total] = await Promise.all([
      Sale.find(query)
        .sort(sortOptions)
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('items.product', 'name sku')
        .lean(),
      Sale.countDocuments(query),
    ]);

    // Calculate summary - scoped by franchise isolation
    const summaryAgg = await Sale.aggregate([
      { $match: query }, // Query already includes franchise filter
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
    // Debug logging removed for cleaner console output
    
    // Check if request body exists
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Invalid request body',
      });
    }
    
    const {
      items,
      franchise,
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

    // FRANCHISE SCOPING: Require franchise in request body
    if (!franchise) {
      return res.status(400).json({
        success: false,
        message: 'Franchise is required for sale creation',
      });
    }

    // Validate franchise is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(franchise)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid franchise ID format',
      });
    }

    // Enforce franchise isolation: non-admin users can only create sales for their franchise
    if (req.user && req.user.role !== 'admin') {
      const userFranchise = req.user.franchise?.toString();
      const saleFranchise = franchise.toString();
      
      if (!userFranchise || userFranchise !== saleFranchise) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: You can only create sales for your assigned franchise',
        });
      }
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
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.product) {
        return res.status(400).json({
          success: false,
          message: 'Each item must have a product id',
        });
      }
      
      // Convert product ID to ObjectId if it's a string
      if (typeof item.product === 'string') {
        if (!mongoose.Types.ObjectId.isValid(item.product)) {
          return res.status(400).json({
            success: false,
            message: `Invalid product ID format: ${item.product}`,
          });
        }
        item.product = new mongoose.Types.ObjectId(item.product);
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

    // FRANCHISE SCOPING: Use franchise from request body (already validated as required)
    const saleFranchise = franchise;
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

      // Products can be sold by any franchise (global products available to all)
      // Stock is shared across franchises, so no franchise validation needed

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

    // FRANCHISE SCOPING: Create sale with franchise from request body
    // Invoice number will be generated by pre-save hook
    // Convert franchise string to ObjectId
    const franchiseObjectId = new mongoose.Types.ObjectId(saleFranchise);
    
    const saleDoc = {
      items,
      customerName: customerName?.trim() || undefined,
      customerEmail: customerEmail?.trim() || undefined,
      paymentMethod,
      saleType,
      notes: notes?.trim() || undefined,
      status: 'completed',
      subTotal,
      totalDiscount,
      totalTax,
      grandTotal,
      totalProfit,
      franchise: franchiseObjectId, // FRANCHISE SCOPING: Converted to ObjectId
    };

    // Creating sale document

    const sale = await Sale.create(saleDoc);

    createSystemNotification({
      title: 'New Sale Created',
      message: sale.invoiceNumber
        ? `Sale ${sale.invoiceNumber} completed successfully`
        : 'A new sale has been created',
      type: 'sale',
      priority: 'medium',
      franchise: franchiseObjectId,
    }).catch(() => {});

    res.status(201).json({
      success: true,
      data: sale,
      message: 'Sale completed successfully',
    });
  } catch (error) {
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    let errorDetails = errorMessage;
    let statusCode = 500;
    
    if (error instanceof Error && error.name === 'ValidationError') {
      const validationErrors = error.errors || {};
      errorDetails = Object.values(validationErrors).map((e) => e.message).join(', ');
      statusCode = 400; // Validation errors should be 400, not 500
    }
    
    res.status(statusCode).json({
      success: false,
      message: 'Failed to create sale',
      error: errorDetails || 'Unknown error occurred',
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

    // Enforce franchise isolation: non-admin users can only access their franchise sales
    if (req.user && req.user.role !== 'admin') {
      const userFranchise = req.user.franchise?.toString();
      const saleFranchise = sale.franchise?.toString();
      
      if (!userFranchise || userFranchise !== saleFranchise) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: You do not have permission to view this sale',
        });
      }
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

    // Enforce franchise isolation: non-admin users can only refund their franchise sales
    if (req.user && req.user.role !== 'admin') {
      const userFranchise = req.user.franchise?.toString();
      const saleFranchise = sale.franchise?.toString();
      
      if (!userFranchise || userFranchise !== saleFranchise) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: You do not have permission to refund this sale',
        });
      }
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

    // Enforce franchise isolation: non-admin users can only generate invoices for their franchise sales
    if (req.user && req.user.role !== 'admin') {
      const userFranchise = req.user.franchise?.toString();
      const saleFranchise = sale.franchise?.toString();
      
      if (!userFranchise || userFranchise !== saleFranchise) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: You do not have permission to generate invoice for this sale',
        });
      }
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

/**
 * Export sales data at line-item level
 * GET /api/sales/export?format=excel|pdf&franchise=...&startDate=...&endDate=...&product=...
 * 
 * Columns: invoiceNo, saleId, date, franchise, productName, productId, qty, revenue, cost, profit
 */
export const exportSalesReport = async (req, res) => {
  try {
    const { 
      format = 'excel', 
      franchise, 
      startDate, 
      endDate, 
      product 
    } = req.query;
    
    const user = req.user;

    // Build query with franchise isolation
    const baseQuery = { status: 'completed' };
    
    // Apply franchise filter (admin sees all, manager/sales see only their franchise)
    if (user && user.role === 'admin' && franchise) {
      baseQuery.franchise = franchise;
    } else {
      // Apply franchise isolation filter
      const franchiseFilter = applyFranchiseFilter(req);
      Object.assign(baseQuery, franchiseFilter);
    }

    const query = { ...baseQuery };
    
    // Date range filter
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
    
    // Product filter (will be applied after unwinding items)
    let productFilter = null;
    if (product && mongoose.Types.ObjectId.isValid(product)) {
      productFilter = new mongoose.Types.ObjectId(product);
    }

    // Fetch sales with populated franchise, items, and order (for order-derived sales)
    const sales = await Sale.find(query)
      .populate('franchise', 'name code')
      .populate('items.product', 'name sku')
      .populate('order', 'orderNumber')
      .sort({ createdAt: -1 })
      .lean();

    // Expand sales into line items (one row per product; includes order-derived sales)
    const lineItems = [];
    sales.forEach(sale => {
      const orderNo = sale.order?.orderNumber ?? '—';
      sale.items.forEach(item => {
        // Apply product filter if specified
        if (productFilter && item.product?._id?.toString() !== productFilter.toString()) {
          return; // Skip this item
        }
        
        const revenue = item.sellingPrice * item.quantity;
        const cost = item.buyingPrice * item.quantity;
        const profit = item.profit || (revenue - cost);
        
        lineItems.push({
          invoiceNo: sale.invoiceNumber,
          orderNo,
          saleId: sale._id.toString(),
          date: new Date(sale.createdAt).toISOString().split('T')[0], // ISO format for sorting
          dateFormatted: new Date(sale.createdAt).toLocaleDateString(), // Formatted for display
          franchise: sale.franchise?.name || 'N/A',
          franchiseCode: sale.franchise?.code || 'N/A',
          productName: item.name || item.product?.name || 'N/A',
          productId: item.product?._id?.toString() || item.product?.toString() || 'N/A',
          productSku: item.sku || item.product?.sku || 'N/A',
          qty: item.quantity,
          revenue: revenue,
          cost: cost,
          profit: profit,
        });
      });
    });

    // Calculate totals
    const totals = {
      totalItems: lineItems.length,
      totalQty: lineItems.reduce((sum, item) => sum + item.qty, 0),
      totalRevenue: lineItems.reduce((sum, item) => sum + item.revenue, 0),
      totalCost: lineItems.reduce((sum, item) => sum + item.cost, 0),
      totalProfit: lineItems.reduce((sum, item) => sum + item.profit, 0),
    };

    // Create audit log entry for export
    const startTime = Date.now();
    const dateStr = startDate ? new Date(startDate).toISOString().slice(0, 10) : 'all';
    const endDateStr = endDate ? new Date(endDate).toISOString().slice(0, 10) : 'all';
    const fileName = `sales-export-${dateStr}_to_${endDateStr}.${format === 'excel' || format === 'xlsx' ? 'xlsx' : format === 'pdf' ? 'pdf' : 'csv'}`;
    let auditLog = new AuditLog({
      actionType: 'export',
      operationType: 'sales',
      fileName: fileName,
      format: format === 'excel' || format === 'xlsx' ? 'excel' : format,
      user: user._id,
      franchise: franchise || null,
      totalRecords: lineItems.length,
      exportedRecords: lineItems.length,
      status: 'processing',
      startedAt: new Date(),
      requestParams: new Map(Object.entries({
        startDate: startDate || 'all',
        endDate: endDate || 'all',
        franchise: franchise || 'all',
        product: product || 'all',
        format: format
      })),
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    });
    await auditLog.save();

    // Generate export based on format
    if (format === 'excel' || format === 'xlsx') {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Sales Export');

      // Define columns (Order # for order-derived sales)
      worksheet.columns = [
        { header: 'Invoice No', key: 'invoiceNo', width: 20 },
        { header: 'Order #', key: 'orderNo', width: 18 },
        { header: 'Sale ID', key: 'saleId', width: 25 },
        { header: 'Date', key: 'date', width: 12 },
        { header: 'Franchise', key: 'franchise', width: 20 },
        { header: 'Product Name', key: 'productName', width: 30 },
        { header: 'Product ID', key: 'productId', width: 25 },
        { header: 'SKU', key: 'productSku', width: 15 },
        { header: 'Quantity', key: 'qty', width: 12 },
        { header: 'Revenue', key: 'revenue', width: 15 },
        { header: 'Cost', key: 'cost', width: 15 },
        { header: 'Profit', key: 'profit', width: 15 },
      ];

      // Style header row
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };

      // Add data rows - Already sorted by date (latest first) from query
      lineItems.forEach(item => {
        const row = worksheet.addRow({
          invoiceNo: item.invoiceNo,
          orderNo: item.orderNo,
          saleId: item.saleId,
          date: item.dateFormatted, // Use formatted date for display
          franchise: item.franchise,
          productName: item.productName,
          productId: item.productId,
          productSku: item.productSku,
          qty: item.qty,
          revenue: item.revenue,
          cost: item.cost,
          profit: item.profit,
        });
        
        // Color code profit (red for negative, green for positive)
        if (item.profit < 0) {
          row.getCell('profit').fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFE0E0' }
          };
        }
      });

      // Add empty row before totals
      worksheet.addRow([]);

      // Add totals row
      const totalsRow = worksheet.addRow({
        invoiceNo: 'TOTALS',
        orderNo: '',
        saleId: '',
        date: '',
        franchise: '',
        productName: '',
        productId: '',
        productSku: '',
        qty: totals.totalQty,
        revenue: totals.totalRevenue,
        cost: totals.totalCost,
        profit: totals.totalProfit,
      });

      totalsRow.font = { bold: true };
      totalsRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD0D0D0' }
      };

      // Set response headers
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=${fileName}`
      );

      // Get file size before writing
      const buffer = await workbook.xlsx.writeBuffer();
      auditLog.fileSize = buffer.length;
      auditLog.status = 'completed';
      auditLog.completedAt = new Date();
      auditLog.duration = Date.now() - startTime;
      auditLog.exportedRecords = lineItems.length;
      await auditLog.save().catch(console.error);

      res.send(buffer);

    } else if (format === 'pdf') {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });

      // Set response headers
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=${fileName}`
      );

      // Track PDF generation for audit log
      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', async () => {
        const buffer = Buffer.concat(chunks);
        auditLog.fileSize = buffer.length;
        auditLog.status = 'completed';
        auditLog.completedAt = new Date();
        auditLog.duration = Date.now() - startTime;
        auditLog.exportedRecords = lineItems.length;
        await auditLog.save().catch(console.error);
      });

      // Pipe PDF to response
      doc.pipe(res);

      // Header
      doc.fontSize(20).text('Sales Export', { align: 'center' });
      doc.moveDown();
      doc.fontSize(10).text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
      doc.moveDown(2);

      // Summary section
      doc.fontSize(14).text('Summary', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10);
      doc.text(`Total Line Items: ${totals.totalItems}`);
      doc.text(`Total Quantity: ${totals.totalQty}`);
      doc.text(`Total Revenue: $${totals.totalRevenue.toFixed(2)}`);
      doc.text(`Total Cost: $${totals.totalCost.toFixed(2)}`);
      doc.text(`Total Profit: $${totals.totalProfit.toFixed(2)}`);
      doc.moveDown(2);

      // Table header
      doc.fontSize(10);
      const tableTop = doc.y;
      const rowHeight = 20;
      const colWidths = [55, 45, 70, 45, 60, 80, 55, 45, 35, 55, 55, 55];
      const headers = ['Invoice', 'Order #', 'Sale ID', 'Date', 'Franchise', 'Product', 'Product ID', 'SKU', 'Qty', 'Revenue', 'Cost', 'Profit'];

      // Draw header background
      doc.rect(50, tableTop, 500, rowHeight).fill('#E0E0E0');

      // Draw header text
      let xPos = 55;
      headers.forEach((header, i) => {
        doc.fillColor('#000000')
          .fontSize(8)
          .font('Helvetica-Bold')
          .text(header, xPos, tableTop + 5, { width: colWidths[i], align: 'left' });
        xPos += colWidths[i];
      });

      // Draw table rows
      let yPos = tableTop + rowHeight;
      lineItems.forEach((item, index) => {
        // Check if we need a new page
        if (yPos > 750) {
          doc.addPage();
          yPos = 50;
        }

        // Alternate row colors
        if (index % 2 === 0) {
          doc.rect(50, yPos, 500, rowHeight).fill('#F5F5F5');
        }

        // Draw row data - Structured format: IDs, Names, Dates, Franchise, Order #
        xPos = 55;
        const rowData = [
          item.invoiceNo.substring(0, 12),
          (item.orderNo || '—').toString().substring(0, 10),
          item.saleId.substring(0, 10),
          item.dateFormatted || item.date, // Use formatted date
          item.franchise.substring(0, 12),
          item.productName.substring(0, 15),
          item.productId.substring(0, 10),
          item.productSku.substring(0, 8),
          item.qty.toString(),
          `$${item.revenue.toFixed(2)}`,
          `$${item.cost.toFixed(2)}`,
          `$${item.profit.toFixed(2)}`,
        ];

        rowData.forEach((data, i) => {
          doc.fillColor('#000000')
            .fontSize(7)
            .font('Helvetica')
            .text(data || '', xPos, yPos + 5, { width: colWidths[i], align: 'left' });
          xPos += colWidths[i];
        });

        yPos += rowHeight;
      });

      // Draw totals row
      if (yPos > 750) {
        doc.addPage();
        yPos = 50;
      }

      doc.rect(50, yPos, 500, rowHeight).fill('#D0D0D0');
      doc.font('Helvetica-Bold').fontSize(8);
      xPos = 55;
      const totalsData = [
        'TOTALS',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        totals.totalQty.toString(),
        `$${totals.totalRevenue.toFixed(2)}`,
        `$${totals.totalCost.toFixed(2)}`,
        `$${totals.totalProfit.toFixed(2)}`,
      ];

      totalsData.forEach((data, i) => {
        doc.text(data || '', xPos, yPos + 5, { width: colWidths[i], align: 'left' });
        xPos += colWidths[i];
      });

      // Finalize PDF
      doc.end();

    } else if (format === 'csv') {
      // CSV export implementation
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=sales-export-${new Date().toISOString().split('T')[0]}.csv`
      );

      // CSV header (includes Order # for order-derived sales)
      const csvHeaders = [
        'Invoice No', 'Order #', 'Sale ID', 'Date', 'Franchise', 'Product Name',
        'Product ID', 'SKU', 'Quantity', 'Revenue', 'Cost', 'Profit'
      ];
      res.write(csvHeaders.join(',') + '\n');

      // CSV rows
      lineItems.forEach(item => {
        const row = [
          item.invoiceNo,
          item.orderNo ?? '—',
          item.saleId,
          item.date,
          item.franchise,
          item.productName,
          item.productId,
          item.productSku,
          item.qty,
          item.revenue,
          item.cost,
          item.profit,
        ].map(field => `"${String(field)}"`).join(',');
        res.write(row + '\n');
      });

      // Totals row
      res.write('\n');
      const totalsRow = [
        'TOTALS',
        '',
        '',
        '',
        '',
        '',
        '',
        totals.totalQty,
        totals.totalRevenue,
        totals.totalCost,
        totals.totalProfit,
      ].map(field => `"${String(field)}"`).join(',');
      res.write(totalsRow + '\n');

      // Update audit log for CSV export
      auditLog.fileSize = 0; // CSV size not tracked
      auditLog.status = 'completed';
      auditLog.completedAt = new Date();
      auditLog.duration = Date.now() - startTime;
      auditLog.exportedRecords = lineItems.length;
      await auditLog.save().catch(console.error);

      res.end();
    } else {
      // Update audit log for invalid format
      if (auditLog) {
        auditLog.status = 'failed';
        auditLog.completedAt = new Date();
        auditLog.duration = Date.now() - startTime;
        auditLog.errors.push({
          row: 0,
          field: 'format',
          message: `Invalid format: ${format}. Supported formats: excel, xlsx, pdf, csv`,
          value: format
        });
        await auditLog.save().catch(console.error);
      }

      return res.status(400).json({
        success: false,
        message: 'Invalid format. Supported formats: excel, xlsx, pdf, csv'
      });
    }
  } catch (error) {
    console.error('Error exporting sales:', error);
    
    // Update audit log on error
    if (typeof auditLog !== 'undefined' && auditLog) {
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
      message: 'Failed to export sales report',
      error: error.message,
    });
  }
};

export const getSalesSummary = async (req, res) => {
  try {
    const { period = 'today', franchise } = req.query;
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

    // Build date match with franchise isolation
    const baseDateMatch = {
      createdAt: { $gte: startDate, $lte: endDate },
      status: 'completed',
    };
    
    // Apply franchise filter (admin sees all, manager/sales see only their franchise)
    if (req.user && req.user.role === 'admin' && franchise) {
      baseDateMatch.franchise = franchise;
    } else {
      // Apply franchise isolation filter
      const franchiseFilter = applyFranchiseFilter(req);
      Object.assign(baseDateMatch, franchiseFilter);
    }
    
    const dateMatch = baseDateMatch;

    const summary = await Sale.aggregate([
      {
        $match: dateMatch,
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

    // Get top products (STRICT FRANCHISE SCOPING: same match as summary)
    const topProducts = await Sale.aggregate([
      {
        $match: dateMatch,
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

/**
 * Import sales from Excel file (legacy data import)
 * POST /api/sales/import
 * 
 * Expected Excel columns:
 * - invoiceNo (required, used to group items into sales)
 * - saleDate (required, ISO date format)
 * - franchiseId (required, ObjectId)
 * - productId (required, ObjectId)
 * - productSku (optional, for validation)
 * - quantity (required, >= 1)
 * - sellingPrice (required, >= 0)
 * - buyingPrice (optional, will use product's buyingPrice if not provided)
 * - discount (optional, 0-100)
 * - tax (optional, 0-100)
 * - customerName (optional)
 * - customerEmail (optional)
 * - paymentMethod (required: cash, card, upi, bank_transfer, credit)
 * - saleType (required: online, offline)
 * - notes (optional)
 * 
 * Features:
 * - Auto-calculates profit: (sellingPrice - buyingPrice) * quantity
 * - Validates franchise ownership
 * - Marks sales as imported (adds note)
 * - Groups rows by invoice number
 */
export const importSales = async (req, res) => {
  const startTime = Date.now();
  let importLog = null;

  try {
    const { user } = req;

    // Check if file exists
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded. Please upload an Excel (.xlsx) file.',
      });
    }

    // Validate file type
    const isExcel = req.file.mimetype.includes('spreadsheet') || 
                   req.file.originalname.endsWith('.xlsx') || 
                   req.file.originalname.endsWith('.xls');
    const isCSV = req.file.mimetype === 'text/csv' || 
                  req.file.originalname.endsWith('.csv');
    
    if (!isExcel && !isCSV) {
      return res.status(400).json({
        success: false,
        message: 'Invalid file type. Please upload an Excel (.xlsx, .xls) or CSV (.csv) file.',
      });
    }

    // Create import log
    importLog = new ImportLog({
      importType: 'sales',
      fileName: req.file.originalname,
      fileSize: req.file.size,
      totalRows: 0,
      successfulRows: 0,
      failedRows: 0,
      skippedRows: 0,
      errors: [],
      warnings: [],
      importedBy: user._id,
      franchise: null, // Will be set after validation
      status: 'processing',
    });

    // Parse file (Excel or CSV)
    let headers = {};
    let rowDataArray = [];

    if (isCSV) {
      // Parse CSV file
      const csvContent = req.file.buffer.toString('utf-8');
      const lines = csvContent.split('\n').filter(line => line.trim().length > 0);
      
      if (lines.length === 0) {
        throw new Error('CSV file is empty');
      }

      // Parse header row
      const headerLine = lines[0];
      const headerValues = headerLine.split(',').map(h => h.trim().toLowerCase());
      headerValues.forEach((header, index) => {
        if (header) {
          headers[header] = index;
        }
      });

      // Parse data rows
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        // Handle CSV with quoted values
        const values = [];
        let currentValue = '';
        let inQuotes = false;
        
        for (let j = 0; j < line.length; j++) {
          const char = line[j];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            values.push(currentValue.trim());
            currentValue = '';
          } else {
            currentValue += char;
          }
        }
        values.push(currentValue.trim()); // Add last value
        
        rowDataArray.push({ rowNumber: i + 1, values });
      }
    } else {
      // Parse Excel file
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(req.file.buffer);
      const worksheet = workbook.getWorksheet(1); // Get first worksheet

      if (!worksheet) {
        throw new Error('Excel file is empty or has no worksheets');
      }

      // Get header row (row 1)
      const headerRow = worksheet.getRow(1);
      headerRow.eachCell((cell, colNumber) => {
        const headerValue = cell.value?.toString().toLowerCase().trim();
        if (headerValue) {
          headers[headerValue] = colNumber;
        }
      });

      // Store worksheet reference for Excel processing
      rowDataArray = worksheet;
    }

    // Validate required columns
    const requiredColumns = ['invoiceno', 'saledate', 'franchiseid', 'productid', 'quantity', 'sellingprice', 'paymentmethod', 'saletype'];
    const missingColumns = requiredColumns.filter(col => !headers[col]);
    
    if (missingColumns.length > 0) {
      throw new Error(`Missing required columns: ${missingColumns.join(', ')}`);
    }

    // Process rows (skip header row)
    const rowDataMap = new Map(); // invoiceNo -> array of items
    const errors = [];
    const warnings = [];
    let skippedCount = 0;

    // Process row function
    const processRow = (rowData, rowNumber) => {
      let hasData = false;
      
      // Ensure all values are strings first
      Object.keys(rowData).forEach(key => {
        if (rowData[key] !== null && rowData[key] !== undefined) {
          rowData[key] = rowData[key].toString().trim();
        } else {
          rowData[key] = '';
        }
      });
      
      // Check if row has any data
      Object.values(rowData).forEach(value => {
        if (value && value.toString().trim().length > 0) {
          hasData = true;
        }
      });

      // Skip empty rows
      if (!hasData) {
        skippedCount++;
        return;
      }

      const rowErrors = [];

      // Validate invoiceNo
      const invoiceNo = rowData['invoiceno']?.toUpperCase().trim();
      if (!invoiceNo || invoiceNo.length === 0) {
        rowErrors.push({ field: 'invoiceNo', message: 'Invoice number is required', value: invoiceNo });
      }

      // Validate saleDate
      const saleDateStr = rowData['saledate'];
      let saleDate = null;
      if (saleDateStr) {
        saleDate = new Date(saleDateStr);
        if (isNaN(saleDate.getTime())) {
          rowErrors.push({ field: 'saleDate', message: 'Invalid date format', value: saleDateStr });
        }
      } else {
        rowErrors.push({ field: 'saleDate', message: 'Sale date is required', value: saleDateStr });
      }

      // Validate franchiseId
      const franchiseId = rowData['franchiseid'];
      if (!franchiseId || !mongoose.Types.ObjectId.isValid(franchiseId)) {
        rowErrors.push({ field: 'franchiseId', message: 'Valid franchise ID is required', value: franchiseId });
      }

      // Check user access to franchise
      if (franchiseId && mongoose.Types.ObjectId.isValid(franchiseId)) {
        if (user.role !== 'admin' && !user.franchises?.some(f => f.toString() === franchiseId)) {
          rowErrors.push({
            field: 'franchiseId',
            message: 'Access denied to this franchise',
            value: franchiseId,
          });
        }
      }

      // Validate productId
      const productId = rowData['productid'];
      if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
        rowErrors.push({ field: 'productId', message: 'Valid product ID is required', value: productId });
      }

      // Validate quantity
      const quantity = parseFloat(rowData['quantity']);
      if (isNaN(quantity) || quantity < 1 || !Number.isInteger(quantity)) {
        rowErrors.push({
          field: 'quantity',
          message: 'Quantity must be an integer >= 1',
          value: rowData['quantity'],
        });
      }

      // Validate sellingPrice
      const sellingPrice = parseFloat(rowData['sellingprice']);
      if (isNaN(sellingPrice) || sellingPrice < 0) {
        rowErrors.push({
          field: 'sellingPrice',
          message: 'Selling price must be a number >= 0',
          value: rowData['sellingprice'],
        });
      }

      // Validate buyingPrice (optional)
      let buyingPrice = null;
      if (rowData['buyingprice']) {
        buyingPrice = parseFloat(rowData['buyingprice']);
        if (isNaN(buyingPrice) || buyingPrice < 0) {
          rowErrors.push({
            field: 'buyingPrice',
            message: 'Buying price must be a number >= 0',
            value: rowData['buyingprice'],
          });
        }
      }

      // Validate discount (optional)
      let discount = 0;
      if (rowData['discount']) {
        discount = parseFloat(rowData['discount']);
        if (isNaN(discount) || discount < 0 || discount > 100) {
          rowErrors.push({
            field: 'discount',
            message: 'Discount must be a number between 0 and 100',
            value: rowData['discount'],
          });
        }
      }

      // Validate tax (optional)
      let tax = 0;
      if (rowData['tax']) {
        tax = parseFloat(rowData['tax']);
        if (isNaN(tax) || tax < 0 || tax > 100) {
          rowErrors.push({
            field: 'tax',
            message: 'Tax must be a number between 0 and 100',
            value: rowData['tax'],
          });
        }
      }

      // Validate paymentMethod
      const validPaymentMethods = ['cash', 'card', 'upi', 'bank_transfer', 'credit'];
      const paymentMethod = rowData['paymentmethod']?.toLowerCase();
      if (!paymentMethod || !validPaymentMethods.includes(paymentMethod)) {
        rowErrors.push({
          field: 'paymentMethod',
          message: `Payment method must be one of: ${validPaymentMethods.join(', ')}`,
          value: rowData['paymentmethod'],
        });
      }

      // Validate saleType
      const validSaleTypes = ['online', 'offline'];
      const saleType = rowData['saletype']?.toLowerCase();
      if (!saleType || !validSaleTypes.includes(saleType)) {
        rowErrors.push({
          field: 'saleType',
          message: `Sale type must be one of: ${validSaleTypes.join(', ')}`,
          value: rowData['saletype'],
        });
      }

      // If there are errors, add to errors array and skip processing
      if (rowErrors.length > 0) {
        errors.push({
          row: rowNumber,
          field: rowErrors[0].field,
          message: rowErrors.map(e => e.message).join('; '),
          value: rowErrors[0].value,
        });
        return;
      }

      // Group by invoice number
      if (!rowDataMap.has(invoiceNo)) {
        rowDataMap.set(invoiceNo, {
          invoiceNo,
          saleDate,
          franchiseId: new mongoose.Types.ObjectId(franchiseId),
          customerName: rowData['customername'] || '',
          customerEmail: rowData['customeremail'] || '',
          paymentMethod,
          saleType,
          notes: rowData['notes'] || '',
          items: [],
        });
      }

      // Add item to sale
      rowDataMap.get(invoiceNo).items.push({
        productId: new mongoose.Types.ObjectId(productId),
        productSku: rowData['productsku'] || '',
        quantity: Math.floor(quantity),
        sellingPrice,
        buyingPrice, // Will be fetched from product if not provided
        discount,
        tax,
      });
    };

    // Process rows based on file type
    if (isCSV) {
      // Process CSV rows
      rowDataArray.forEach(({ rowNumber, values }) => {
        const rowData = {};
        Object.keys(headers).forEach(header => {
          const index = headers[header];
          rowData[header] = values[index] || '';
        });
        processRow(rowData, rowNumber);
      });
    } else {
      // Process Excel rows
      rowDataArray.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Skip header row

        const rowData = {};
        // Extract cell values
        Object.keys(headers).forEach(header => {
          const cell = row.getCell(headers[header]);
          const value = cell.value;
          rowData[header] = value !== null && value !== undefined ? value.toString().trim() : '';
        });
        processRow(rowData, rowNumber);
      });
    }

    importLog.totalRows = isCSV 
      ? rowDataArray.length // CSV: number of data rows
      : rowDataArray.rowCount - 1; // Excel: exclude header
    importLog.skippedRows = skippedCount;

    // Process sales
    const processedSales = [];
    let successfulCount = 0;
    let failedCount = 0;

    for (const [invoiceNo, saleData] of rowDataMap.entries()) {
      try {
        // Validate franchise exists
        const franchise = await Franchise.findById(saleData.franchiseId);
        if (!franchise) {
          errors.push({
            row: 0,
            field: 'franchiseId',
            message: `Franchise not found: ${saleData.franchiseId}`,
            value: saleData.franchiseId.toString(),
          });
          failedCount++;
          continue;
        }

        // Set franchise for import log (use first valid franchise)
        if (!importLog.franchise) {
          importLog.franchise = saleData.franchiseId;
        }

        // Validate and enrich items with product data
        const enrichedItems = [];
        let saleFranchise = null;

        for (const item of saleData.items) {
          // Fetch product
          const product = await Product.findById(item.productId);
          if (!product) {
            errors.push({
              row: 0,
              field: 'productId',
              message: `Product not found: ${item.productId}`,
              value: item.productId.toString(),
            });
            continue;
          }

          // Validate franchise ownership - all products must belong to the sale's franchise
          if (!saleFranchise) {
            saleFranchise = product.franchise;
          } else if (product.franchise.toString() !== saleFranchise.toString()) {
            errors.push({
              row: 0,
              field: 'productId',
              message: `Product ${product.name} belongs to different franchise`,
              value: item.productId.toString(),
            });
            continue;
          }

          // Ensure sale franchise matches product franchise
          if (saleFranchise.toString() !== saleData.franchiseId.toString()) {
            errors.push({
              row: 0,
              field: 'franchiseId',
              message: `Sale franchise does not match product franchise`,
              value: saleData.franchiseId.toString(),
            });
            continue;
          }

          // Use product's buyingPrice if not provided in import
          const finalBuyingPrice = item.buyingPrice !== null ? item.buyingPrice : product.buyingPrice;

          // Auto-calculate profit
          const profit = (item.sellingPrice - finalBuyingPrice) * item.quantity;

          enrichedItems.push({
            product: item.productId,
            sku: item.productSku || product.sku,
            name: product.name,
            quantity: item.quantity,
            buyingPrice: finalBuyingPrice,
            sellingPrice: item.sellingPrice,
            discount: item.discount,
            tax: item.tax,
            profit: profit,
          });
        }

        if (enrichedItems.length === 0) {
          errors.push({
            row: 0,
            field: 'items',
            message: `No valid items for sale ${invoiceNo}`,
            value: invoiceNo,
          });
          failedCount++;
          continue;
        }

        // Calculate totals
        const subTotal = enrichedItems.reduce((sum, item) => sum + (item.sellingPrice * item.quantity), 0);
        const totalDiscount = enrichedItems.reduce((sum, item) =>
          sum + (item.sellingPrice * item.quantity * (item.discount / 100)), 0);
        const totalTax = enrichedItems.reduce((sum, item) =>
          sum + (item.sellingPrice * item.quantity * (1 - item.discount / 100) * (item.tax / 100)), 0);
        const grandTotal = subTotal - totalDiscount + totalTax;
        const totalProfit = enrichedItems.reduce((sum, item) => sum + item.profit, 0);

        // Check if invoice number already exists
        const existingSale = await Sale.findOne({ invoiceNumber: invoiceNo });
        if (existingSale) {
          warnings.push({
            row: 0,
            field: 'invoiceNo',
            message: `Invoice number ${invoiceNo} already exists, skipping`,
            value: invoiceNo,
          });
          failedCount++;
          continue;
        }

        // Create sale with imported flag in notes
        const saleNotes = saleData.notes 
          ? `${saleData.notes}\n[Imported on ${new Date().toLocaleString()}]`
          : `[Imported on ${new Date().toLocaleString()}]`;

        const sale = await Sale.create({
          invoiceNumber: invoiceNo,
          items: enrichedItems,
          customerName: saleData.customerName || undefined,
          customerEmail: saleData.customerEmail || undefined,
          paymentMethod: saleData.paymentMethod,
          saleType: saleData.saleType,
          status: 'completed',
          notes: saleNotes,
          subTotal,
          totalDiscount,
          totalTax,
          grandTotal,
          totalProfit,
          franchise: saleData.franchiseId,
          createdAt: saleData.saleDate || new Date(),
        });

        processedSales.push({
          saleId: sale._id,
          invoiceNumber: sale.invoiceNumber,
          itemsCount: enrichedItems.length,
          totalProfit: sale.totalProfit,
        });

        successfulCount++;
      } catch (error) {
        // Handle duplicate key error (invoice number uniqueness)
        if (error.code === 11000) {
          errors.push({
            row: 0,
            field: 'invoiceNo',
            message: `Invoice number "${invoiceNo}" already exists`,
            value: invoiceNo,
          });
        } else {
          errors.push({
            row: 0,
            field: 'general',
            message: error.message || 'Error processing sale',
            value: invoiceNo,
          });
        }
        failedCount++;
      }
    }

    // Update import log
    importLog.successfulRows = successfulCount;
    importLog.failedRows = failedCount;
    importLog.errors = errors;
    importLog.warnings = warnings;
    importLog.status = failedCount === 0 ? 'completed' : failedCount < importLog.totalRows ? 'partial' : 'failed';
    importLog.completedAt = new Date();
    importLog.duration = Date.now() - startTime;

    await importLog.save();
    
    // Create audit log entry from import log
    await createAuditLogFromImportLog(importLog, req);

    // Return response
    res.json({
      success: true,
      message: `Import completed: ${successfulCount} sales imported, ${failedCount} failed, ${skippedCount} rows skipped`,
      data: {
        importLogId: importLog._id,
        totalRows: importLog.totalRows,
        successfulSales: successfulCount,
        failedSales: failedCount,
        skippedRows: skippedCount,
        errors: errors.length > 0 ? errors.slice(0, 50) : [], // Limit errors in response
        warnings: warnings.length > 0 ? warnings.slice(0, 20) : [], // Limit warnings in response
        processedSales: processedSales.slice(0, 100), // Limit sales in response
      },
    });
  } catch (error) {
    console.error('Error importing sales:', error);

    // Update import log if it exists
    if (importLog) {
      importLog.status = 'failed';
      importLog.completedAt = new Date();
      importLog.duration = Date.now() - (importLog.startedAt?.getTime() || Date.now());
      importLog.errors.push({
        row: 0,
        field: 'general',
        message: error.message,
        value: null,
      });
      await importLog.save().catch(console.error);
      
      // Create audit log entry from import log
      await createAuditLogFromImportLog(importLog, req);
    }

    res.status(500).json({
      success: false,
      message: 'Error importing sales',
      error: error.message,
      importLogId: importLog?._id || null,
    });
  }
};