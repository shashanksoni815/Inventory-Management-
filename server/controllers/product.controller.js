// controllers/product.controller.js
import mongoose from 'mongoose';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
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
      operationType: importLog.importType || 'products',
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

export const getProducts = async (req, res) => {
  try {
    const { 
      franchise, 
      category, 
      search, 
      status, 
      stockStatus,
      page = 1, 
      limit = 20,
      sortBy = 'name',
      sortOrder = 'asc'
    } = req.query;
    
    const user = req.user;
    
    // Request parameters logged only in development
    
    // Build base query with franchise isolation
    let baseQuery = {};
    
    // Apply franchise filtering
    if (user && user.role === 'admin') {
      // Admin: can see all products or filter by explicit franchise param
      if (franchise && franchise !== 'all') {
        baseQuery = {
          $or: [
            { franchise: franchise },
            { isGlobal: true },
          ],
        };
      }
      // If franchise === 'all' or not provided, admin sees all (no filter)
    } else {
      // Non-admin users: apply franchise isolation (includes global products)
      baseQuery = applyFranchiseFilter(req, {}, { includeGlobal: true });
      
      // If explicit franchise param provided and user is manager/sales, validate it matches their franchise
      if (franchise && franchise !== 'all') {
        const userFranchise = user?.franchise?.toString();
        if (userFranchise && userFranchise !== franchise.toString()) {
          return res.status(403).json({
            success: false,
            message: 'Access denied: You can only view products from your assigned franchise',
          });
        }
      }
    }
    
    // Apply additional filters
    const query = { ...baseQuery };
    
    if (category && category !== 'all') {
      query.category = category;
    }
    
    if (status && status !== 'all') {
      query.status = status;
    }
    
    if (stockStatus && stockStatus !== 'all') {
      if (stockStatus === 'low-stock') {
        query.$expr = {
          $lte: [
            '$stockQuantity',
            { $ifNull: ['$replenishmentSettings.reorderPoint', '$minimumStock'] }
          ]
        };
      } else if (stockStatus === 'out-of-stock') {
        query.stockQuantity = 0;
      } else if (stockStatus === 'in-stock') {
        query.$expr = {
          $gt: [
            '$stockQuantity',
            { $ifNull: ['$replenishmentSettings.reorderPoint', '$minimumStock'] }
          ]
        };
      }
    }
    
    // Apply search - use regex instead of $text to avoid text index requirement
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { name: searchRegex },
        { sku: searchRegex },
        { category: searchRegex },
        { brand: searchRegex }
      ];
    }
    
    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Fetch products - name should be included by default
    const [products, total] = await Promise.all([
      Product.find(query)
        .populate('franchise', 'name code metadata.color metadata.icon')
        .populate('sharedWith.franchise', 'name code')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Product.countDocuments(query)
    ]);
    
    // Validate products have names (before transformation)
    const initialProductsWithoutNames = products.filter(p => {
      const name = p.name;
      return !name || typeof name !== 'string' || name.trim() === '';
    });
    if (initialProductsWithoutNames.length > 0 && process.env.NODE_ENV === 'development') {
      console.warn('[Product Controller] Some products missing names:', initialProductsWithoutNames.length);
    }
    
    // Calculate franchise-specific stock
    const franchiseId = franchise || (user?.franchises?.[0]?.toString());
    const productsWithFranchiseStock = products.map(product => {
      let franchiseStock = product.stockQuantity;
      let isShared = false;
      
      // Safely check franchise
      if (franchiseId && product.franchise && product.franchise._id && product.franchise._id.toString() !== franchiseId) {
        const sharedEntry = product.sharedWith?.find(s => 
          s.franchise?._id?.toString() === franchiseId
        );
        if (sharedEntry) {
          franchiseStock = sharedEntry.quantity;
          isShared = true;
        }
      }
      
      // Calculate stock status based on franchise-specific quantity
      let stockStatus = 'in-stock';
      if (franchiseStock === 0) {
        stockStatus = 'out-of-stock';
      } else if (franchiseStock <= (product.replenishmentSettings?.reorderPoint || product.minimumStock)) {
        stockStatus = 'low-stock';
      }
      
      // Ensure all required fields are present - CRITICAL: name must always be present
      const productName = product.name || product.productName || 'Unknown Product';
      
      const productData = {
        ...product,
        name: String(productName).trim() || 'Unknown Product', // Ensure name is always a non-empty string
        sku: String(product.sku || '').trim() || '',
        sellingPrice: Number(product.sellingPrice ?? product.price ?? 0) || 0,
        buyingPrice: Number(product.buyingPrice ?? product.costPrice ?? 0) || 0,
        stockQuantity: Number(product.stockQuantity ?? product.stock ?? 0) || 0,
        franchiseStock,
        isShared,
        stockStatus,
        inventoryValue: franchiseStock * (product.buyingPrice || product.costPrice || 0)
      };
      
      // Final validation
      if (!productData.name || productData.name === '') {
        productData.name = 'Unknown Product'; // Force set name
      }
      
      return productData;
    });
    
    // Final validation before sending response
    const productsWithNames = productsWithFranchiseStock.filter(p => {
      const name = p.name;
      return name && typeof name === 'string' && name.trim() !== '';
    });
    const productsWithoutNames = productsWithFranchiseStock.filter(p => {
      const name = p.name;
      return !name || typeof name !== 'string' || name.trim() === '';
    });
    
    if (productsWithoutNames.length > 0) {
      // Force set names for products missing them
      productsWithoutNames.forEach(p => {
        p.name = p.name || 'Unknown Product';
      });
    }
    
    res.json({
      success: true,
      data: {
        products: productsWithFranchiseStock,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching products',
      error: error.message
    });
  }
};

// Alias used by routes
export const getAllProducts = getProducts;

// Get single product by id
export const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id)
      .populate('franchise', 'name code metadata.color metadata.icon')
      .populate('sharedWith.franchise', 'name code')
      .lean();

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    res.json({
      success: true,
      data: product,
    });
  } catch (error) {
    console.error('Error fetching product by id:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching product',
      error: error.message,
    });
  }
};

/**
 * Get public product information by SKU
 * No authentication required - public endpoint
 */
export const getPublicProductBySku = async (req, res) => {
  try {
    const { sku } = req.params;
    
    if (!sku || typeof sku !== 'string' || !sku.trim()) {
      return res.status(400).json({
        success: false,
        message: 'SKU is required',
      });
    }

    const skuUpper = sku.trim().toUpperCase();
    
    // Find product by SKU - can be from any franchise or global
    const product = await Product.findOne({ sku: skuUpper, status: 'active' })
      .populate('franchise', 'name code')
      .lean();

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    // Calculate tax percentage if not present (default to 0)
    const taxPercentage = product.taxPercentage || 0;

    // Determine stock availability status (without exposing exact quantities)
    const isInStock = (product.stockQuantity || 0) > 0;

    // Return only public-safe fields - NO sensitive internal data
    const publicProduct = {
      // Basic product info (safe)
      image: product.images && product.images.length > 0 ? product.images[0].url : null,
      name: product.name,
      sku: product.sku,
      category: product.category || 'Other',
      brand: product.brand || '',
      description: product.description || '',
      
      // Pricing info (safe - only selling price, not buying price)
      sellingPrice: product.sellingPrice,
      taxPercentage: taxPercentage,
      
      // Stock availability (safe - only status, not exact quantities or internal stock info)
      isInStock: isInStock,
      
      // Franchise info (safe - only public name and code, no internal IDs)
      franchise: product.franchise ? {
        name: product.franchise.name,
        code: product.franchise.code,
        // Explicitly exclude: _id, id, or any other internal identifiers
      } : null,
      
      // Explicitly excluded sensitive fields:
      // - buyingPrice (cost information)
      // - profitMargin (profit information)
      // - stockQuantity (exact stock numbers)
      // - reservedQuantity (internal stock reservations)
      // - minimumStock (internal reorder points)
      // - _id or any MongoDB ObjectIds
      // - totalSold, totalRevenue, totalProfit (sales analytics)
      // - stockHistory (internal stock movements)
      // - franchisePricing (internal pricing data)
      // - replenishmentSettings (internal inventory management)
      // - sharedWith (internal product sharing data)
      // - isGlobal (internal product configuration)
      // - status (internal product status - only active products are returned)
      // - lastSold (internal sales data)
    };

    res.json({
      success: true,
      data: publicProduct,
    });
  } catch (error) {
    console.error('Error fetching public product by SKU:', error);
    // Security: Don't expose internal error details to public API
    res.status(500).json({
      success: false,
      message: 'Error fetching product. Please try again later.',
      // Explicitly exclude: error.message, error.stack, or any internal error details
    });
  }
};

// export const createProduct = async (req, res) => {
//   try {
//     const user = req.user;
//     const productData = req.body;
    
//     // Validate required fields
//     if (!productData.sku || !productData.name || !productData.category) {
//       return res.status(400).json({
//         success: false,
//         message: 'SKU, name, and category are required'
//       });
//     }
    
//     // Set franchise if not provided (only when user is present)
//     if (!productData.franchise && user) {
//       if (user.role !== 'admin') {
//         // Use user's default franchise or first franchise
//         productData.franchise = user.defaultFranchise || user.franchises?.[0];
//       }
//     }

//     // If still no franchise, allow create as global/unassigned

//     // Verify user has access to this franchise when both exist
//     if (user && productData.franchise && user.role !== 'admin' && !user.franchises?.includes(productData.franchise)) {
//       return res.status(403).json({
//         success: false,
//         message: 'Access denied to this franchise'
//       });
//     }
    
//     // Check if SKU already exists in this franchise
//     const existingProduct = await Product.findOne({
//       sku: productData.sku.toUpperCase(),
//       franchise: productData.franchise
//     });
    
//     if (existingProduct) {
//       return res.status(400).json({
//         success: false,
//         message: `SKU "${productData.sku}" already exists in this franchise`
//       });
//     }
    
//     // Create product
//     const product = new Product({
//       ...productData,
//       sku: productData.sku.toUpperCase(),
//       franchise: productData.franchise,
//       isGlobal: productData.isGlobal || false
//     });
    
//     await product.save();
    
//     // Populate franchise data
//     const populatedProduct = await Product.findById(product._id)
//       .populate('franchise', 'name code metadata.color metadata.icon');
    
//     res.status(201).json({
//       success: true,
//       message: 'Product created successfully',
//       data: populatedProduct
//     });
//   } catch (error) {
//     console.error('Error creating product:', error);
//     res.status(400).json({
//       success: false,
//       message: 'Error creating product',
//       error: error.message
//     });
//   }
// };

export const createProduct = async (req, res) => {
  try {
    const {
      name,
      sku,
      category,
      buyingPrice,
      sellingPrice,
      stock,
      stockQuantity,
      franchise,
      isGlobal,
      brand,
      description,
      minimumStock,
      images,
      status
    } = req.body;

    if (!franchise) {
      return res.status(400).json({
        success: false,
        message: 'Franchise ID is required'
      });
    }
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Product name is required'
      });
    }
    if (!sku || typeof sku !== 'string' || !sku.trim()) {
      return res.status(400).json({
        success: false,
        message: 'SKU is required'
      });
    }
    const numBuying = Number(buyingPrice);
    const numSelling = Number(sellingPrice);
    if (Number.isNaN(numBuying) || numBuying < 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid buying price is required'
      });
    }
    if (Number.isNaN(numSelling) || numSelling < 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid selling price is required'
      });
    }

    const quantity = Number(stock ?? stockQuantity);
    const stockQty = Number.isNaN(quantity) || quantity < 0 ? 0 : quantity;

    // Check for existing SKU: if isGlobal, check globally; otherwise check within franchise
    const skuUpper = String(sku).trim().toUpperCase();
    const existingQuery = isGlobal 
      ? { sku: skuUpper, isGlobal: true }
      : { sku: skuUpper, franchise };
    
    const existing = await Product.findOne(existingQuery);
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `SKU "${sku}" already exists${isGlobal ? ' globally' : ` for this franchise`}`
      });
    }

    const minStock = Number(minimumStock) >= 0 ? Number(minimumStock) : 10;
    const product = await Product.create({
      name: name.trim(),
      sku: skuUpper,
      category: category || 'Other',
      buyingPrice: numBuying,
      sellingPrice: numSelling,
      stockQuantity: stockQty,
      franchise,
      isGlobal: Boolean(isGlobal) || false,
      brand: brand ? String(brand).trim() : undefined,
      description: description ? String(description).trim() : undefined,
      minimumStock: minStock,
      images: Array.isArray(images) ? images : undefined,
      status: status && ['active', 'inactive', 'discontinued'].includes(status) ? status : 'active'
    });

    if (stockQty < minStock && franchise) {
      createSystemNotification({
        title: 'Low Stock Alert',
        message: `${product.name} (${product.sku}) is below minimum stock. Current: ${stockQty}, Minimum: ${minStock}`,
        type: 'inventory',
        priority: stockQty === 0 ? 'high' : 'medium',
        franchise,
      }).catch(() => {});
    }

    const populated = await Product.findById(product._id)
      .populate('franchise', 'name code')
      .lean();

    res.status(201).json({
      success: true,
      product: populated || product
    });
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const { user } = req;
    
    // Find product
    const product = await Product.findById(id)
      .populate('franchise', 'name code');
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    // Check access
    if (user.role !== 'admin' && !user.franchises.includes(product.franchise._id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this product'
      });
    }
    
    // Update product
    Object.keys(updates).forEach(key => {
      if (key !== '_id' && key !== '__v' && key !== 'createdAt' && key !== 'updatedAt') {
        product[key] = updates[key];
      }
    });
    
    await product.save();

    const minStock = product.minimumStock ?? 10;
    if (product.stockQuantity < minStock && product.franchise) {
      const fid = product.franchise._id || product.franchise;
      createSystemNotification({
        title: 'Low Stock Alert',
        message: `${product.name} (${product.sku}) is below minimum stock. Current: ${product.stockQuantity}, Minimum: ${minStock}`,
        type: 'inventory',
        priority: product.stockQuantity === 0 ? 'high' : 'medium',
        franchise: fid,
      }).catch(() => {});
    }
    
    res.json({
      success: true,
      message: 'Product updated successfully',
      data: product
    });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(400).json({
      success: false,
      message: 'Error updating product',
      error: error.message
    });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req;

    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    // Check access
    if (user.role !== 'admin' && !user.franchises.includes(product.franchise)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this product',
      });
    }

    await Product.deleteOne({ _id: id });

    res.json({
      success: true,
      message: 'Product deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(400).json({
      success: false,
      message: 'Error deleting product',
      error: error.message,
    });
  }
};

export const shareProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { franchiseIds } = req.body;
    const { user } = req;
    
    const product = await Product.findById(id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    // Check if product is global
    if (!product.isGlobal) {
      return res.status(400).json({
        success: false,
        message: 'Only global products can be shared with other franchises'
      });
    }
    
    // Check access
    if (user.role !== 'admin' && !user.franchises.includes(product.franchise)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this product'
      });
    }
    
    // Validate franchises exist
    const franchises = await Franchise.find({ _id: { $in: franchiseIds } });
    if (franchises.length !== franchiseIds.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more franchises not found'
      });
    }
    
    // Add franchises to sharedWith
    franchiseIds.forEach(franchiseId => {
      if (!product.sharedWith.some(s => s.franchise.toString() === franchiseId)) {
        product.sharedWith.push({ franchise: franchiseId, quantity: 0 });
      }
    });
    
    await product.save();
    
    res.json({
      success: true,
      message: 'Product shared successfully',
      data: product
    });
  } catch (error) {
    console.error('Error sharing product:', error);
    res.status(400).json({
      success: false,
      message: 'Error sharing product',
      error: error.message
    });
  }
};

export const transferStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { toFranchiseId, quantity, note } = req.body;
    const { user } = req;
    
    const product = await Product.findById(id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    // Check access
    if (user.role !== 'admin' && !user.franchises.includes(product.franchise)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this product'
      });
    }
    
    // Check if transferable
    if (!product.transferable) {
      return res.status(400).json({
        success: false,
        message: 'Product is not transferable'
      });
    }
    
    // Check stock availability
    if (product.stockQuantity < quantity) {
      return res.status(400).json({
        success: false,
        message: `Insufficient stock. Available: ${product.stockQuantity}`
      });
    }
    
    // Check if target franchise exists
    const targetFranchise = await Franchise.findById(toFranchiseId);
    if (!targetFranchise) {
      return res.status(404).json({
        success: false,
        message: 'Target franchise not found'
      });
    }
    
    // Perform transfer
    await product.transferStock(toFranchiseId, quantity, note);
    
    res.json({
      success: true,
      message: `Transferred ${quantity} units to ${targetFranchise.name}`,
      data: product
    });
  } catch (error) {
    console.error('Error transferring stock:', error);
    res.status(400).json({
      success: false,
      message: 'Error transferring stock',
      error: error.message
    });
  }
};

export const bulkDeleteProducts = async (req, res) => {
  try {
    const { ids } = req.body;
    const { user } = req;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No product ids provided',
      });
    }

    const query = {
      _id: { $in: ids },
    };

    if (user.role !== 'admin') {
      query.franchise = { $in: user.franchises };
    }

    const result = await Product.deleteMany(query);

    res.json({
      success: true,
      message: 'Products deleted successfully',
      data: { deletedCount: result.deletedCount },
    });
  } catch (error) {
    console.error('Error bulk deleting products:', error);
    res.status(400).json({
      success: false,
      message: 'Error deleting products',
      error: error.message,
    });
  }
};

export const getProductAnalytics = async (req, res) => {
  try {
    const { franchiseId } = req.params;
    const { period = 'month' } = req.query;
    const user = req.user;
    
    // Validate franchiseId
    if (!franchiseId || !mongoose.Types.ObjectId.isValid(franchiseId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid franchise ID'
      });
    }
    
    // Check access - User has franchise (singular) for manager/sales
    if (user && user.role !== 'admin' && user.role !== 'superAdmin') {
      const userFranchiseId = user.franchise?._id?.toString() || user.franchise?.toString();
      if (!userFranchiseId || userFranchiseId !== String(franchiseId)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this franchise'
        });
      }
    }
    
    const dateFilter = getDateFilter(period);
    const franchiseObjectId = new mongoose.Types.ObjectId(franchiseId);
    
    // Get analytics for all products in franchise (not filtered by lastSold for summary)
    const analytics = await Product.aggregate([
      {
        $match: {
          $or: [
            { franchise: franchiseObjectId },
            { isGlobal: true, 'sharedWith.franchise': franchiseObjectId }
          ]
        }
      },
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          totalStock: { $sum: '$stockQuantity' },
          inventoryValue: { $sum: { $multiply: ['$stockQuantity', '$buyingPrice'] } },
          lowStockCount: {
            $sum: {
              $cond: [
                {
                  $lte: [
                    '$stockQuantity',
                    { $ifNull: ['$replenishmentSettings.reorderPoint', '$minimumStock'] }
                  ]
                },
                1,
                0
              ]
            }
          },
          outOfStockCount: {
            $sum: {
              $cond: [{ $eq: ['$stockQuantity', 0] }, 1, 0]
            }
          },
          totalRevenue: { $sum: '$totalRevenue' },
          totalProfit: { $sum: '$totalProfit' }
        }
      },
      {
        $project: {
          totalProducts: 1,
          totalStock: 1,
          inventoryValue: 1,
          lowStockCount: 1,
          outOfStockCount: 1,
          totalRevenue: 1,
          totalProfit: 1,
          averageProfitMargin: {
            $cond: [
              { $gt: ['$totalRevenue', 0] },
              { $multiply: [{ $divide: ['$totalProfit', '$totalRevenue'] }, 100] },
              0
            ]
          }
        }
      }
    ]);
    
    // Get top selling products (filtered by period if lastSold exists)
    const topProducts = await Product.aggregate([
      {
        $match: {
          $and: [
            {
              $or: [
                { franchise: franchiseObjectId },
                { isGlobal: true, 'sharedWith.franchise': franchiseObjectId }
              ]
            },
            {
              $or: [
                { lastSold: { $gte: dateFilter.start } },
                { lastSold: { $exists: false } },
                { lastSold: null }
              ]
            }
          ]
        }
      },
      { $sort: { totalSold: -1 } },
      { $limit: 10 },
      {
        $project: {
          name: 1,
          sku: 1,
          category: 1,
          totalSold: 1,
          totalRevenue: 1,
          totalProfit: 1,
          stockQuantity: 1,
          stockStatus: {
            $cond: {
              if: { $eq: ['$stockQuantity', 0] },
              then: 'out-of-stock',
              else: {
                $cond: {
                  if: {
                    $lte: [
                      '$stockQuantity',
                      { $ifNull: ['$replenishmentSettings.reorderPoint', '$minimumStock'] }
                    ]
                  },
                  then: 'low-stock',
                  else: 'in-stock'
                }
              }
            }
          }
        }
      }
    ]);
    
    // Get category distribution
    const categoryDistribution = await Product.aggregate([
      {
        $match: {
          $or: [
            { franchise: franchiseObjectId },
            { isGlobal: true, 'sharedWith.franchise': franchiseObjectId }
          ]
        }
      },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          totalStock: { $sum: '$stockQuantity' },
          inventoryValue: { $sum: { $multiply: ['$stockQuantity', '$buyingPrice'] } }
        }
      },
      { $sort: { count: -1 } }
    ]);
    
    res.json({
      success: true,
      data: {
        summary: analytics[0] || {
          totalProducts: 0,
          totalStock: 0,
          inventoryValue: 0,
          lowStockCount: 0,
          outOfStockCount: 0,
          totalRevenue: 0,
          totalProfit: 0,
          averageProfitMargin: 0
        },
        topProducts,
        categoryDistribution
      }
    });
  } catch (error) {
    console.error('Error fetching product analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching product analytics',
      error: error.message
    });
  }
};

function getDateFilter(period) {
  const now = new Date();
  const start = new Date();
  
  switch (period) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      break;
    case 'week':
    case '7d':
      start.setDate(start.getDate() - 7);
      break;
    case 'month':
    case '30d':
      start.setDate(start.getDate() - 30);
      break;
    case '90d':
      start.setDate(start.getDate() - 90);
      break;
    case 'quarter':
      start.setMonth(start.getMonth() - 3);
      break;
    case 'year':
    case '1y':
      start.setFullYear(start.getFullYear() - 1);
      break;
    default:
      // Default to 30 days
      start.setDate(start.getDate() - 30);
  }
  
  return { start, end: now };
}

export const bulkUpdateProducts = async (req, res) => {
  try {
    const { franchiseId, updates } = req.body;
    const { user } = req;
    
    // Check access
    if (user.role !== 'admin' && !user.franchises.includes(franchiseId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this franchise'
      });
    }
    
    const results = [];
    
    for (const update of updates) {
      try {
        const product = await Product.findOne({
          _id: update.productId,
          franchise: franchiseId
        });
        
        if (product) {
          if (update.field === 'stockQuantity') {
            // Add to stock history
            product.stockHistory.push({
              quantity: update.value - product.stockQuantity,
              type: 'adjustment',
              note: update.note || 'Bulk update',
              franchise: franchiseId
            });
          }
          
          product[update.field] = update.value;
          await product.save();
          results.push({ productId: update.productId, success: true });
        } else {
          results.push({ productId: update.productId, success: false, error: 'Product not found' });
        }
      } catch (error) {
        results.push({ productId: update.productId, success: false, error: error.message });
      }
    }
    
    res.json({
      success: true,
      message: 'Bulk update completed',
      data: results
    });
  } catch (error) {
    console.error('Error in bulk update:', error);
    res.status(400).json({
      success: false,
      message: 'Error updating products',
      error: error.message
    });
  }
};

export const updateStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity, type, note } = req.body;
    const { user } = req;

    const delta = Number(quantity);
    if (!Number.isFinite(delta) || delta === 0) {
      return res.status(400).json({
        success: false,
        message: 'A non-zero numeric quantity is required',
      });
    }

    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    if (user.role !== 'admin' && !user.franchises.includes(product.franchise)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this product',
      });
    }

    const newQty = product.stockQuantity + delta;
    if (newQty < 0) {
      return res.status(400).json({
        success: false,
        message: 'Resulting stock quantity cannot be negative',
      });
    }

    product.stockQuantity = newQty;
    product.stockHistory.push({
      quantity: delta,
      type: type || 'adjustment',
      note: note || 'Manual stock update',
      franchise: product.franchise,
    });

    await product.save();

    const minStock = product.minimumStock ?? 10;
    if (newQty < minStock && product.franchise) {
      const fid = product.franchise._id || product.franchise;
      createSystemNotification({
        title: 'Low Stock Alert',
        message: `${product.name} (${product.sku}) is below minimum stock. Current: ${newQty}, Minimum: ${minStock}`,
        type: 'inventory',
        priority: newQty === 0 ? 'high' : 'medium',
        franchise: fid,
      }).catch(() => {});
    }

    res.json({
      success: true,
      message: 'Stock updated successfully',
      data: product,
    });
  } catch (error) {
    console.error('Error updating stock:', error);
    res.status(400).json({
      success: false,
      message: 'Error updating stock',
      error: error.message,
    });
  }
};

export const getLowStockProducts = async (req, res) => {
  try {
    const { franchise } = req.query;
    const { user } = req;

    const franchiseId = franchise || user.defaultFranchise || user.franchises?.[0];
    if (!franchiseId) {
      return res.status(400).json({
        success: false,
        message: 'Franchise id is required',
      });
    }

    if (user.role !== 'admin' && !user.franchises.includes(franchiseId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this franchise',
      });
    }

    const products = await Product.getLowStockProducts(franchiseId);

    res.json({
      success: true,
      data: products,
    });
  } catch (error) {
    console.error('Error fetching low stock products:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching low stock products',
      error: error.message,
    });
  }
};

/**
 * Import products from Excel file
 * POST /api/products/import
 * 
 * Expected Excel columns:
 * - productId (optional, for updates)
 * - productName (required)
 * - sku (required, unique per franchise)
 * - category (required, enum: Electronics, Clothing, Books, Home & Kitchen, Sports, Other)
 * - costPrice (required, >= 0)
 * - sellingPrice (required, >= 0)
 * - quantity (required, >= 0)
 * - franchiseId (required)
 */
export const importProducts = async (req, res) => {
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
      importType: 'products',
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
    const requiredColumns = ['productname', 'sku', 'category', 'costprice', 'sellingprice', 'quantity', 'franchiseid'];
    const missingColumns = requiredColumns.filter(col => !headers[col]);
    
    if (missingColumns.length > 0) {
      throw new Error(`Missing required columns: ${missingColumns.join(', ')}`);
    }

    // Process rows (skip header row)
    const rows = [];
    const errors = [];
    const warnings = [];
    let successfulCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    // Track SKUs per franchise for uniqueness validation
    const skuMap = new Map(); // franchiseId -> Set of SKUs

    // Process rows based on file type
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
      const rowWarnings = [];

      // Validate productName
      const productName = rowData['productname'];
      if (!productName || productName.length === 0) {
        rowErrors.push({ field: 'productName', message: 'Product name is required', value: productName });
      }

      // Validate SKU
      const sku = rowData['sku']?.toUpperCase().trim();
      if (!sku || sku.length === 0) {
        rowErrors.push({ field: 'sku', message: 'SKU is required', value: sku });
      }

      // Validate category
      const category = rowData['category'];
      const validCategories = ['Electronics', 'Clothing', 'Books', 'Home & Kitchen', 'Sports', 'Other'];
      if (!category || !validCategories.includes(category)) {
        rowErrors.push({
          field: 'category',
          message: `Category must be one of: ${validCategories.join(', ')}`,
          value: category,
        });
      }

      // Validate costPrice
      const costPrice = parseFloat(rowData['costprice']);
      if (isNaN(costPrice) || costPrice < 0) {
        rowErrors.push({
          field: 'costPrice',
          message: 'Cost price must be a number >= 0',
          value: rowData['costprice'],
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

      // Validate quantity
      const quantity = parseFloat(rowData['quantity']);
      if (isNaN(quantity) || quantity < 0) {
        rowErrors.push({
          field: 'quantity',
          message: 'Quantity must be a number >= 0',
          value: rowData['quantity'],
        });
      }

      // Validate franchiseId
      const franchiseId = rowData['franchiseid'];
      if (!franchiseId || !mongoose.Types.ObjectId.isValid(franchiseId)) {
        rowErrors.push({
          field: 'franchiseId',
          message: 'Valid franchise ID is required',
          value: franchiseId,
        });
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

      // Check SKU uniqueness per franchise
      if (sku && franchiseId && mongoose.Types.ObjectId.isValid(franchiseId)) {
        const franchiseKey = franchiseId.toString();
        if (!skuMap.has(franchiseKey)) {
          skuMap.set(franchiseKey, new Set());
        }
        if (skuMap.get(franchiseKey).has(sku)) {
          rowErrors.push({
            field: 'sku',
            message: `SKU "${sku}" already exists in this franchise (duplicate in import file)`,
            value: sku,
          });
        } else {
          skuMap.get(franchiseKey).add(sku);
        }
      }

      // If there are errors, add to errors array and skip processing
      if (rowErrors.length > 0) {
        errors.push({
          row: rowNumber,
          field: rowErrors[0].field,
          message: rowErrors.map(e => e.message).join('; '),
          value: rowErrors[0].value,
        });
        failedCount++;
        return;
      }

      // Add row data for processing
      rows.push({
        rowNumber,
        productId: rowData['productid'] || null,
        productName,
        sku,
        category,
        costPrice,
        sellingPrice,
        quantity: Math.floor(quantity), // Ensure integer
        franchiseId: new mongoose.Types.ObjectId(franchiseId),
        brand: rowData['brand'] || '',
        description: rowData['description'] || '',
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

    // Set franchise for import log (use first valid franchise from rows)
    if (rows.length > 0) {
      importLog.franchise = rows[0].franchiseId;
    }

    // Process valid rows
    const processedProducts = [];

    for (const row of rows) {
      try {
        // Check if franchise exists
        const franchise = await Franchise.findById(row.franchiseId);
        if (!franchise) {
          errors.push({
            row: row.rowNumber,
            field: 'franchiseId',
            message: 'Franchise not found',
            value: row.franchiseId.toString(),
          });
          failedCount++;
          continue;
        }

        // Check if product exists (by productId or SKU+franchise)
        let product = null;
        if (row.productId && mongoose.Types.ObjectId.isValid(row.productId)) {
          product = await Product.findOne({
            _id: row.productId,
            franchise: row.franchiseId,
          });
        }

        // If not found by ID, check by SKU+franchise
        if (!product) {
          product = await Product.findOne({
            sku: row.sku,
            franchise: row.franchiseId,
          });
        }

        if (product) {
          // Update existing product
          product.name = row.productName;
          product.category = row.category;
          product.buyingPrice = row.costPrice;
          product.sellingPrice = row.sellingPrice;
          product.stockQuantity = row.quantity;
          if (row.brand) product.brand = row.brand;
          if (row.description) product.description = row.description;

          // Add to stock history if quantity changed
          if (product.stockQuantity !== row.quantity) {
            product.stockHistory.push({
              quantity: row.quantity - product.stockQuantity,
              type: 'adjustment',
              note: 'Bulk import - stock update',
              franchise: row.franchiseId,
            });
          }

          await product.save();
          processedProducts.push({ productId: product._id, action: 'updated', sku: product.sku });
        } else {
          // Create new product
          product = new Product({
            name: row.productName,
            sku: row.sku,
            category: row.category,
            buyingPrice: row.costPrice,
            sellingPrice: row.sellingPrice,
            stockQuantity: row.quantity,
            franchise: row.franchiseId,
            brand: row.brand || '',
            description: row.description || '',
            status: 'active',
            isGlobal: false,
            transferable: true,
          });

          // Add initial stock history entry
          product.stockHistory.push({
            quantity: row.quantity,
            type: 'purchase',
            note: 'Bulk import - initial stock',
            franchise: row.franchiseId,
          });

          await product.save();
          processedProducts.push({ productId: product._id, action: 'created', sku: product.sku });
        }

        successfulCount++;
      } catch (error) {
        // Handle duplicate key error (SKU uniqueness)
        if (error.code === 11000) {
          errors.push({
            row: row.rowNumber,
            field: 'sku',
            message: `SKU "${row.sku}" already exists in this franchise`,
            value: row.sku,
          });
        } else {
          errors.push({
            row: row.rowNumber,
            field: 'general',
            message: error.message || 'Error processing product',
            value: row.sku,
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
      message: `Import completed: ${successfulCount} successful, ${failedCount} failed, ${skippedCount} skipped`,
      data: {
        importLogId: importLog._id,
        totalRows: importLog.totalRows,
        successfulRows: successfulCount,
        failedRows: failedCount,
        skippedRows: skippedCount,
        errors: errors.length > 0 ? errors.slice(0, 50) : [], // Limit errors in response
        processedProducts: processedProducts.slice(0, 100), // Limit products in response
      },
    });
  } catch (error) {
    console.error('Error importing products:', error);

    // Update import log if it exists
    if (importLog) {
      importLog.status = 'failed';
      importLog.completedAt = new Date();
      importLog.duration = Date.now() - (Date.now() - (importLog.startedAt?.getTime() || Date.now()));
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
      message: 'Error importing products',
      error: error.message,
      importLogId: importLog?._id || null,
    });
  }
};

/**
 * Export products to Excel or PDF
 * GET /api/products/export?format=excel|pdf&franchise=...&category=...&stockStatus=...
 */
export const exportProducts = async (req, res) => {
  try {
    const { 
      format = 'excel',
      franchise, 
      category, 
      stockStatus,
      status 
    } = req.query;
    
    const user = req.user;
    
    // Role-Based Access Control: Check franchise access
    if (franchise && franchise !== 'all') {
      // Validate franchise access for franchise managers
      if (user.role === 'franchise_manager') {
        if (!user.franchises || !Array.isArray(user.franchises) || 
            !user.franchises.some(f => f?.toString() === franchise.toString())) {
          return res.status(403).json({
            success: false,
            message: 'Access denied: You do not have access to this franchise',
          });
        }
      }
      // Admin/SuperAdmin can access all franchises - no check needed
    } else if (user.role === 'franchise_manager') {
      // Franchise managers must have at least one franchise assigned
      if (!user.franchises || !Array.isArray(user.franchises) || user.franchises.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: No franchises assigned to your account',
        });
      }
    }
    
    // Build query (same logic as getProducts)
    let baseQuery = {};
    
    // Apply franchise filtering
    if (franchise && franchise !== 'all') {
      baseQuery = {
        $or: [
          { franchise: franchise },
          { isGlobal: true, 'sharedWith.franchise': franchise },
          { isGlobal: true, franchise: franchise }
        ]
      };
    } else if (user && user.role !== 'admin' && user.role !== 'superAdmin' && Array.isArray(user.franchises) && user.franchises.length > 0) {
      // Franchise managers: only see products from their franchises
      baseQuery = {
        $or: user.franchises.map(franchiseId => ({
          $or: [
            { franchise: franchiseId },
            { isGlobal: true, 'sharedWith.franchise': franchiseId },
            { isGlobal: true, franchise: franchiseId }
          ]
        })),
      };
    }
    
    // Apply additional filters
    const query = { ...baseQuery };
    
    if (category && category !== 'all') {
      query.category = category;
    }
    
    if (status && status !== 'all') {
      query.status = status;
    }
    
    if (stockStatus && stockStatus !== 'all') {
      if (stockStatus === 'low-stock') {
        query.$expr = {
          $lte: [
            '$stockQuantity',
            { $ifNull: ['$replenishmentSettings.reorderPoint', '$minimumStock'] }
          ]
        };
      } else if (stockStatus === 'out-of-stock') {
        query.stockQuantity = 0;
      } else if (stockStatus === 'in-stock') {
        query.$expr = {
          $gt: [
            '$stockQuantity',
            { $ifNull: ['$replenishmentSettings.reorderPoint', '$minimumStock'] }
          ]
        };
      }
    }
    
    // Fetch products with franchise population
    // Sort by date (latest first) per structured export format rules
    const products = await Product.find(query)
      .populate('franchise', 'name code')
      .sort({ createdAt: -1 })
      .lean();
    
    // Calculate franchise-specific stock and prepare data
    const franchiseId = franchise || (user?.franchises?.[0]?.toString());
    const exportData = products.map(product => {
      let franchiseStock = product.stockQuantity;
      let isShared = false;
      
      if (franchiseId && product.franchise?._id?.toString() !== franchiseId) {
        const sharedEntry = product.sharedWith?.find(s => 
          s.franchise?.toString() === franchiseId
        );
        if (sharedEntry) {
          franchiseStock = sharedEntry.quantity;
          isShared = true;
        }
      }
      
      // Calculate stock status
      let stockStatusValue = 'In Stock';
      if (franchiseStock === 0) {
        stockStatusValue = 'Out of Stock';
      } else if (franchiseStock <= (product.replenishmentSettings?.reorderPoint || product.minimumStock || 10)) {
        stockStatusValue = 'Low Stock';
      }
      
      const inventoryValue = franchiseStock * product.buyingPrice;
      const profitMargin = product.buyingPrice > 0 
        ? ((product.sellingPrice - product.buyingPrice) / product.buyingPrice * 100).toFixed(2)
        : '0.00';
      
      return {
        productId: product._id.toString(),
        sku: product.sku,
        name: product.name,
        category: product.category,
        brand: product.brand || '',
        buyingPrice: product.buyingPrice,
        sellingPrice: product.sellingPrice,
        profitMargin: `${profitMargin}%`,
        stockQuantity: franchiseStock,
        minimumStock: product.minimumStock || 10,
        inventoryValue: inventoryValue,
        stockStatus: stockStatusValue,
        status: product.status,
        franchiseName: product.franchise?.name || 'N/A',
        franchiseCode: product.franchise?.code || 'N/A',
        isShared: isShared,
        createdAt: product.createdAt ? new Date(product.createdAt).toLocaleDateString() : 'N/A',
        updatedAt: product.updatedAt ? new Date(product.updatedAt).toLocaleDateString() : 'N/A',
        lastSold: product.lastSold ? new Date(product.lastSold).toLocaleDateString() : 'Never',
      };
    });
    
    // Calculate totals
    const totals = {
      totalProducts: exportData.length,
      totalStock: exportData.reduce((sum, p) => sum + p.stockQuantity, 0),
      totalInventoryValue: exportData.reduce((sum, p) => sum + p.inventoryValue, 0),
      totalBuyingValue: exportData.reduce((sum, p) => sum + (p.stockQuantity * p.buyingPrice), 0),
      avgProfitMargin: exportData.length > 0
        ? (exportData.reduce((sum, p) => sum + parseFloat(p.profitMargin), 0) / exportData.length).toFixed(2)
        : '0.00',
      lowStockCount: exportData.filter(p => p.stockStatus === 'Low Stock').length,
      outOfStockCount: exportData.filter(p => p.stockStatus === 'Out of Stock').length,
    };
    
    // Create audit log entry for export
    const startTime = Date.now();
    const fileName = `products-export-${new Date().toISOString().slice(0, 10)}.${format === 'excel' || format === 'xlsx' ? 'xlsx' : 'pdf'}`;
    let auditLog = new AuditLog({
      actionType: 'export',
      operationType: 'products',
      fileName: fileName,
      format: format === 'excel' || format === 'xlsx' ? 'excel' : format,
      user: user._id,
      franchise: franchise && franchise !== 'all' ? franchise : null,
      totalRecords: exportData.length,
      exportedRecords: exportData.length,
      status: 'processing',
      startedAt: new Date(),
      requestParams: new Map(Object.entries({
        category: category || 'all',
        status: status || 'all',
        stockStatus: stockStatus || 'all',
        format: format
      })),
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    });
    await auditLog.save();
    
    // Generate export based on format
    if (format === 'excel' || format === 'xlsx') {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Products');
      
      // Define columns - Structured format: IDs, Names, Dates, Franchise
      worksheet.columns = [
        { header: 'Product ID', key: 'productId', width: 25 },
        { header: 'SKU', key: 'sku', width: 15 },
        { header: 'Product Name', key: 'name', width: 30 },
        { header: 'Category', key: 'category', width: 20 },
        { header: 'Brand', key: 'brand', width: 15 },
        { header: 'Created Date', key: 'createdAt', width: 15 },
        { header: 'Updated Date', key: 'updatedAt', width: 15 },
        { header: 'Franchise', key: 'franchiseName', width: 20 },
        { header: 'Franchise Code', key: 'franchiseCode', width: 15 },
        { header: 'Buying Price', key: 'buyingPrice', width: 15 },
        { header: 'Selling Price', key: 'sellingPrice', width: 15 },
        { header: 'Profit Margin %', key: 'profitMargin', width: 15 },
        { header: 'Stock Quantity', key: 'stockQuantity', width: 15 },
        { header: 'Min Stock', key: 'minimumStock', width: 12 },
        { header: 'Inventory Value', key: 'inventoryValue', width: 18 },
        { header: 'Stock Status', key: 'stockStatus', width: 15 },
        { header: 'Status', key: 'status', width: 12 },
        { header: 'Last Sold', key: 'lastSold', width: 15 },
      ];
      
      // Style header row
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };
      
      // Add data rows
      exportData.forEach(product => {
        const row = worksheet.addRow(product);
        
        // Color code stock status
        if (product.stockStatus === 'Out of Stock') {
          row.getCell('stockStatus').fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFE0E0' }
          };
        } else if (product.stockStatus === 'Low Stock') {
          row.getCell('stockStatus').fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFFFE0' }
          };
        }
      });
      
      // Add empty row before totals
      worksheet.addRow([]);
      
      // Add totals row
      const totalsRow = worksheet.addRow({
        productId: 'TOTALS',
        sku: '',
        name: '',
        category: '',
        brand: '',
        buyingPrice: '',
        sellingPrice: '',
        profitMargin: `${totals.avgProfitMargin}%`,
        stockQuantity: totals.totalStock,
        minimumStock: '',
        inventoryValue: totals.totalInventoryValue,
        stockStatus: `Low: ${totals.lowStockCount}, Out: ${totals.outOfStockCount}`,
        status: `Total: ${totals.totalProducts}`,
        franchiseName: '',
        franchiseCode: '',
        lastSold: '',
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
        `attachment; filename=products-export-${new Date().toISOString().split('T')[0]}.xlsx`
      );
      
      // Get file size before writing
      const buffer = await workbook.xlsx.writeBuffer();
      auditLog.fileSize = buffer.length;
      auditLog.status = 'completed';
      auditLog.completedAt = new Date();
      auditLog.duration = Date.now() - startTime;
      auditLog.exportedRecords = exportData.length;
      await auditLog.save().catch(console.error);

      res.send(buffer);
      
    } else if (format === 'pdf') {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      
      // Set response headers
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=products-export-${new Date().toISOString().split('T')[0]}.pdf`
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
        auditLog.exportedRecords = exportData.length;
        await auditLog.save().catch(console.error);
      });

      // Pipe PDF to response
      doc.pipe(res);
      
      // Header
      doc.fontSize(20).text('Products Export', { align: 'center' });
      doc.moveDown();
      doc.fontSize(10).text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
      doc.moveDown(2);
      
      // Summary section
      doc.fontSize(14).text('Summary', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10);
      doc.text(`Total Products: ${totals.totalProducts}`);
      doc.text(`Total Stock: ${totals.totalStock}`);
      doc.text(`Total Inventory Value: $${totals.totalInventoryValue.toFixed(2)}`);
      doc.text(`Average Profit Margin: ${totals.avgProfitMargin}%`);
      doc.text(`Low Stock Items: ${totals.lowStockCount}`);
      doc.text(`Out of Stock Items: ${totals.outOfStockCount}`);
      doc.moveDown(2);
      
      // Table header - Structured format: IDs, Names, Dates, Franchise
      doc.fontSize(10);
      const tableTop = doc.y;
      const rowHeight = 20;
      const colWidths = [60, 25, 80, 70, 50, 50, 50, 60, 60, 50, 50, 50];
      const headers = ['Product ID', 'SKU', 'Name', 'Category', 'Created', 'Updated', 'Franchise', 'Buying $', 'Selling $', 'Stock', 'Value', 'Margin'];
      
      // Draw header background
      doc.rect(50, tableTop, 500, rowHeight).fill('#E0E0E0');
      
      // Draw header text
      let xPos = 55;
      headers.forEach((header, i) => {
        doc.fillColor('#000000')
          .fontSize(9)
          .font('Helvetica-Bold')
          .text(header, xPos, tableTop + 5, { width: colWidths[i], align: 'left' });
        xPos += colWidths[i];
      });
      
      // Draw table rows
      let yPos = tableTop + rowHeight;
      exportData.forEach((product, index) => {
        // Check if we need a new page
        if (yPos > 750) {
          doc.addPage();
          yPos = 50;
        }
        
        // Alternate row colors
        if (index % 2 === 0) {
          doc.rect(50, yPos, 500, rowHeight).fill('#F5F5F5');
        }
        
        // Draw row data - Structured format: IDs, Names, Dates, Franchise
        xPos = 55;
        const rowData = [
          product.productId.substring(0, 12) + '...', // Truncate long IDs
          product.sku,
          product.name.substring(0, 15), // Truncate long names
          product.category.substring(0, 10),
          product.createdAt,
          product.updatedAt,
          product.franchiseCode,
          `$${product.buyingPrice.toFixed(2)}`,
          `$${product.sellingPrice.toFixed(2)}`,
          product.stockQuantity.toString(),
          `$${product.inventoryValue.toFixed(2)}`,
          product.profitMargin,
        ];
        
        rowData.forEach((data, i) => {
          doc.fillColor('#000000')
            .fontSize(8)
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
        '',
        '',
        totals.totalStock.toString(),
        `$${totals.totalInventoryValue.toFixed(2)}`,
        `${totals.avgProfitMargin}%`,
      ];
      
      totalsData.forEach((data, i) => {
        doc.text(data || '', xPos, yPos + 5, { width: colWidths[i], align: 'left' });
        xPos += colWidths[i];
      });
      
      // Finalize PDF
      doc.end();
      
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid format. Supported formats: excel, xlsx, pdf'
      });
    }
    
  } catch (error) {
    console.error('Error exporting products:', error);
    
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
      message: 'Error exporting products',
      error: error.message
    });
  }
};