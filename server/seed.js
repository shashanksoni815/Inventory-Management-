import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from './models/User.model.js';
import { Product } from './models/Product.model.js';
import { Sale } from './models/Sale.model.js';
import { faker } from '@faker-js/faker';

dotenv.config();

const categories = ['Electronics', 'Clothing', 'Books', 'Home & Kitchen', 'Sports'];

const generateProducts = (count) => {
  const products = [];
  
  for (let i = 0; i < count; i++) {
    const category = faker.helpers.arrayElement(categories);
    const buyingPrice = faker.number.float({ min: 10, max: 1000, precision: 0.01 });
    const sellingPrice = buyingPrice * faker.number.float({ min: 1.2, max: 2.5, precision: 0.1 });
    
    products.push({
      sku: `${category.slice(0, 3).toUpperCase()}-${faker.string.alphanumeric(8).toUpperCase()}`,
      name: faker.commerce.productName(),
      category,
      brand: faker.company.name(),
      description: faker.commerce.productDescription(),
      buyingPrice,
      sellingPrice,
      stockQuantity: faker.number.int({ min: 0, max: 100 }),
      minimumStock: faker.number.int({ min: 5, max: 20 }),
      images: [{
        url: faker.image.urlLoremFlickr({ category: 'product' }),
        publicId: faker.string.uuid(),
      }],
      status: faker.helpers.arrayElement(['active', 'inactive']),
      totalSold: faker.number.int({ min: 0, max: 1000 }),
      totalRevenue: faker.number.float({ min: 0, max: 50000 }),
      totalProfit: faker.number.float({ min: -1000, max: 20000 }),
    });
  }
  
  return products;
};

const generateSales = (products, count) => {
  const sales = [];
  
  for (let i = 0; i < count; i++) {
    const saleType = faker.helpers.arrayElement(['online', 'offline']);
    const paymentMethod = faker.helpers.arrayElement(['cash', 'card', 'upi', 'bank_transfer']);
    const itemCount = faker.number.int({ min: 1, max: 5 });
    
    const items = [];
    let subTotal = 0;
    let totalProfit = 0;
    
    for (let j = 0; j < itemCount; j++) {
      const product = faker.helpers.arrayElement(products);
      const quantity = faker.number.int({ min: 1, max: 3 });
      const discount = faker.number.float({ min: 0, max: 20, precision: 0.1 });
      
      const itemTotal = product.sellingPrice * quantity;
      const itemProfit = (product.sellingPrice - product.buyingPrice) * quantity;
      
      items.push({
        product: product._id,
        sku: product.sku,
        name: product.name,
        quantity,
        buyingPrice: product.buyingPrice,
        sellingPrice: product.sellingPrice,
        discount,
        tax: 10,
        profit: itemProfit,
      });
      
      subTotal += itemTotal;
      totalProfit += itemProfit;
    }
    
    const totalDiscount = subTotal * 0.1; // 10% discount
    const totalTax = (subTotal - totalDiscount) * 0.1; // 10% tax
    const grandTotal = subTotal - totalDiscount + totalTax;
    
    const saleDate = faker.date.between({ 
      from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), 
      to: new Date() 
    });
    
    sales.push({
      invoiceNumber: `INV-${saleDate.getFullYear()}${(saleDate.getMonth() + 1).toString().padStart(2, '0')}${saleDate.getDate().toString().padStart(2, '0')}-${faker.string.numeric(3)}`,
      items,
      customerName: faker.person.fullName(),
      customerEmail: faker.internet.email(),
      subTotal,
      totalDiscount,
      totalTax,
      grandTotal,
      totalProfit,
      paymentMethod,
      saleType,
      status: faker.helpers.arrayElement(['completed', 'pending', 'refunded']),
      createdAt: saleDate,
      updatedAt: saleDate,
    });
  }
  
  return sales;
};

const seedDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Clear existing data
    await User.deleteMany({});
    await Product.deleteMany({});
    await Sale.deleteMany({});
    console.log('✅ Cleared existing data');
    
    // Create admin user (use plain password; User model pre-save will hash it)
    await User.create({
      username: 'admin',
      password: 'admin123',
      role: 'admin',
      settings: {
        theme: 'dark',
        currency: 'USD',
        taxRate: 10,
        lowStockThreshold: 10,
        refreshInterval: 30,
      },
    });
    console.log('✅ Created admin user');
    
    // Generate products
    const products = generateProducts(50);
    const createdProducts = await Product.insertMany(products);
    console.log(`✅ Created ${createdProducts.length} products`);
    
    // Generate sales
    const sales = generateSales(createdProducts, 100);
    await Sale.insertMany(sales);
    console.log(`✅ Created ${sales.length} sales`);
    
    console.log('🎉 Database seeding completed!');
    console.log('\n📋 Login Credentials:');
    console.log('Username: admin');
    console.log('Password: admin123');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
};

seedDatabase();