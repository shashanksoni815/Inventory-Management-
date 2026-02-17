import mongoose from 'mongoose';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { Order } from '../models/Order.model.js';
import { Product } from '../models/Product.model.js';
import { Sale } from '../models/Sale.model.js';
import { ImportLog } from '../models/ImportLog.model.js';
import { AuditLog } from '../models/AuditLog.model.js';
import { hasFranchiseAccess } from '../middleware/franchiseAccess.middleware.js';

const STATUSES_WITH_RESERVATION = ['Confirmed', 'Packed', 'Shipped'];

const ORDER_PAYMENT_TO_SALE_METHOD = {
  UPI: 'upi',
  Card: 'card',
  COD: 'cash'
};

/** Roles allowed to access orders (admin = all; manager/sales = own franchise). */
const ORDER_ACCESS_ROLES = ['admin', 'manager', 'sales'];

import { applyFranchiseFilter } from '../utils/franchiseFilter.js';

/**
 * Build franchise filter for list query.
 * Admin: no restriction (optional franchise from query).
 * Manager / Sales: restricted to their assigned franchise only.
 */
const buildFranchiseFilter = (req) => {
  const user = req.user;
  const franchiseParam = req.query.franchise;

  if (!user) {
    return { _id: { $exists: false } };
  }

  // Admin can see all or filter by explicit franchise param
  if (user.role === 'admin') {
    if (franchiseParam) {
      return { franchise: new mongoose.Types.ObjectId(franchiseParam) };
    }
    return {};
  }

  // Manager and Sales: use franchise isolation helper
  if (user.role === 'manager' || user.role === 'sales') {
    const franchiseFilter = applyFranchiseFilter(req);
    
    // If explicit franchise param provided, validate it matches user's franchise
    if (franchiseParam) {
      if (!mongoose.Types.ObjectId.isValid(franchiseParam)) {
        return { _id: { $exists: false } };
      }
      const userFranchiseId = user.franchise?._id?.toString() || user.franchise?.toString();
      if (!userFranchiseId || userFranchiseId !== String(franchiseParam)) {
        return null; // signal 403
      }
      return { franchise: new mongoose.Types.ObjectId(franchiseParam) };
    }
    
    return franchiseFilter;
  }

  return { _id: { $exists: false } };
};

/**
 * GET /api/orders
 * List orders with filters: franchise, date range, status.
 * Franchise-scoped: admin sees all; franchise manager sees only assigned franchises.
 */
export const getOrders = async (req, res) => {
  try {
    const user = req.user;
    if (!user || !ORDER_ACCESS_ROLES.includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You do not have permission to view orders',
      });
    }

    const franchiseFilter = buildFranchiseFilter(req);
    if (franchiseFilter === null) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You do not have access to this franchise',
      });
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const { startDate, endDate, status, search, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    const query = { ...franchiseFilter, isDeleted: { $ne: true } };

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

    if (status && String(status).trim()) {
      query.orderStatus = String(status).trim();
    }

    if (search && String(search).trim()) {
      const term = String(search).trim();
      query.$or = [
        { orderNumber: { $regex: term, $options: 'i' } },
        { 'customer.name': { $regex: term, $options: 'i' } },
        { 'customer.email': { $regex: term, $options: 'i' } },
        { 'customer.phone': { $regex: term, $options: 'i' } },
      ];
    }

    const sortOptions = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [orders, total] = await Promise.all([
      Order.find(query)
        .sort(sortOptions)
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('franchise', 'name code')
        .populate('items.product', 'name sku')
        .lean(),
      Order.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: {
        orders,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders',
      error: error.message,
    });
  }
};

/**
 * GET /api/orders/:id
 * Get single order by id. Franchise-scoped access.
 */
export const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    if (!user || !ORDER_ACCESS_ROLES.includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You do not have permission to view orders',
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID',
      });
    }

    const order = await Order.findById(id)
      .populate('franchise', 'name code location contact')
      .populate('items.product', 'name sku category')
      .lean();

    if (!order || order.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    const franchiseId = order.franchise?._id != null
      ? order.franchise._id.toString()
      : (order.franchise && typeof order.franchise.toString === 'function' ? order.franchise.toString() : null);
    if (!hasFranchiseAccess(user, franchiseId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You do not have access to this order',
      });
    }

    res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order',
      error: error.message,
    });
  }
};

/**
 * POST /api/orders
 * Create a new order (manual or imported).
 * - Franchise-scoped & role-based (staff cannot create)
 * - Tracks createdBy / updatedBy
 */
export const createOrder = async (req, res) => {
  try {
    const user = req.user;
    if (!user || !ORDER_ACCESS_ROLES.includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You do not have permission to manage orders',
      });
    }

    if (user.role === 'staff') {
      return res.status(403).json({
        success: false,
        message: 'Read-only access: You cannot create orders',
      });
    }

    const payload = req.body || {};
    const franchiseId = payload.franchise;

    if (!franchiseId || !mongoose.Types.ObjectId.isValid(franchiseId)) {
      return res.status(400).json({
        success: false,
        message: 'franchise is required and must be a valid ID',
      });
    }

    if (!hasFranchiseAccess(user, franchiseId.toString())) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You do not have access to this franchise',
      });
    }

    // Basic safety: do not allow client to set audit fields or soft delete flags
    delete payload.createdBy;
    delete payload.updatedBy;
    delete payload.deletedAt;
    delete payload.isDeleted;

    // Generate orderNumber if not provided (unique per franchise via index)
    if (!payload.orderNumber || typeof payload.orderNumber !== 'string') {
      const ts = Date.now().toString(36).toUpperCase();
      const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
      payload.orderNumber = `ORD-${ts}-${rand}`;
    }

    const order = new Order({
      ...payload,
      franchise: franchiseId,
      createdBy: user._id,
      updatedBy: user._id,
      isDeleted: false,
      deletedAt: null,
    });

    await order.validate();
    const saved = await order.save();

    const populated = await Order.findById(saved._id)
      .populate('franchise', 'name code')
      .populate('items.product', 'name sku')
      .lean();

    return res.status(201).json({
      success: true,
      data: populated,
      message: 'Order created',
    });
  } catch (error) {
    // Handle duplicate orderNumber per franchise gracefully
    if (error?.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Order number already exists for this franchise',
      });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to create order',
      error: error.message,
    });
  }
};

/**
 * PUT /api/orders/:id
 * Update order details (not status/inventory).
 * - Franchise-scoped & role-based (staff cannot update)
 * - Tracks updatedBy
 */
export const updateOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    if (!user || !ORDER_ACCESS_ROLES.includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You do not have permission to manage orders',
      });
    }

    if (user.role === 'staff') {
      return res.status(403).json({
        success: false,
        message: 'Read-only access: You cannot update orders',
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID',
      });
    }

    const order = await Order.findById(id);
    if (!order || order.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    const franchiseId = order.franchise?.toString?.();
    if (!hasFranchiseAccess(user, franchiseId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You do not have access to this order',
      });
    }

    const updates = { ...(req.body || {}) };

    // Protect fields that must not be changed here
    delete updates._id;
    delete updates.id;
    delete updates.franchise;
    delete updates.orderNumber;
    delete updates.orderStatus; // status changes must go through PATCH /status
    delete updates.createdBy;
    delete updates.deletedAt;
    delete updates.isDeleted;

    // Apply allowed fields
    if (updates.customer) {
      order.customer = { ...order.customer, ...updates.customer };
    }
    if (updates.deliveryAddress) {
      order.deliveryAddress = { ...order.deliveryAddress, ...updates.deliveryAddress };
    }
    if (Array.isArray(updates.items)) {
      order.items = updates.items;
    }
    if (updates.payment) {
      order.payment = { ...order.payment, ...updates.payment };
    }
    if (updates.totals) {
      order.totals = { ...order.totals, ...updates.totals };
    }

    order.updatedBy = user._id;

    await order.validate();
    await order.save();

    const populated = await Order.findById(order._id)
      .populate('franchise', 'name code location contact')
      .populate('items.product', 'name sku category')
      .lean();

    return res.status(200).json({
      success: true,
      data: populated,
      message: 'Order updated',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update order',
      error: error.message,
    });
  }
};

/**
 * DELETE /api/orders/:id
 * Soft delete an order.
 * - Prevent deleting Delivered orders
 * - Franchise-scoped & role-based (staff cannot delete)
 * - Marks isDeleted/deletedAt, tracks updatedBy
 */
export const deleteOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    if (!user || !ORDER_ACCESS_ROLES.includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You do not have permission to manage orders',
      });
    }

    if (user.role === 'staff') {
      return res.status(403).json({
        success: false,
        message: 'Read-only access: You cannot delete orders',
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID',
      });
    }

    const order = await Order.findById(id);
    if (!order || order.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    const franchiseId = order.franchise?.toString?.();
    if (!hasFranchiseAccess(user, franchiseId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You do not have access to this order',
      });
    }

    if (order.orderStatus === 'Delivered') {
      return res.status(400).json({
        success: false,
        message: 'Delivered orders cannot be deleted. Use refunds/adjustments instead.',
      });
    }

    order.isDeleted = true;
    order.deletedAt = new Date();
    order.updatedBy = user._id;

    await order.save();

    return res.status(200).json({
      success: true,
      message: 'Order deleted',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete order',
      error: error.message,
    });
  }
};

/**
 * POST /api/orders/import
 * Import orders from Excel/CSV.
 *
 * Expected columns:
 * - orderNumber   (optional; auto-generated if missing)
 * - customerName  (required)
 * - phone         (required)
 * - productSKU    (required)
 * - quantity      (required, >=1)
 * - price         (required, >=0)
 * - paymentMethod (required: UPI, Card, COD)
 * - status        (optional; defaults to Pending)
 * - franchiseId   (required, ObjectId)
 * - orderDate     (optional ISO/string; defaults to now)
 *
 * Rules:
 * - Validate products & franchise
 * - Auto-calculate totals
 * - Skip invalid rows
 * - Return summary: totalRows, success, failed (with reasons)
 */
export const importOrders = async (req, res) => {
  const startTime = Date.now();
  let importLog = null;

  try {
    const { user } = req;

    if (!user || !ORDER_ACCESS_ROLES.includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You do not have permission to import orders',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded. Please upload an Excel (.xlsx, .xls) or CSV (.csv) file.',
      });
    }

    const isExcel =
      req.file.mimetype.includes('spreadsheet') ||
      req.file.originalname.endsWith('.xlsx') ||
      req.file.originalname.endsWith('.xls');
    const isCSV =
      req.file.mimetype === 'text/csv' ||
      req.file.originalname.endsWith('.csv');

    if (!isExcel && !isCSV) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid file type. Please upload an Excel (.xlsx, .xls) or CSV (.csv) file.',
      });
    }

    importLog = new ImportLog({
      importType: 'orders',
      fileName: req.file.originalname,
      fileSize: req.file.size,
      totalRows: 0,
      successfulRows: 0,
      failedRows: 0,
      skippedRows: 0,
      errors: [],
      warnings: [],
      importedBy: user._id,
      franchise: null,
      status: 'processing',
    });

    let headers = {};
    let rows = [];

    if (isCSV) {
      const csvContent = req.file.buffer.toString('utf-8');
      const lines = csvContent
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
      if (lines.length < 2) {
        return res.status(400).json({
          success: false,
          message: 'CSV file is empty or missing header row.',
        });
      }
      const headerRow = lines[0]
        .split(',')
        .map((h) => h.trim().replace(/^"|"$/g, ''));
      headerRow.forEach((h, idx) => {
        headers[h] = idx;
      });
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i]
          .split(',')
          .map((v) => v.trim().replace(/^"|"$/g, ''));
        rows.push({ rowNumber: i + 1, values });
      }
    } else {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(req.file.buffer);
      const sheet = workbook.worksheets[0];
      if (!sheet) {
        return res.status(400).json({
          success: false,
          message: 'Excel file is empty or missing worksheet.',
        });
      }
      const headerRow = sheet.getRow(1);
      headerRow.eachCell((cell, colNumber) => {
        const h = String(cell.value || '').trim();
        if (h) headers[h] = colNumber - 1;
      });
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const values = row.values
          .slice(1)
          .map((v) => (typeof v === 'object' && v?.text ? v.text : v));
        if (
          values.every(
            (v) =>
              v === null ||
              v === undefined ||
              (typeof v === 'string' && v.trim() === '')
          )
        ) {
          return;
        }
        rows.push({ rowNumber, values });
      });
    }

    const requiredColumns = [
      'orderNumber',
      'customerName',
      'phone',
      'productSKU',
      'quantity',
      'price',
      'paymentMethod',
      'status',
      'franchiseId',
      'orderDate',
    ];

    const missingColumns = requiredColumns.filter(
      (col) => !(col in headers)
    );
    // We allow orderNumber, status, orderDate to be optional-ish; key structural fields must exist
    const structuralMissing = ['customerName', 'phone', 'productSKU', 'quantity', 'price', 'paymentMethod', 'franchiseId'].filter(
      (col) => !(col in headers)
    );
    if (structuralMissing.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required columns: ${structuralMissing.join(', ')}`,
      });
    }

    importLog.totalRows = rows.length;

    const results = {
      totalRows: rows.length,
      success: 0,
      failed: 0,
      errors: [],
    };

    // Validate first row's franchise and user access to set importLog.franchise
    let defaultFranchiseId = null;
    for (const row of rows) {
      const values = row.values;
      const franchiseIdRaw = values[headers['franchiseId']];
      if (!franchiseIdRaw) continue;
      const franchiseId = String(franchiseIdRaw).trim();
      if (!mongoose.Types.ObjectId.isValid(franchiseId)) continue;
      if (!hasFranchiseAccess(user, franchiseId)) {
        continue;
      }
      defaultFranchiseId = franchiseId;
      break;
    }
    if (!defaultFranchiseId) {
      importLog.status = 'failed';
      importLog.completedAt = new Date();
      importLog.duration = Date.now() - startTime;
      await importLog.save();
      return res.status(400).json({
        success: false,
        message:
          'Could not determine a valid franchiseId with access from the file. Check franchiseId column and permissions.',
      });
    }
    importLog.franchise = defaultFranchiseId;

    for (const row of rows) {
      const { rowNumber, values } = row;
      try {
        const orderNumberRaw =
          headers['orderNumber'] !== undefined
            ? values[headers['orderNumber']]
            : null;
        const customerName = String(
          values[headers['customerName']] ?? ''
        ).trim();
        const phone = String(values[headers['phone']] ?? '').trim();
        const productSKU = String(
          values[headers['productSKU']] ?? ''
        ).trim();
        const qtyRaw = values[headers['quantity']];
        const priceRaw = values[headers['price']];
        const paymentMethodRaw = String(
          values[headers['paymentMethod']] ?? ''
        ).trim();
        const statusRaw =
          headers['status'] !== undefined
            ? String(values[headers['status']] ?? '').trim()
            : '';
        const franchiseIdRaw = values[headers['franchiseId']];
        const orderDateRaw =
          headers['orderDate'] !== undefined
            ? values[headers['orderDate']]
            : null;

        if (!customerName || !phone || !productSKU) {
          results.failed += 1;
          importLog.failedRows += 1;
          importLog.errors.push({
            row: rowNumber,
            field: 'customerName/phone/productSKU',
            message: 'Missing required customer or product SKU fields',
            value: { customerName, phone, productSKU },
          });
          continue;
        }

        const quantity = Number(qtyRaw);
        const unitPrice = Number(priceRaw);
        if (!Number.isFinite(quantity) || quantity <= 0) {
          results.failed += 1;
          importLog.failedRows += 1;
          importLog.errors.push({
            row: rowNumber,
            field: 'quantity',
            message: 'Quantity must be a positive number',
            value: qtyRaw,
          });
          continue;
        }
        if (!Number.isFinite(unitPrice) || unitPrice < 0) {
          results.failed += 1;
          importLog.failedRows += 1;
          importLog.errors.push({
            row: rowNumber,
            field: 'price',
            message: 'Price must be a non-negative number',
            value: priceRaw,
          });
          continue;
        }

        const paymentMethod = paymentMethodRaw;
        if (!['UPI', 'Card', 'COD'].includes(paymentMethod)) {
          results.failed += 1;
          importLog.failedRows += 1;
          importLog.errors.push({
            row: rowNumber,
            field: 'paymentMethod',
            message: 'paymentMethod must be one of: UPI, Card, COD',
            value: paymentMethodRaw,
          });
          continue;
        }

        const orderStatus = statusRaw || 'Pending';
        if (
          !ALLOWED_STATUSES.includes(orderStatus)
        ) {
          results.failed += 1;
          importLog.failedRows += 1;
          importLog.errors.push({
            row: rowNumber,
            field: 'status',
            message: `status must be one of: ${ALLOWED_STATUSES.join(', ')}`,
            value: statusRaw,
          });
          continue;
        }

        const franchiseId = String(franchiseIdRaw || defaultFranchiseId).trim();
        if (!mongoose.Types.ObjectId.isValid(franchiseId)) {
          results.failed += 1;
          importLog.failedRows += 1;
          importLog.errors.push({
            row: rowNumber,
            field: 'franchiseId',
            message: 'franchiseId must be a valid ObjectId',
            value: franchiseIdRaw,
          });
          continue;
        }
        if (!hasFranchiseAccess(user, franchiseId)) {
          results.failed += 1;
          importLog.failedRows += 1;
          importLog.errors.push({
            row: rowNumber,
            field: 'franchiseId',
            message:
              'You do not have access to this franchise. Row skipped.',
            value: franchiseIdRaw,
          });
          continue;
        }

        const product = await Product.findOne({
          sku: productSKU,
          franchise: new mongoose.Types.ObjectId(franchiseId),
        }).lean();

        if (!product) {
          results.failed += 1;
          importLog.failedRows += 1;
          importLog.errors.push({
            row: rowNumber,
            field: 'productSKU',
            message:
              'Product not found for given SKU in this franchise. Row skipped.',
            value: productSKU,
          });
          continue;
        }

        let createdAt = new Date();
        if (orderDateRaw) {
          const date = new Date(orderDateRaw);
          if (!Number.isNaN(date.getTime())) {
            createdAt = date;
          }
        }

        const base = unitPrice * quantity;
        const taxTotal = 0;
        const deliveryFee = 0;
        const discount = 0;
        const grandTotal = base + taxTotal + deliveryFee - discount;

        const generatedOrderNumber = `ORD-${Date.now().toString(
          36
        )}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        const orderNumber =
          (orderNumberRaw && String(orderNumberRaw).trim()) ||
          generatedOrderNumber;

        const orderDoc = new Order({
          orderNumber,
          franchise: new mongoose.Types.ObjectId(franchiseId),
          customer: {
            name: customerName,
            phone,
          },
          deliveryAddress: {
            addressLine: '',
            city: '',
            state: '',
            pincode: '',
          },
          items: [
            {
              product: product._id,
              productName: product.name,
              quantity,
              unitPrice,
              tax: taxTotal,
              subtotal: grandTotal,
            },
          ],
          payment: {
            method: paymentMethod,
            status: 'Pending',
          },
          orderStatus,
          totals: {
            itemTotal: base,
            taxTotal,
            deliveryFee,
            discount,
            grandTotal,
          },
          createdAt,
        });

        await orderDoc.validate();
        await orderDoc.save();

        results.success += 1;
        importLog.successfulRows += 1;
      } catch (err) {
        results.failed += 1;
        importLog.failedRows += 1;
        importLog.errors.push({
          row: rowNumber,
          field: 'row',
          message: err?.message || 'Unknown error importing row',
          value: null,
        });
      }
    }

    importLog.status =
      results.failed === 0
        ? 'completed'
        : results.success === 0
        ? 'failed'
        : 'partial';
    importLog.completedAt = new Date();
    importLog.duration = Date.now() - startTime;

    await importLog.save();

    return res.status(200).json({
      success: true,
      message: `Import completed: ${results.success} orders imported, ${results.failed} failed`,
      data: {
        totalRows: results.totalRows,
        successfulRows: results.success,
        failedRows: results.failed,
        errors: importLog.errors.slice(0, 50),
      },
    });
  } catch (error) {
    if (importLog) {
      importLog.status = 'failed';
      importLog.completedAt = new Date();
      importLog.duration = Date.now() - startTime;
      importLog.errors.push({
        row: 0,
        field: 'server',
        message: error.message || 'Unexpected error during import',
        value: null,
      });
      await importLog.save();
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to import orders',
      error: error.message,
    });
  }
};

/**
 * GET /api/orders/export
 * Export orders to Excel or PDF.
 *
 * Query params:
 * - franchise (optional; ObjectId; RBAC via hasFranchiseAccess & buildFranchiseFilter)
 * - startDate (optional ISO)
 * - endDate (optional ISO)
 * - status (optional; orderStatus filter)
 * - format (optional; 'excel'|'xlsx'|'pdf'; default 'excel')
 *
 * Columns:
 * | Order # | Date | Customer | Product | Qty | Payment | Status | Total |
 */
export const exportOrders = async (req, res) => {
  try {
    const user = req.user;
    if (!user || !ORDER_ACCESS_ROLES.includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You do not have permission to export orders',
      });
    }

    const {
      franchise,
      startDate,
      endDate,
      status,
      format = 'excel',
    } = req.query || {};

    // Build base filter (reuse franchise scoping logic)
    const baseFilter = buildFranchiseFilter({
      ...req,
      query: { ...req.query, franchise },
    });

    if (baseFilter === null) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You do not have access to this franchise',
      });
    }

    const query = { ...baseFilter, isDeleted: { $ne: true } };

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

    if (status && String(status).trim()) {
      query.orderStatus = String(status).trim();
    }

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .populate('items.product', 'name sku')
      .populate('franchise', 'name code')
      .lean();

    const lineItems = [];
    for (const order of orders) {
      const createdAt = order.createdAt ? new Date(order.createdAt) : new Date();
      const dateFormatted = createdAt.toISOString().slice(0, 10);
      const customerName = order.customer?.name || '';
      const payment = order.payment?.method || '';
      const statusLabel = order.orderStatus || '';
      const orderNumber = order.orderNumber;
      const total = order.totals?.grandTotal ?? 0;

      for (const item of order.items || []) {
        const productName =
          item.productName ||
          (item.product && typeof item.product === 'object' && item.product.name) ||
          '';
        const qty = item.quantity ?? 0;

        lineItems.push({
          orderNumber,
          dateFormatted,
          customerName,
          productName,
          qty,
          payment,
          statusLabel,
          total,
        });
      }
    }

    const formatNormalized =
      format === 'xlsx' || format === 'excel' ? 'excel' : format === 'pdf' ? 'pdf' : 'excel';

    // Create audit log
    const startTime = Date.now();
    const dateStr = startDate ? new Date(startDate).toISOString().slice(0, 10) : 'all';
    const endDateStr = endDate ? new Date(endDate).toISOString().slice(0, 10) : 'all';
    const fileExt = formatNormalized === 'excel' ? 'xlsx' : 'pdf';
    const fileName = `orders-export-${dateStr}_to_${endDateStr}.${fileExt}`;

    let auditLog = new AuditLog({
      actionType: 'export',
      operationType: 'orders',
      fileName,
      format: formatNormalized,
      user: user._id,
      franchise: franchise || null,
      totalRecords: lineItems.length,
      exportedRecords: lineItems.length,
      status: 'processing',
      startedAt: new Date(),
      requestParams: new Map(
        Object.entries({
          startDate: startDate || 'all',
          endDate: endDate || 'all',
          franchise: franchise || 'all',
          status: status || 'all',
          format,
        })
      ),
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
    });
    await auditLog.save();

    if (formatNormalized === 'excel') {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Orders Export');

      worksheet.columns = [
        { header: 'Order #', key: 'orderNumber', width: 18 },
        { header: 'Date', key: 'dateFormatted', width: 12 },
        { header: 'Customer', key: 'customerName', width: 25 },
        { header: 'Product', key: 'productName', width: 30 },
        { header: 'Qty', key: 'qty', width: 8 },
        { header: 'Payment', key: 'payment', width: 12 },
        { header: 'Status', key: 'statusLabel', width: 12 },
        { header: 'Total', key: 'total', width: 15 },
      ];

      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      };

      lineItems.forEach((item) => {
        worksheet.addRow(item);
      });

      const buffer = await workbook.xlsx.writeBuffer();

      auditLog.fileSize = buffer.length;
      auditLog.status = 'completed';
      auditLog.completedAt = new Date();
      auditLog.duration = Date.now() - startTime;
      await auditLog.save().catch(() => {});

      res.setHeader(
        'Content-Disposition',
        `attachment; filename=${fileName}`
      );
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      return res.send(Buffer.from(buffer));
    }

    if (formatNormalized === 'pdf') {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=${fileName}`
      );

      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', async () => {
        const buffer = Buffer.concat(chunks);
        auditLog.fileSize = buffer.length;
        auditLog.status = 'completed';
        auditLog.completedAt = new Date();
        auditLog.duration = Date.now() - startTime;
        await auditLog.save().catch(() => {});
      });

      doc.pipe(res);

      doc.fontSize(20).text('Orders Export', { align: 'center' });
      doc.moveDown();
      doc
        .fontSize(10)
        .text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
      doc.moveDown(2);

      doc.fontSize(10);
      const tableTop = doc.y;
      const rowHeight = 18;
      const colWidths = [60, 55, 90, 100, 30, 55, 45, 45];
      const headers = [
        'Order #',
        'Date',
        'Customer',
        'Product',
        'Qty',
        'Payment',
        'Status',
        'Total',
      ];

      doc.rect(50, tableTop, 500, rowHeight).fill('#E0E0E0');

      let xPos = 55;
      headers.forEach((header, i) => {
        doc
          .fillColor('#000000')
          .fontSize(9)
          .font('Helvetica-Bold')
          .text(header, xPos, tableTop + 4, {
            width: colWidths[i],
            align: 'left',
          });
        xPos += colWidths[i];
      });

      let yPos = tableTop + rowHeight;
      lineItems.forEach((item, index) => {
        if (yPos > 750) {
          doc.addPage();
          yPos = 50;
        }

        const rowValues = [
          item.orderNumber,
          item.dateFormatted,
          item.customerName,
          item.productName,
          String(item.qty),
          item.payment,
          item.statusLabel,
          String(item.total),
        ];

        xPos = 55;
        rowValues.forEach((val, i) => {
          doc
            .fontSize(8)
            .font('Helvetica')
            .fillColor('#000000')
            .text(val || '', xPos, yPos + 3, {
              width: colWidths[i],
              align: 'left',
            });
          xPos += colWidths[i];
        });

        yPos += rowHeight;
      });

      doc.end();
      return;
    }

    auditLog.status = 'failed';
    auditLog.completedAt = new Date();
    auditLog.duration = Date.now() - startTime;
    await auditLog.save().catch(() => {});

    return res.status(400).json({
      success: false,
      message: 'Invalid format. Supported formats: excel, xlsx, pdf',
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Orders export failed:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to export orders',
      error: error.message,
    });
  }
};

const ALLOWED_STATUSES = ['Pending', 'Confirmed', 'Packed', 'Shipped', 'Delivered', 'Cancelled'];

/**
 * PATCH /api/orders/:id/status
 * Update order status with atomic inventory integration:
 * - Confirmed → reserve stock (reservedQuantity)
 * - Delivered → reduce stock permanently and release reserve
 * - Cancelled → restore/release reserved stock
 */
export const updateOrderStatus = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { id } = req.params;
    const orderStatus = String(req.body.orderStatus);
    const user = req.user;

    if (!user || !ORDER_ACCESS_ROLES.includes(user.role)) {
      await session.abortTransaction();
      return res.status(403).json({
        success: false,
        message: 'Access denied: You do not have permission to manage orders',
      });
    }

    if (user.role === 'staff') {
      await session.abortTransaction();
      return res.status(403).json({
        success: false,
        message: 'Read-only access: You cannot update order status',
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID',
      });
    }

    if (!orderStatus || !ALLOWED_STATUSES.includes(orderStatus)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `orderStatus must be one of: ${ALLOWED_STATUSES.join(', ')}`,
      });
    }

    const order = await Order.findById(id).session(session);
    if (!order || order.isDeleted) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    const franchiseId = order.franchise?.toString?.();
    if (!hasFranchiseAccess(user, franchiseId)) {
      await session.abortTransaction();
      return res.status(403).json({
        success: false,
        message: 'Access denied: You do not have access to this order',
      });
    }

    const previousStatus = order.orderStatus;

    if (orderStatus === 'Confirmed') {
      for (const item of order.items) {
        const product = await Product.findById(item.product).session(session);
        if (!product) {
          await session.abortTransaction();
          return res.status(400).json({
            success: false,
            message: `Product not found: ${item.productName || item.product}`,
          });
        }
        const reserved = product.reservedQuantity ?? 0;
        const available = (product.stockQuantity ?? 0) - reserved;
        if (available < item.quantity) {
          await session.abortTransaction();
          return res.status(400).json({
            success: false,
            message: `Insufficient stock for "${item.productName}". Available: ${available}, required: ${item.quantity}`,
          });
        }
        await Product.findByIdAndUpdate(
          item.product,
          { $inc: { reservedQuantity: item.quantity } },
          { session }
        );
      }
    }

    if (orderStatus === 'Delivered') {
      const saleItems = [];
      for (const item of order.items) {
        const product = await Product.findById(item.product).session(session);
        if (!product) {
          await session.abortTransaction();
          return res.status(400).json({
            success: false,
            message: `Product not found: ${item.productName || item.product}`,
          });
        }
        const reserved = product.reservedQuantity ?? 0;
        if (reserved < item.quantity) {
          await session.abortTransaction();
          return res.status(400).json({
            success: false,
            message: `Reserved quantity too low for "${item.productName}". Reserved: ${reserved}, needed: ${item.quantity}`,
          });
        }
        const revenue = (item.unitPrice ?? 0) * item.quantity;
        const buyingPrice = product.buyingPrice ?? 0;
        const sellingPrice = item.unitPrice ?? 0;
        const profit = (sellingPrice - buyingPrice) * item.quantity;
        await Product.findByIdAndUpdate(
          item.product,
          {
            $inc: {
              stockQuantity: -item.quantity,
              reservedQuantity: -item.quantity,
              totalSold: item.quantity,
              totalRevenue: revenue,
              totalProfit: profit,
            },
            $set: { lastSold: new Date() },
          },
          { session }
        );
        saleItems.push({
          product: item.product,
          sku: product.sku,
          name: item.productName ?? product.name,
          quantity: item.quantity,
          buyingPrice,
          sellingPrice,
          discount: 0,
          tax: item.tax ?? 0,
          profit,
        });
      }
      const paymentMethod = ORDER_PAYMENT_TO_SALE_METHOD[order.payment?.method] || 'cash';
      const saleDoc = {
        invoiceNumber: `ORD-${order._id}`,
        items: saleItems,
        customerName: order.customer?.name ?? '',
        customerEmail: order.customer?.email ?? '',
        subTotal: order.totals?.itemTotal ?? 0,
        totalDiscount: order.totals?.discount ?? 0,
        totalTax: order.totals?.taxTotal ?? 0,
        grandTotal: order.totals?.grandTotal ?? 0,
        totalProfit: saleItems.reduce((sum, i) => sum + (i.profit || 0), 0),
        paymentMethod,
        saleType: 'online',
        status: 'completed',
        franchise: order.franchise,
        order: order._id,
      };
      await Sale.create([saleDoc], { session });
    }

    if (orderStatus === 'Cancelled' && STATUSES_WITH_RESERVATION.includes(previousStatus)) {
      for (const item of order.items) {
        await Product.findByIdAndUpdate(
          item.product,
          { $inc: { reservedQuantity: -item.quantity } },
          { session }
        );
      }
    }

    order.orderStatus = orderStatus;
    await order.save({ session });

    await session.commitTransaction();

    const updated = await Order.findById(id)
      .populate('franchise', 'name code')
      .populate('items.product', 'name sku')
      .lean();

    res.status(200).json({
      success: true,
      data: updated,
      message: 'Order status updated',
    });
  } catch (error) {
    await session.abortTransaction().catch(() => {});
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update order status',
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};
