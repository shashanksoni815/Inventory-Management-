import * as z from 'zod';

export const productSchema = z.object({
  name: z.string().min(1, 'Product name is required').max(200),
  category: z.enum(['Electronics', 'Clothing', 'Books', 'Home & Kitchen', 'Sports', 'Other']),
  brand: z.string().optional(),
  description: z.string().max(1000).optional(),
  buyingPrice: z.number().min(0, 'Buying price must be positive'),
  sellingPrice: z.number().min(0, 'Selling price must be positive'),
  stockQuantity: z.number().min(0, 'Stock cannot be negative').int(),
  minimumStock: z.number().min(0, 'Minimum stock cannot be negative').int(),
  images: z.array(z.string().url()).optional(),
});

export const saleSchema = z.object({
  items: z.array(z.object({
    productId: z.string(),
    quantity: z.number().min(1, 'Quantity must be at least 1'),
    sellingPrice: z.number().min(0, 'Price must be positive'),
    discount: z.number().min(0).max(100).optional().default(0),
    tax: z.number().min(0).max(100).optional().default(0),
  })).min(1, 'At least one item is required'),
  customerName: z.string().optional(),
  customerEmail: z.string().email('Invalid email').optional().or(z.literal('')),
  paymentMethod: z.enum(['cash', 'card', 'upi', 'bank_transfer']),
  saleType: z.enum(['online', 'offline']),
  notes: z.string().optional(),
});

export const userSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').max(50),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const settingsSchema = z.object({
  businessName: z.string().min(1, 'Business name is required'),
  currency: z.string().min(1, 'Currency is required'),
  taxRate: z.number().min(0).max(100),
  lowStockThreshold: z.number().min(1),
  invoicePrefix: z.string().max(10),
  autoBackup: z.boolean(),
  dataRefreshInterval: z.number().min(5).max(300),
  theme: z.enum(['light', 'dark', 'auto']),
});