// controllers/transfer.controller.js
import mongoose from 'mongoose';
import Transfer from '../models/Transfer.js';
import { Product } from '../models/Product.model.js';
import Franchise from '../models/Franchise.js';
import { AuditLog } from '../models/AuditLog.model.js';

// Get all transfers - STRICTLY SCOPED BY FRANCHISE
export const getAllTransfers = async (req, res) => {
  try {
    const { franchise, status, fromFranchise, toFranchise } = req.query;
    const user = req.user;

    // STRICT FRANCHISE SCOPING: Build query to show transfers where franchise is involved
    const query = {};
    
    if (franchise) {
      // Show transfers where this franchise is either sender or receiver
      query.$or = [
        { fromFranchise: franchise },
        { toFranchise: franchise }
      ];
    } else if (user && user.role !== 'admin' && user.franchises && user.franchises.length > 0) {
      // Non-admin users see only their franchise transfers
      query.$or = [
        { fromFranchise: { $in: user.franchises } },
        { toFranchise: { $in: user.franchises } }
      ];
    }

    if (fromFranchise) query.fromFranchise = fromFranchise;
    if (toFranchise) query.toFranchise = toFranchise;
    if (status) query.status = status;

    const transfers = await Transfer.find(query)
      .populate('product', 'name sku')
      .populate('fromFranchise', 'name code')
      .populate('toFranchise', 'name code')
      .populate('initiatedBy', 'username')
      .populate('approvedBy', 'username')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      data: transfers,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transfers',
      error: error.message,
    });
  }
};

// Get transfer by ID
export const getTransferById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const transfer = await Transfer.findById(id)
      .populate('product', 'name sku')
      .populate('fromFranchise', 'name code')
      .populate('toFranchise', 'name code')
      .populate('initiatedBy', 'username')
      .populate('approvedBy', 'username')
      .lean();

    if (!transfer) {
      return res.status(404).json({
        success: false,
        message: 'Transfer not found',
      });
    }

    // STRICT FRANCHISE SCOPING: Check access
    if (user && user.role !== 'admin') {
      const userFranchises = user.franchises || [];
      const isInvolved = userFranchises.some((fId) => 
        fId.toString() === transfer.fromFranchise._id.toString() ||
        fId.toString() === transfer.toFranchise._id.toString()
      );
      if (!isInvolved) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this transfer',
        });
      }
    }

    res.status(200).json({
      success: true,
      data: transfer,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transfer',
      error: error.message,
    });
  }
};

// Create transfer
export const createTransfer = async (req, res) => {
  try {
    const {
      product,
      fromFranchise,
      toFranchise,
      quantity,
      unitPrice,
      notes,
    } = req.body;

    const user = req.user;

    // Validate required fields
    if (!product || !fromFranchise || !toFranchise || !quantity) {
      return res.status(400).json({
        success: false,
        message: 'Product, fromFranchise, toFranchise, and quantity are required',
      });
    }

    if (fromFranchise === toFranchise) {
      return res.status(400).json({
        success: false,
        message: 'From and to franchises must be different',
      });
    }

    // STRICT FRANCHISE SCOPING: Verify user has access to fromFranchise
    if (user && user.role !== 'admin') {
      const userFranchises = user.franchises || [];
      if (!userFranchises.some((fId) => fId.toString() === fromFranchise.toString())) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to initiate transfer from this franchise',
        });
      }
    }

    // Verify product exists and belongs to fromFranchise
    const productDoc = await Product.findById(product);
    if (!productDoc) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    if (productDoc.franchise.toString() !== fromFranchise.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Product does not belong to the source franchise',
      });
    }

    if (productDoc.stockQuantity < quantity) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient stock for transfer',
      });
    }

    const transfer = await Transfer.create({
      product,
      fromFranchise,
      toFranchise,
      quantity,
      unitPrice: unitPrice || productDoc.buyingPrice,
      totalValue: (unitPrice || productDoc.buyingPrice) * quantity,
      status: 'pending',
      initiatedBy: user._id,
      notes,
    });

    res.status(201).json({
      success: true,
      data: transfer,
      message: 'Transfer created successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create transfer',
      error: error.message,
    });
  }
};

// Update transfer
export const updateTransfer = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const user = req.user;

    const transfer = await Transfer.findById(id);
    if (!transfer) {
      return res.status(404).json({
        success: false,
        message: 'Transfer not found',
      });
    }

    // STRICT FRANCHISE SCOPING: Check access
    if (user && user.role !== 'admin') {
      const userFranchises = user.franchises || [];
      const isInvolved = userFranchises.some((fId) => 
        fId.toString() === transfer.fromFranchise.toString() ||
        fId.toString() === transfer.toFranchise.toString()
      );
      if (!isInvolved) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this transfer',
        });
      }
    }

    Object.assign(transfer, updateData);
    await transfer.save();

    res.status(200).json({
      success: true,
      data: transfer,
      message: 'Transfer updated successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update transfer',
      error: error.message,
    });
  }
};

// Approve transfer
export const approveTransfer = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const transfer = await Transfer.findById(id).populate('product');
    if (!transfer) {
      return res.status(404).json({
        success: false,
        message: 'Transfer not found',
      });
    }

    if (transfer.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Transfer is not pending',
      });
    }

    // STRICT FRANCHISE SCOPING: Only admin or toFranchise manager can approve
    if (user && user.role !== 'admin') {
      const userFranchises = user.franchises || [];
      if (!userFranchises.some((fId) => fId.toString() === transfer.toFranchise.toString())) {
        return res.status(403).json({
          success: false,
          message: 'Only the receiving franchise can approve this transfer',
        });
      }
    }

    transfer.status = 'approved';
    transfer.approvedBy = user._id;
    await transfer.save();

    res.status(200).json({
      success: true,
      data: transfer,
      message: 'Transfer approved successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to approve transfer',
      error: error.message,
    });
  }
};

// Reject transfer
export const rejectTransfer = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const user = req.user;

    const transfer = await Transfer.findById(id);
    if (!transfer) {
      return res.status(404).json({
        success: false,
        message: 'Transfer not found',
      });
    }

    // STRICT FRANCHISE SCOPING: Only admin or toFranchise manager can reject
    if (user && user.role !== 'admin') {
      const userFranchises = user.franchises || [];
      if (!userFranchises.some((fId) => fId.toString() === transfer.toFranchise.toString())) {
        return res.status(403).json({
          success: false,
          message: 'Only the receiving franchise can reject this transfer',
        });
      }
    }

    transfer.status = 'rejected';
    if (reason) transfer.notes = (transfer.notes || '') + ` Rejection reason: ${reason}`;
    await transfer.save();

    res.status(200).json({
      success: true,
      data: transfer,
      message: 'Transfer rejected',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to reject transfer',
      error: error.message,
    });
  }
};

// Complete transfer (actually move stock)
export const completeTransfer = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const transfer = await Transfer.findById(id).populate('product');
    if (!transfer) {
      return res.status(404).json({
        success: false,
        message: 'Transfer not found',
      });
    }

    if (transfer.status !== 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Transfer must be approved before completion',
      });
    }

    // STRICT FRANCHISE SCOPING: Check access
    if (user && user.role !== 'admin') {
      const userFranchises = user.franchises || [];
      const isInvolved = userFranchises.some((fId) => 
        fId.toString() === transfer.fromFranchise.toString() ||
        fId.toString() === transfer.toFranchise.toString()
      );
      if (!isInvolved) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this transfer',
        });
      }
    }

    const product = transfer.product;
    
    // Verify source franchise has enough stock
    if (product.franchise.toString() !== transfer.fromFranchise.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Product franchise mismatch',
      });
    }

    if (product.stockQuantity < transfer.quantity) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient stock for transfer',
      });
    }

    // Move stock: decrease from source, increase in destination
    await Product.findByIdAndUpdate(product._id, {
      $inc: { stockQuantity: -transfer.quantity }
    });

    // Find or create product in destination franchise
    const destProduct = await Product.findOne({
      sku: product.sku,
      franchise: transfer.toFranchise,
    });

    if (destProduct) {
      await Product.findByIdAndUpdate(destProduct._id, {
        $inc: { stockQuantity: transfer.quantity }
      });
    } else {
      // Create new product entry in destination franchise
      await Product.create({
        ...product.toObject(),
        _id: undefined,
        franchise: transfer.toFranchise,
        stockQuantity: transfer.quantity,
        totalSold: 0,
        totalRevenue: 0,
        totalProfit: 0,
      });
    }

    transfer.status = 'completed';
    transfer.actualDelivery = new Date();
    await transfer.save();

    res.status(200).json({
      success: true,
      data: transfer,
      message: 'Transfer completed successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to complete transfer',
      error: error.message,
    });
  }
};

// Cancel transfer
export const cancelTransfer = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const user = req.user;

    const transfer = await Transfer.findById(id);
    if (!transfer) {
      return res.status(404).json({
        success: false,
        message: 'Transfer not found',
      });
    }

    if (['completed', 'cancelled'].includes(transfer.status)) {
      return res.status(400).json({
        success: false,
        message: 'Transfer cannot be cancelled',
      });
    }

    // STRICT FRANCHISE SCOPING: Only admin or fromFranchise can cancel
    if (user && user.role !== 'admin') {
      const userFranchises = user.franchises || [];
      if (!userFranchises.some((fId) => fId.toString() === transfer.fromFranchise.toString())) {
        return res.status(403).json({
          success: false,
          message: 'Only the sending franchise can cancel this transfer',
        });
      }
    }

    transfer.status = 'cancelled';
    if (reason) transfer.notes = (transfer.notes || '') + ` Cancellation reason: ${reason}`;
    await transfer.save();

    res.status(200).json({
      success: true,
      data: transfer,
      message: 'Transfer cancelled',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to cancel transfer',
      error: error.message,
    });
  }
};

// Get transfer statistics for a franchise
export const getTransferStatistics = async (req, res) => {
  try {
    const { franchiseId } = req.params;
    const { period = 'month' } = req.query;
    const user = req.user;

    // STRICT FRANCHISE SCOPING: Verify access
    if (user && user.role !== 'admin') {
      const userFranchises = user.franchises || [];
      if (!userFranchises.some((fId) => fId.toString() === franchiseId)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this franchise statistics',
        });
      }
    }

    const now = new Date();
    let startDate = new Date();
    if (period === 'week') startDate.setDate(now.getDate() - 7);
    else if (period === 'month') startDate.setMonth(now.getMonth() - 1);
    else if (period === 'quarter') startDate.setMonth(now.getMonth() - 3);
    else if (period === 'year') startDate.setFullYear(now.getFullYear() - 1);

    const [imports, exports] = await Promise.all([
      Transfer.aggregate([
        {
          $match: {
            toFranchise: franchiseId,
            createdAt: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            totalValue: { $sum: '$totalValue' },
            totalQuantity: { $sum: '$quantity' },
          },
        },
      ]),
      Transfer.aggregate([
        {
          $match: {
            fromFranchise: franchiseId,
            createdAt: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            totalValue: { $sum: '$totalValue' },
            totalQuantity: { $sum: '$quantity' },
          },
        },
      ]),
    ]);

    res.status(200).json({
      success: true,
      data: {
        imports: imports[0] || { count: 0, totalValue: 0, totalQuantity: 0 },
        exports: exports[0] || { count: 0, totalValue: 0, totalQuantity: 0 },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transfer statistics',
      error: error.message,
    });
  }
};

/**
 * Admin-only: Network transfers overview (total imports/exports, inter-franchise list, bottlenecks).
 * Query: timeRange = 7d | 30d | 90d | 1y
 */
export const getAdminTransfersOverview = async (req, res) => {
  try {
    const user = req.user;
    if (user.role !== 'admin' && user.role !== 'superAdmin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
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

    const dateMatch = { transferDate: { $gte: startDate, $lte: endDate } };

    // Use $facet to combine Transfer aggregations (indexed: transferDate, status)
    const [overviewResult, recentTransfers, pendingTransfers] = await Promise.all([
      Transfer.aggregate([
        { $match: dateMatch },
        {
          $facet: {
            importsExports: [
              {
                $group: {
                  _id: null,
                  totalTransfers: { $sum: 1 },
                  totalQuantity: { $sum: '$quantity' },
                  completedCount: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
                  completedQuantity: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$quantity', 0] } },
                },
              },
              { $project: { _id: 0 } },
            ],
            byStatus: [
              { $group: { _id: '$status', count: { $sum: 1 } } },
              { $project: { status: '$_id', count: 1, _id: 0 } },
            ],
          },
        },
      ]),
      // Recent transfers (indexed: transferDate)
      Transfer.aggregate([
        { $sort: { transferDate: -1 } },
        { $limit: 15 },
        {
          $lookup: {
            from: 'products',
            localField: 'product',
            foreignField: '_id',
            as: 'productDoc'
          }
        },
        { $unwind: { path: '$productDoc', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'franchises',
            localField: 'fromFranchise',
            foreignField: '_id',
            as: 'fromDoc'
          }
        },
        { $unwind: { path: '$fromDoc', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'franchises',
            localField: 'toFranchise',
            foreignField: '_id',
            as: 'toDoc'
          }
        },
        { $unwind: { path: '$toDoc', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'users',
            localField: 'initiatedBy',
            foreignField: '_id',
            as: 'userDoc'
          }
        },
        { $unwind: { path: '$userDoc', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: { $toString: '$_id' },
            productName: { $ifNull: ['$productDoc.name', '—'] },
            sku: { $ifNull: ['$productDoc.sku', '—'] },
            fromFranchiseName: { $ifNull: ['$fromDoc.name', '—'] },
            fromFranchiseCode: '$fromDoc.code',
            toFranchiseName: { $ifNull: ['$toDoc.name', '—'] },
            toFranchiseCode: '$toDoc.code',
            quantity: 1,
            totalValue: 1,
            status: 1,
            transferDate: 1,
            initiatedBy: '$userDoc.username',
          },
        },
      ]),
      // Pending transfers (indexed: status, transferDate)
      Transfer.aggregate([
        { $match: { status: { $in: ['pending', 'approved', 'in_transit'] } } },
        { $sort: { transferDate: 1 } },
        { $limit: 50 },
        {
          $lookup: {
            from: 'products',
            localField: 'product',
            foreignField: '_id',
            as: 'productDoc'
          }
        },
        { $unwind: { path: '$productDoc', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'franchises',
            localField: 'fromFranchise',
            foreignField: '_id',
            as: 'fromDoc'
          }
        },
        { $unwind: { path: '$fromDoc', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'franchises',
            localField: 'toFranchise',
            foreignField: '_id',
            as: 'toDoc'
          }
        },
        { $unwind: { path: '$toDoc', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'users',
            localField: 'initiatedBy',
            foreignField: '_id',
            as: 'userDoc'
          }
        },
        { $unwind: { path: '$userDoc', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: { $toString: '$_id' },
            productName: { $ifNull: ['$productDoc.name', '—'] },
            sku: { $ifNull: ['$productDoc.sku', '—'] },
            fromFranchiseName: { $ifNull: ['$fromDoc.name', '—'] },
            fromFranchiseCode: '$fromDoc.code',
            toFranchiseName: { $ifNull: ['$toDoc.name', '—'] },
            toFranchiseCode: '$toDoc.code',
            quantity: 1,
            totalValue: 1,
            status: 1,
            transferDate: 1,
            initiatedBy: '$userDoc.username',
          },
        },
      ]),
    ]);

    const { importsExports = [], byStatus = [] } = overviewResult[0] || {};
    const totals = importsExports[0] || {
      totalTransfers: 0,
      totalQuantity: 0,
      completedCount: 0,
      completedQuantity: 0,
    };

    // Build byStatus object in aggregation result (no JS Object.fromEntries)
    const statusMap = {};
    byStatus.forEach((s) => {
      statusMap[s.status] = s.count;
    });

    res.status(200).json({
      success: true,
      data: {
        totalImports: totals.completedCount,
        totalExports: totals.completedCount,
        totalTransfers: totals.totalTransfers,
        totalQuantity: totals.totalQuantity,
        completedQuantity: totals.completedQuantity,
        byStatus: {
          pending: statusMap.pending || 0,
          approved: statusMap.approved || 0,
          in_transit: statusMap.in_transit || 0,
          completed: statusMap.completed || 0,
          rejected: statusMap.rejected || 0,
          cancelled: statusMap.cancelled || 0,
        },
        recentTransfers: recentTransfers,
        pendingTransfers: pendingTransfers,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transfers overview',
      error: error.message,
    });
  }
};

/**
 * Import Stock (Stock In) - Track stock received by a franchise
 * POST /api/transfers/import
 * 
 * Creates a transfer record for stock received (imported goods).
 * This is used for recording stock that has already been received,
 * typically from a warehouse or another franchise.
 * 
 * Body (single transfer or array of transfers):
 * {
 *   productId: ObjectId (required),
 *   quantity: Number (required, >= 1),
 *   cost: Number (required, >= 0) - unit price/cost,
 *   fromFranchise: ObjectId (required) - source franchise/warehouse,
 *   toFranchise: ObjectId (required) - destination franchise (receiving),
 *   date: Date (optional) - transfer date (default: now),
 *   status: String (optional) - transfer status (default: 'completed'),
 *   notes: String (optional)
 * }
 */
export const importStock = async (req, res) => {
  const startTime = Date.now();
  let auditLog = null;
  
  try {
    const user = req.user;
    const transferData = req.body;

    // Support both single transfer and array of transfers
    const transfers = Array.isArray(transferData) ? transferData : [transferData];
    
    if (transfers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No transfer data provided',
      });
    }

    // Create audit log entry for stock import
    const fileName = `stock-import-${new Date().toISOString().slice(0, 10)}.json`;
    auditLog = new AuditLog({
      actionType: 'import',
      operationType: 'stock_import',
      fileName: fileName,
      format: 'json',
      user: user._id,
      franchise: transfers[0]?.toFranchise || null,
      totalRows: transfers.length,
      successfulRows: 0,
      failedRows: 0,
      status: 'processing',
      startedAt: new Date(),
      requestParams: new Map(Object.entries({
        transferCount: transfers.length
      })),
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    });
    await auditLog.save();

    const results = [];
    const errors = [];

    for (let i = 0; i < transfers.length; i++) {
      const transfer = transfers[i];
      
      try {
        const {
          productId,
          quantity,
          cost,
          fromFranchise,
          toFranchise,
          date,
          status = 'completed',
          notes,
        } = transfer;

        // Validate required fields
        if (!productId || !quantity || cost === undefined || !fromFranchise || !toFranchise) {
          errors.push({
            index: i,
            message: 'Missing required fields: productId, quantity, cost, fromFranchise, toFranchise are required',
          });
          continue;
        }

        // Validate ObjectIds
        if (!mongoose.Types.ObjectId.isValid(productId)) {
          errors.push({
            index: i,
            message: 'Invalid productId',
          });
          continue;
        }

        if (!mongoose.Types.ObjectId.isValid(fromFranchise)) {
          errors.push({
            index: i,
            message: 'Invalid fromFranchise',
          });
          continue;
        }

        if (!mongoose.Types.ObjectId.isValid(toFranchise)) {
          errors.push({
            index: i,
            message: 'Invalid toFranchise',
          });
          continue;
        }

        // Validate quantity
        const qty = Number(quantity);
        if (isNaN(qty) || qty < 1) {
          errors.push({
            index: i,
            message: 'Quantity must be a number >= 1',
          });
          continue;
        }

        // Validate cost
        const unitPrice = Number(cost);
        if (isNaN(unitPrice) || unitPrice < 0) {
          errors.push({
            index: i,
            message: 'Cost must be a number >= 0',
          });
          continue;
        }

        // Validate status
        const validStatuses = ['pending', 'approved', 'rejected', 'in_transit', 'completed', 'cancelled'];
        const transferStatus = status.toLowerCase();
        if (!validStatuses.includes(transferStatus)) {
          errors.push({
            index: i,
            message: `Status must be one of: ${validStatuses.join(', ')}`,
          });
          continue;
        }

        // Validate franchises exist
        const [fromFranchiseDoc, toFranchiseDoc] = await Promise.all([
          Franchise.findById(fromFranchise),
          Franchise.findById(toFranchise),
        ]);

        if (!fromFranchiseDoc) {
          errors.push({
            index: i,
            message: 'From franchise not found',
          });
          continue;
        }

        if (!toFranchiseDoc) {
          errors.push({
            index: i,
            message: 'To franchise not found',
          });
          continue;
        }

        // STRICT FRANCHISE SCOPING: Validate user has access to toFranchise (receiving franchise)
        if (user && user.role !== 'admin') {
          const userFranchises = user.franchises || [];
          if (!userFranchises.some((fId) => fId.toString() === toFranchise.toString())) {
            errors.push({
              index: i,
              message: 'Access denied to receiving franchise',
            });
            continue;
          }
        }

        // Validate product exists
        const product = await Product.findById(productId);
        if (!product) {
          errors.push({
            index: i,
            message: 'Product not found',
          });
          continue;
        }

        // Parse date
        let transferDate = new Date();
        if (date) {
          const parsedDate = new Date(date);
          if (!isNaN(parsedDate.getTime())) {
            transferDate = parsedDate;
          }
        }

        // Calculate total value
        const totalValue = unitPrice * qty;

        // Create transfer record
        const transferRecord = await Transfer.create({
          product: productId,
          fromFranchise,
          toFranchise,
          quantity: qty,
          unitPrice,
          totalValue,
          status: transferStatus,
          transferDate,
          actualDelivery: transferStatus === 'completed' ? transferDate : undefined,
          initiatedBy: user._id,
          notes: notes || `Stock imported on ${transferDate.toLocaleString()}`,
          history: [{
            date: new Date(),
            status: transferStatus,
            note: `Stock import created`,
            user: user._id,
          }],
        });

        // Update product stock in destination franchise if status is 'completed'
        if (transferStatus === 'completed') {
          // Find or create product in destination franchise
          let destProduct = await Product.findOne({
            sku: product.sku,
            franchise: toFranchise,
          });

          if (destProduct) {
            // Update existing product stock
            await Product.findByIdAndUpdate(destProduct._id, {
              $inc: { stockQuantity: qty },
            });
          } else {
            // Create new product entry in destination franchise
            destProduct = await Product.create({
              sku: product.sku,
              name: product.name,
              category: product.category,
              brand: product.brand,
              description: product.description,
              buyingPrice: unitPrice, // Use import cost as buying price
              sellingPrice: product.sellingPrice,
              stockQuantity: qty,
              minimumStock: product.minimumStock,
              franchise: toFranchise,
              status: 'active',
              isGlobal: false,
              transferable: product.transferable,
            });
          }

          // Add stock history entry
          if (destProduct.stockHistory) {
            destProduct.stockHistory.push({
              date: transferDate,
              quantity: qty,
              type: 'transfer_in',
              note: `Stock imported from ${fromFranchiseDoc.name}`,
              franchise: toFranchise,
            });
            await destProduct.save();
          }
        }

        results.push({
          transferId: transferRecord._id,
          productId: productId.toString(),
          productName: product.name,
          quantity: qty,
          fromFranchise: fromFranchiseDoc.name,
          toFranchise: toFranchiseDoc.name,
          status: transferStatus,
          totalValue,
        });
      } catch (error) {
        errors.push({
          index: i,
          message: error.message || 'Error processing transfer',
        });
      }
    }

    // Update audit log
    if (auditLog) {
      auditLog.successfulRows = results.length;
      auditLog.failedRows = errors.length;
      auditLog.errors = errors.map((err, idx) => ({
        row: err.index !== undefined ? err.index : idx,
        field: 'transfer',
        message: err.message || 'Error processing transfer',
        value: null
      }));
      auditLog.status = errors.length === 0 ? 'completed' : errors.length < transfers.length ? 'partial' : 'failed';
      auditLog.completedAt = new Date();
      auditLog.duration = Date.now() - startTime;
      await auditLog.save().catch(console.error);
    }

    // Return response
    if (errors.length > 0 && results.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'All transfers failed',
        errors,
      });
    }

    res.status(results.length > 0 ? 201 : 400).json({
      success: results.length > 0,
      message: `Processed ${results.length} transfer(s), ${errors.length} error(s)`,
      data: {
        successful: results,
        errors: errors.length > 0 ? errors : undefined,
      },
    });
  } catch (error) {
    console.error('Error importing stock:', error);
    
    // Update audit log on error
    if (auditLog) {
      auditLog.status = 'failed';
      auditLog.completedAt = new Date();
      auditLog.duration = Date.now() - startTime;
      auditLog.errors.push({
        row: 0,
        field: 'import',
        message: error.message || 'Import failed',
        value: null
      });
      await auditLog.save().catch(console.error);
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to import stock',
      error: error.message,
    });
  }
};

/**
 * Export Stock (Stock Out) - Track stock sent out from a franchise
 * POST /api/transfers/export
 * 
 * Creates a transfer record for stock sent out (exported goods).
 * This is used for recording stock that has been sent out,
 * typically to a warehouse or another franchise.
 * 
 * Body (single transfer or array of transfers):
 * {
 *   productId: ObjectId (required),
 *   quantity: Number (required, >= 1),
 *   cost: Number (required, >= 0) - unit price/cost,
 *   fromFranchise: ObjectId (required) - source franchise (sending),
 *   toFranchise: ObjectId (required) - destination franchise/warehouse,
 *   date: Date (optional) - transfer date (default: now),
 *   status: String (optional) - transfer status (default: 'completed'),
 *   notes: String (optional)
 * }
 */
export const exportStock = async (req, res) => {
  const startTime = Date.now();
  let auditLog = null;
  
  try {
    const user = req.user;
    const transferData = req.body;

    // Support both single transfer and array of transfers
    const transfers = Array.isArray(transferData) ? transferData : [transferData];
    
    if (transfers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No transfer data provided',
      });
    }

    // Create audit log entry for stock export
    const fileName = `stock-export-${new Date().toISOString().slice(0, 10)}.json`;
    auditLog = new AuditLog({
      actionType: 'export',
      operationType: 'stock_export',
      fileName: fileName,
      format: 'json',
      user: user._id,
      franchise: transfers[0]?.fromFranchise || null,
      totalRows: transfers.length,
      successfulRows: 0,
      failedRows: 0,
      status: 'processing',
      startedAt: new Date(),
      requestParams: new Map(Object.entries({
        transferCount: transfers.length
      })),
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    });
    await auditLog.save();

    const results = [];
    const errors = [];

    for (let i = 0; i < transfers.length; i++) {
      const transfer = transfers[i];
      
      try {
        const {
          productId,
          quantity,
          cost,
          fromFranchise,
          toFranchise,
          date,
          status = 'completed',
          notes,
        } = transfer;

        // Validate required fields
        if (!productId || !quantity || cost === undefined || !fromFranchise || !toFranchise) {
          errors.push({
            index: i,
            message: 'Missing required fields: productId, quantity, cost, fromFranchise, toFranchise are required',
          });
          continue;
        }

        // Validate ObjectIds
        if (!mongoose.Types.ObjectId.isValid(productId)) {
          errors.push({
            index: i,
            message: 'Invalid productId',
          });
          continue;
        }

        if (!mongoose.Types.ObjectId.isValid(fromFranchise)) {
          errors.push({
            index: i,
            message: 'Invalid fromFranchise',
          });
          continue;
        }

        if (!mongoose.Types.ObjectId.isValid(toFranchise)) {
          errors.push({
            index: i,
            message: 'Invalid toFranchise',
          });
          continue;
        }

        // Validate quantity
        const qty = Number(quantity);
        if (isNaN(qty) || qty < 1) {
          errors.push({
            index: i,
            message: 'Quantity must be a number >= 1',
          });
          continue;
        }

        // Validate cost
        const unitPrice = Number(cost);
        if (isNaN(unitPrice) || unitPrice < 0) {
          errors.push({
            index: i,
            message: 'Cost must be a number >= 0',
          });
          continue;
        }

        // Validate status
        const validStatuses = ['pending', 'approved', 'rejected', 'in_transit', 'completed', 'cancelled'];
        const transferStatus = status.toLowerCase();
        if (!validStatuses.includes(transferStatus)) {
          errors.push({
            index: i,
            message: `Status must be one of: ${validStatuses.join(', ')}`,
          });
          continue;
        }

        // Validate franchises exist
        const [fromFranchiseDoc, toFranchiseDoc] = await Promise.all([
          Franchise.findById(fromFranchise),
          Franchise.findById(toFranchise),
        ]);

        if (!fromFranchiseDoc) {
          errors.push({
            index: i,
            message: 'From franchise not found',
          });
          continue;
        }

        if (!toFranchiseDoc) {
          errors.push({
            index: i,
            message: 'To franchise not found',
          });
          continue;
        }

        // STRICT FRANCHISE SCOPING: Validate user has access to fromFranchise (sending franchise)
        if (user && user.role !== 'admin') {
          const userFranchises = user.franchises || [];
          if (!userFranchises.some((fId) => fId.toString() === fromFranchise.toString())) {
            errors.push({
              index: i,
              message: 'Access denied to sending franchise',
            });
            continue;
          }
        }

        // Validate product exists and belongs to fromFranchise
        const product = await Product.findById(productId);
        if (!product) {
          errors.push({
            index: i,
            message: 'Product not found',
          });
          continue;
        }

        // Verify product belongs to source franchise
        if (product.franchise.toString() !== fromFranchise.toString()) {
          errors.push({
            index: i,
            message: 'Product does not belong to the source franchise',
          });
          continue;
        }

        // Check stock availability
        if (product.stockQuantity < qty) {
          errors.push({
            index: i,
            message: `Insufficient stock. Available: ${product.stockQuantity}, Requested: ${qty}`,
          });
          continue;
        }

        // Parse date
        let transferDate = new Date();
        if (date) {
          const parsedDate = new Date(date);
          if (!isNaN(parsedDate.getTime())) {
            transferDate = parsedDate;
          }
        }

        // Calculate total value
        const totalValue = unitPrice * qty;

        // Create transfer record
        const transferRecord = await Transfer.create({
          product: productId,
          fromFranchise,
          toFranchise,
          quantity: qty,
          unitPrice,
          totalValue,
          status: transferStatus,
          transferDate,
          actualDelivery: transferStatus === 'completed' ? transferDate : undefined,
          initiatedBy: user._id,
          notes: notes || `Stock exported on ${transferDate.toLocaleString()}`,
          history: [{
            date: new Date(),
            status: transferStatus,
            note: `Stock export created`,
            user: user._id,
          }],
        });

        // Reduce product stock in source franchise if status is 'completed'
        if (transferStatus === 'completed') {
          // Update product stock (reduce inventory)
          await Product.findByIdAndUpdate(productId, {
            $inc: { stockQuantity: -qty },
          });

          // Add stock history entry
          if (product.stockHistory) {
            product.stockHistory.push({
              date: transferDate,
              quantity: -qty, // Negative for stock out
              type: 'transfer_out',
              note: `Stock exported to ${toFranchiseDoc.name}`,
              franchise: fromFranchise,
            });
            await product.save();
          }
        }

        // Get updated stock quantity for response
        const updatedProduct = await Product.findById(productId);
        const remainingStock = updatedProduct ? updatedProduct.stockQuantity : product.stockQuantity - qty;

        results.push({
          transferId: transferRecord._id,
          productId: productId.toString(),
          productName: product.name,
          quantity: qty,
          fromFranchise: fromFranchiseDoc.name,
          toFranchise: toFranchiseDoc.name,
          status: transferStatus,
          totalValue,
          remainingStock: transferStatus === 'completed' ? remainingStock : product.stockQuantity,
        });
      } catch (error) {
        errors.push({
          index: i,
          message: error.message || 'Error processing transfer',
        });
      }
    }

    // Update audit log
    if (auditLog) {
      auditLog.successfulRows = results.length;
      auditLog.failedRows = errors.length;
      auditLog.errors = errors.map((err, idx) => ({
        row: err.index !== undefined ? err.index : idx,
        field: 'transfer',
        message: err.message || 'Error processing transfer',
        value: null
      }));
      auditLog.status = errors.length === 0 ? 'completed' : errors.length < transfers.length ? 'partial' : 'failed';
      auditLog.completedAt = new Date();
      auditLog.duration = Date.now() - startTime;
      await auditLog.save().catch(console.error);
    }

    // Return response
    if (errors.length > 0 && results.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'All transfers failed',
        errors,
      });
    }

    res.status(results.length > 0 ? 201 : 400).json({
      success: results.length > 0,
      message: `Processed ${results.length} transfer(s), ${errors.length} error(s)`,
      data: {
        successful: results,
        errors: errors.length > 0 ? errors : undefined,
      },
    });
  } catch (error) {
    console.error('Error exporting stock:', error);
    
    // Update audit log on error
    if (auditLog) {
      auditLog.status = 'failed';
      auditLog.completedAt = new Date();
      auditLog.duration = Date.now() - startTime;
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
      message: 'Failed to export stock',
      error: error.message,
    });
  }
};
