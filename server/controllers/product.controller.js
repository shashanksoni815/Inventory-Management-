import { Product } from '../models/Product.model.js';
import { generateSKU } from '../utils/skuGenerator.js';

export const getAllProducts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      category,
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      minStock,
      maxStock,
      minPrice,
      maxPrice,
    } = req.query;

    const query = {};

    // Search functionality
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } },
      ];
    }

    // Filter by category
    if (category) {
      query.category = category;
    }

    // Filter by status
    if (status) {
      query.status = status;
    }

    // Stock range filter
    if (minStock !== undefined || maxStock !== undefined) {
      query.stockQuantity = {};
      if (minStock !== undefined) query.stockQuantity.$gte = Number(minStock);
      if (maxStock !== undefined) query.stockQuantity.$lte = Number(maxStock);
    }

    // Price range filter
    if (minPrice !== undefined || maxPrice !== undefined) {
      query.sellingPrice = {};
      if (minPrice !== undefined) query.sellingPrice.$gte = Number(minPrice);
      if (maxPrice !== undefined) query.sellingPrice.$lte = Number(maxPrice);
    }

    // Sorting
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute query with pagination
    const [products, total] = await Promise.all([
      Product.find(query)
        .sort(sortOptions)
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .lean(),
      Product.countDocuments(query),
    ]);

    // Calculate additional metrics
    const productsWithMetrics = products.map(product => ({
      ...product,
      inventoryValue: product.stockQuantity * product.buyingPrice,
      stockStatus: product.stockQuantity === 0 
        ? 'out-of-stock' 
        : product.stockQuantity <= product.minimumStock 
          ? 'low-stock' 
          : 'in-stock',
    }));

    res.status(200).json({
      success: true,
      data: {
        products: productsWithMetrics,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch products',
      error: error.message,
    });
  }
};

export const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch product',
      error: error.message,
    });
  }
};

export const createProduct = async (req, res) => {
  try {
    const {
      name,
      category,
      brand,
      description,
      buyingPrice,
      sellingPrice,
      stockQuantity,
      minimumStock,
      images,
    } = req.body;

    // Generate SKU
    const sku = await generateSKU(category);

    // Create product
    const product = await Product.create({
      sku,
      name,
      category,
      brand,
      description,
      buyingPrice,
      sellingPrice,
      stockQuantity,
      minimumStock: minimumStock || 10,
      images: images || [],
      status: 'active',
    });

    // Add stock history entry
    if (stockQuantity > 0) {
      product.stockHistory.push({
        date: new Date(),
        quantity: stockQuantity,
        type: 'purchase',
        reference: 'Initial stock',
        note: 'Product created',
      });
      await product.save();
    }

    res.status(201).json({
      success: true,
      data: product,
      message: 'Product created successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create product',
      error: error.message,
    });
  }
};

export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Don't allow SKU updates
    if (updateData.sku) {
      delete updateData.sku;
    }

    const product = await Product.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    res.status(200).json({
      success: true,
      data: product,
      message: 'Product updated successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update product',
      error: error.message,
    });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Product deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete product',
      error: error.message,
    });
  }
};

export const bulkDeleteProducts = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No product IDs provided',
      });
    }

    const result = await Product.deleteMany({ _id: { $in: ids } });

    res.status(200).json({
      success: true,
      message: `${result.deletedCount} products deleted successfully`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete products',
      error: error.message,
    });
  }
};

export const updateStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity, type, note } = req.body;

    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    // Update stock based on type
    let newQuantity = product.stockQuantity;
    switch (type) {
      case 'purchase':
      case 'return':
        newQuantity += quantity;
        break;
      case 'sale':
      case 'adjustment':
        newQuantity -= quantity;
        break;
      default:
        throw new Error('Invalid stock update type');
    }

    // Ensure stock doesn't go negative
    if (newQuantity < 0) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient stock',
      });
    }

    product.stockQuantity = newQuantity;
    
    // Add to stock history
    product.stockHistory.push({
      date: new Date(),
      quantity,
      type,
      reference: `STK-${Date.now()}`,
      note,
    });

    await product.save();

    res.status(200).json({
      success: true,
      data: product,
      message: 'Stock updated successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update stock',
      error: error.message,
    });
  }
};

export const getLowStockProducts = async (req, res) => {
  try {
    const products = await Product.find({
      stockQuantity: { $gt: 0 },
      $expr: { $lte: ['$stockQuantity', '$minimumStock'] },
      status: 'active',
    })
    .sort({ stockQuantity: 1 })
    .limit(50)
    .lean();

    res.status(200).json({
      success: true,
      data: products,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch low stock products',
      error: error.message,
    });
  }
};

export const getProductAnalytics = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const analytics = await Product.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          status: 'active',
        },
      },
      {
        $group: {
          _id: '$category',
          totalProducts: { $sum: 1 },
          totalStock: { $sum: '$stockQuantity' },
          avgMargin: { $avg: '$profitMargin' },
          totalValue: {
            $sum: { $multiply: ['$stockQuantity', '$buyingPrice'] },
          },
        },
      },
      {
        $sort: { totalValue: -1 },
      },
    ]);

    res.status(200).json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch product analytics',
      error: error.message,
    });
  }
};