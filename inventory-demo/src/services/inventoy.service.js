import InventoryEvent from "../models/InventoryEvent.js";
import Product from "../models/Product.js";

export const calculateStock = async (productId) => {
  const events = await InventoryEvent.find({ productId });

  let stock = 0;

  events.forEach(event => {
    if (event.type === "IN") stock += event.quantity;
    if (event.type === "OUT") stock -= event.quantity;

    // ADJUST can be +ve or -ve
    if (event.type === "ADJUST") stock += event.quantity;
  });

  return stock;
};

/**
 * Check if product is low on stock
 */
export const checkLowStock = async (productId) => {
  const product = await Product.findById(productId);
  if (!product) return null;

  const currentStock = await calculateStock(productId);

  return {
    currentStock,
    reorderLevel: product.reorderLevel,
    isLowStock: currentStock <= product.reorderLevel
  };
};

