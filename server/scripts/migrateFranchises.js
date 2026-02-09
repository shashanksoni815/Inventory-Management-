// scripts/migrateFranchises.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Franchise from '../models/Franchise.js';
import Product from '../models/Product.js';
import Sale from '../models/Sale.js';
import User from '../models/User.js';

dotenv.config();

const SAMPLE_FRANCHISES = [
  {
    name: 'Downtown Store',
    code: 'DT-001',
    location: '123 Main Street, Downtown',
    manager: 'John Smith',
    contact: {
      email: 'downtown@inventorypro.com',
      phone: '+1 (555) 123-4567',
      address: '123 Main St, City, State 12345'
    },
    settings: {
      currency: 'USD',
      taxRate: 8.5,
      openingHours: '9:00 AM - 9:00 PM',
      timezone: 'America/New_York'
    },
    metadata: {
      color: '#3B82F6',
      icon: '🏪'
    },
    status: 'active'
  },
  {
    name: 'Mall Outlet',
    code: 'MO-002',
    location: 'City Mall, Level 2',
    manager: 'Sarah Johnson',
    contact: {
      email: 'mall@inventorypro.com',
      phone: '+1 (555) 987-6543',
      address: 'City Mall, 456 Mall Rd, City, State 12345'
    },
    settings: {
      currency: 'USD',
      taxRate: 8.5,
      openingHours: '10:00 AM - 10:00 PM',
      timezone: 'America/New_York'
    },
    metadata: {
      color: '#8B5CF6',
      icon: '🛍️'
    },
    status: 'active'
  },
  {
    name: 'Airport Branch',
    code: 'AB-003',
    location: 'Terminal B, International Airport',
    manager: 'Mike Chen',
    contact: {
      email: 'airport@inventorypro.com',
      phone: '+1 (555) 456-7890',
      address: 'Airport Rd, Terminal B, City, State 12345'
    },
    settings: {
      currency: 'USD',
      taxRate: 0,
      openingHours: '24/7',
      timezone: 'America/New_York'
    },
    metadata: {
      color: '#10B981',
      icon: '✈️'
    },
    status: 'active'
  },
  {
    name: 'Plaza Center',
    code: 'PC-004',
    location: 'Plaza Center, West Wing',
    manager: 'Emma Wilson',
    contact: {
      email: 'plaza@inventorypro.com',
      phone: '+1 (555) 789-0123',
      address: '789 Plaza Dr, City, State 12345'
    },
    settings: {
      currency: 'USD',
      taxRate: 8.5,
      openingHours: '8:00 AM - 8:00 PM',
      timezone: 'America/Chicago'
    },
    metadata: {
      color: '#F59E0B',
      icon: '🏬'
    },
    status: 'active'
  },
  {
    name: 'Corporate HQ',
    code: 'HQ-005',
    location: 'Corporate Tower, 50th Floor',
    manager: 'Admin User',
    contact: {
      email: 'hq@inventorypro.com',
      phone: '+1 (555) 000-1111',
      address: '1000 Corporate Blvd, City, State 12345'
    },
    settings: {
      currency: 'USD',
      taxRate: 8.5,
      openingHours: '8:00 AM - 6:00 PM',
      timezone: 'America/New_York'
    },
    metadata: {
      color: '#6B7280',
      icon: '🏢'
    },
    status: 'active'
  }
];

async function migrate() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to database');

    // Clear existing franchises
    await Franchise.deleteMany({});
    console.log('Cleared existing franchises');

    // Create sample franchises
    const franchises = await Franchise.insertMany(SAMPLE_FRANCHISES);
    console.log(`Created ${franchises.length} franchises`);

    // Get first franchise as default
    const defaultFranchise = franchises[0];

    // Update existing products to belong to default franchise
    const productUpdateResult = await Product.updateMany(
      { franchise: { $exists: false } },
      { $set: { franchise: defaultFranchise._id, isGlobal: false } }
    );
    console.log(`Updated ${productUpdateResult.modifiedCount} products`);

    // Update existing sales to belong to default franchise
    const saleUpdateResult = await Sale.updateMany(
      { franchise: { $exists: false } },
      { $set: { franchise: defaultFranchise._id } }
    );
    console.log(`Updated ${saleUpdateResult.modifiedCount} sales`);

    // Update admin users to have access to all franchises
    const franchiseIds = franchises.map(f => f._id);
    const userUpdateResult = await User.updateMany(
      { role: 'admin' },
      { 
        $set: { 
          franchises: franchiseIds,
          defaultFranchise: defaultFranchise._id
        } 
      }
    );
    console.log(`Updated ${userUpdateResult.modifiedCount} admin users`);

    // Update staff users to have access to first franchise only
    const staffUpdateResult = await User.updateMany(
      { role: { $in: ['staff', 'manager'] } },
      { 
        $set: { 
          franchises: [defaultFranchise._id],
          defaultFranchise: defaultFranchise._id
        } 
      }
    );
    console.log(`Updated ${staffUpdateResult.modifiedCount} staff users`);

    console.log('Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();