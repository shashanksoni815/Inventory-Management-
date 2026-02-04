import { Product } from '../models/Product.model.js';

export const generateSKU = async (category) => {
  const prefix = category.slice(0, 3).toUpperCase();
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  
  // Generate sequence number
  const today = new Date(date.setHours(0, 0, 0, 0));
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const count = await Product.countDocuments({
    createdAt: {
      $gte: today,
      $lt: tomorrow,
    },
  });
  
  const sequence = (count + 1).toString().padStart(4, '0');
  
  return `${prefix}-${year}${month}${day}-${sequence}`;
};