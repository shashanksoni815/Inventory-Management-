// controllers/transfer.controller.js
import Transfer from '../models/Transfer.js';
import { Product } from '../models/Product.model.js';

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
