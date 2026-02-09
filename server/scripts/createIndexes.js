// scripts/createIndexes.js
/**
 * CRITICAL Indexing Strategy Migration
 * Creates essential indexes for optimized admin dashboard aggregations.
 * 
 * Run: node server/scripts/createIndexes.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/inventory_db';

async function createIndexes() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;

    // 1. Sales indexes
    console.log('📊 Creating Sales indexes...');
    try {
      await db.collection('sales').createIndex({ createdAt: 1 }, { name: 'createdAt_1' });
      console.log('  ✅ sales.createdAt: 1');
    } catch (err) {
      if (err.code !== 85) throw err; // 85 = IndexOptionsConflict
      console.log('  ⚠️  sales.createdAt: 1 (already exists)');
    }

    try {
      await db.collection('sales').createIndex({ franchise: 1, createdAt: 1 }, { name: 'franchise_1_createdAt_1' });
      console.log('  ✅ sales.franchise: 1, createdAt: 1');
    } catch (err) {
      if (err.code !== 85) throw err;
      console.log('  ⚠️  sales.franchise: 1, createdAt: 1 (already exists)');
    }

    // 2. Transfers indexes
    console.log('\n🚚 Creating Transfers indexes...');
    try {
      await db.collection('transfers').createIndex({ fromFranchise: 1 }, { name: 'fromFranchise_1' });
      console.log('  ✅ transfers.fromFranchise: 1');
    } catch (err) {
      if (err.code !== 85) throw err;
      console.log('  ⚠️  transfers.fromFranchise: 1 (already exists)');
    }

    try {
      await db.collection('transfers').createIndex({ toFranchise: 1 }, { name: 'toFranchise_1' });
      console.log('  ✅ transfers.toFranchise: 1');
    } catch (err) {
      if (err.code !== 85) throw err;
      console.log('  ⚠️  transfers.toFranchise: 1 (already exists)');
    }

    // 3. Products indexes
    console.log('\n📦 Creating Products indexes...');
    try {
      await db.collection('products').createIndex({ category: 1 }, { name: 'category_1' });
      console.log('  ✅ products.category: 1');
    } catch (err) {
      if (err.code !== 85) throw err;
      console.log('  ⚠️  products.category: 1 (already exists)');
    }

    console.log('\n✅ All critical indexes created successfully!');
    console.log('\n📋 Index Summary:');
    console.log('  • sales.createdAt: 1 (date range queries)');
    console.log('  • sales.franchise: 1, createdAt: 1 (franchise + date aggregations)');
    console.log('  • transfers.fromFranchise: 1 (source franchise lookups)');
    console.log('  • transfers.toFranchise: 1 (destination franchise lookups)');
    console.log('  • products.category: 1 (category-wise aggregations)');

  } catch (error) {
    console.error('❌ Error creating indexes:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 MongoDB connection closed');
  }
}

// Run migration
createIndexes();
