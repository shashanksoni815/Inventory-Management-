// scripts/migrateProductsToFranchises.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Product } from '../models/Product.js';
import { Franchise } from '../models/Franchise.js';

dotenv.config();

async function migrateProducts() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to database');

    // Get default franchise
    const defaultFranchise = await Franchise.findOne({ code: 'DT-001' });
    if (!defaultFranchise) {
      throw new Error('Default franchise not found. Please run franchise migration first.');
    }

    // Update existing products
    const updateResult = await Product.updateMany(
      { franchise: { $exists: false } },
      { 
        $set: { 
          franchise: defaultFranchise._id,
          isGlobal: false,
          transferable: true,
          originalFranchise: defaultFranchise._id
        }
      }
    );

    console.log(`Updated ${updateResult.modifiedCount} products with franchise data`);

    // Update SKU indexes to be franchise-unique
    const products = await Product.find({ franchise: defaultFranchise._id });
    
    // Check for duplicate SKUs in same franchise
    const skuMap = new Map();
    const duplicates = [];
    
    for (const product of products) {
      const sku = product.sku.toUpperCase();
      if (skuMap.has(sku)) {
        duplicates.push({ productId: product._id, sku });
      } else {
        skuMap.set(sku, product._id);
      }
    }

    if (duplicates.length > 0) {
      console.log(`Found ${duplicates.length} duplicate SKUs:`);
      for (const dup of duplicates) {
        const newSku = `${dup.sku}-${Date.now().toString().slice(-4)}`;
        await Product.findByIdAndUpdate(dup.productId, { sku: newSku });
        console.log(`Updated ${dup.sku} to ${newSku}`);
      }
    }

    console.log('Product migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrateProducts();