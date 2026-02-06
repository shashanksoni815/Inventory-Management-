// controllers/product.controller.js
import mongoose from 'mongoose';
import { Product } from '../models/Product.model.js';
import  Franchise  from '../models/Franchise.js';

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
    
    // Build base query
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
    } else if (user && user.role !== 'admin' && Array.isArray(user.franchises) && user.franchises.length > 0) {
      // Non-admin users with assigned franchises: only see products from their franchises
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
    
    // Apply search
    if (search) {
      query.$text = { $search: search };
    }
    
    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
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
    
    // Calculate franchise-specific stock
    const franchiseId = franchise || (user?.franchises?.[0]?.toString());
    const productsWithFranchiseStock = products.map(product => {
      let franchiseStock = product.stockQuantity;
      let isShared = false;
      
      if (franchiseId && product.franchise._id.toString() !== franchiseId) {
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
      
      return {
        ...product,
        franchiseStock,
        isShared,
        stockStatus,
        inventoryValue: franchiseStock * product.buyingPrice
      };
    });
    
    res.json({
      data: productsWithFranchiseStock,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
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
      price,
      category,
      stock,
      franchise
    } = req.body;

    // ✅ Validation (important)
    if (!franchise) {
      return res.status(400).json({
        success: false,
        message: "Franchise ID is required"
      });
    }

    const product = await Product.create({
      name,
      price,
      category,
      stock,
      franchise
    });

    res.status(201).json({
      success: true,
      product
    });

  } catch (error) {
    console.error("Error creating product:", error);
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
    
    // Check access - handle both string and ObjectId comparison
    if (user && user.role !== 'admin') {
      const userFranchises = (user.franchises || []).map((f) => f?.toString() || f);
      const franchiseIdStr = franchiseId.toString();
      if (!userFranchises.includes(franchiseIdStr)) {
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