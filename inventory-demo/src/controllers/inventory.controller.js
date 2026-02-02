import Product from "../models/Product.js";
import InventoryEvent from "../models/InventoryEvent.js";
import { calculateStock } from "../services/inventoy.service.js";
import { isValidObjectId } from "../utils/validate.js";

/**
 * Create Product
 */
export const createProduct = async (req, res) => {
  try {
    const product = await Product.create(req.body);
    res.status(201).json(product);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

/**
 * Get All Products with Current Stock
 */
export const getProducts = async (req, res) => {
    try {
      const products = await Product.find();
  
      const result = await Promise.all(
        products.map(async product => {
          const stock = await calculateStock(product._id);
          const isLowStock = stock <= product.reorderLevel;
  
          return {
            ...product.toObject(),
            stock,
            isLowStock
          };
        })
      );
  
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

/**
 * Update Product
 */
export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid product ID" });
    }
    const { name, unit, reorderLevel } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (unit !== undefined) updates.unit = unit;
    if (reorderLevel !== undefined) updates.reorderLevel = reorderLevel;
    const product = await Product.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    );
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json(product);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

/**
 * Stock In
 */


export const stockIn = async (req, res) => {
  try {
    const { productId, quantity, reason } = req.body;

    if (!isValidObjectId(productId)) {
      return res.status(400).json({ error: "Invalid product ID" });
    }

    if (!quantity || quantity <= 0) {
      return res.status(400).json({ error: "Quantity must be greater than 0" });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    await InventoryEvent.create({
      productId,
      type: "IN",
      quantity,
      reason
    });

    const stock = await calculateStock(productId);

    res.json({
      message: "Stock added successfully",
      currentStock: stock
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};


/**
 * Stock Out
 */
export const stockOut = async (req, res) => {
    try {
      const { productId, quantity, reason } = req.body;
  
      if (!isValidObjectId(productId)) {
        return res.status(400).json({ error: "Invalid product ID" });
      }
  
      if (!quantity || quantity <= 0) {
        return res.status(400).json({ error: "Quantity must be greater than 0" });
      }
  
      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
  
      const currentStock = await calculateStock(productId);
  
      if (currentStock === 0) {
        return res.status(400).json({ error: "No stock available" });
      }
  
      if (quantity > currentStock) {
        return res.status(400).json({
          error: `Only ${currentStock} units available`
        });
      }
  
      await InventoryEvent.create({
        productId,
        type: "OUT",
        quantity,
        reason
      });
  
      const stock = await calculateStock(productId);
  
      res.json({
        message: "Stock deducted successfully",
        currentStock: stock
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  };
  

/**
 * Get Current Stock of a Product
 */
export const getStockByProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const stock = await calculateStock(productId);
    res.json({ productId, stock });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Inventory Events (Audit Log)
 */
export const getInventoryEvents = async (req, res) => {
  try {
    const events = await InventoryEvent.find()
      .populate("productId", "name sku")
      .sort({ createdAt: -1 });

    res.json(events);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getLowStockProducts = async (req, res) => {
    try {
      const products = await Product.find();
  
      const lowStockProducts = [];
  
      for (const product of products) {
        const stock = await calculateStock(product._id);
        if (stock <= product.reorderLevel) {
          lowStockProducts.push({
            ...product.toObject(),
            stock
          });
        }
      }
  
      res.json(lowStockProducts);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };
  

  export const adjustStock = async (req, res) => {
    try {
      const { productId, quantity, reason } = req.body;
  
      if (!isValidObjectId(productId)) {
        return res.status(400).json({ error: "Invalid product ID" });
      }
  
      await InventoryEvent.create({
        productId,
        type: "ADJUST",
        quantity,
        reason
      });
  
      const stock = await calculateStock(productId);
  
      res.json({
        message: "Stock adjusted",
        currentStock: stock
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  };
  
  // import { isValidObjectId } from "../utils/validate.js";

  /**
   * Adjust Inventory (Damage / Audit / Correction)
   */
  export const adjustInventory = async (req, res) => {
    try {
      const { productId, quantity, reason } = req.body;
  
      if (!isValidObjectId(productId)) {
        return res.status(400).json({ error: "Invalid product ID" });
      }
  
      if (!quantity || quantity === 0) {
        return res.status(400).json({
          error: "Adjustment quantity cannot be zero"
        });
      }
  
      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
  
      const currentStock = await calculateStock(productId);
  
      // Prevent stock going negative
      if (currentStock + quantity < 0) {
        return res.status(400).json({
          error: "Adjustment would result in negative stock"
        });
      }
  
      await InventoryEvent.create({
        productId,
        type: "ADJUST",
        quantity,
        reason
      });
  
      const updatedStock = await calculateStock(productId);
  
      res.json({
        message: "Inventory adjusted successfully",
        adjustment: quantity,
        currentStock: updatedStock
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  };
  