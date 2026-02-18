# Profit & Loss Integration Documentation

## Overview

This document describes how Profit & Loss (P&L) calculations are integrated across the inventory management system, ensuring that all financial transactions (sales, stock imports, stock exports) are properly tracked and reflected in backend-driven P&L reports.

## Key Principles

1. **Backend-Driven Calculations**: All P&L calculations are performed on the backend using MongoDB aggregation pipelines. No financial calculations are done on the frontend.

2. **Real-Time Updates**: Product inventory, revenue, profit, and COGS are updated in real-time as transactions occur (sales, imports, exports).

3. **Comprehensive Tracking**: The system tracks:
   - Revenue from sales
   - Cost of Goods Sold (COGS) from sales
   - Inventory value changes from imports/exports
   - Profit margins at multiple levels (gross, net, category-wise)

## Components

### 1. Sales Impact on Revenue & Profit

**Location**: `server/models/Sale.model.js` (pre-save hook)

**How it works**:
- When a sale is created, the pre-save hook automatically:
  1. Calculates item-level profit: `(sellingPrice - buyingPrice) × quantity`
  2. Calculates sale totals (subTotal, discounts, taxes, grandTotal)
  3. Calculates total profit for the sale
  4. Updates product inventory (reduces stockQuantity)
  5. Updates product sales metrics (totalSold, totalRevenue, totalProfit)

**Key Fields**:
- `grandTotal`: Total revenue from the sale
- `totalProfit`: Total profit from the sale
- `items[].profit`: Profit per line item

**Example**:
```javascript
// Sale with 2 items
{
  items: [
    { product: ObjectId("..."), quantity: 5, buyingPrice: 10, sellingPrice: 15 },
    { product: ObjectId("..."), quantity: 3, buyingPrice: 20, sellingPrice: 30 }
  ],
  grandTotal: 195, // (5×15) + (3×30) = 75 + 90
  totalProfit: 35  // (5×(15-10)) + (3×(30-20)) = 25 + 30
}
```

### 2. Imported Stock Impact on COGS & Inventory

**Location**: `server/controllers/transfer.controller.js` → `importStock()`

**How it works**:
- When stock is imported (Stock In):
  1. Creates a `Transfer` record with status 'completed'
  2. Updates product stock in destination franchise (increases `stockQuantity`)
  3. Adds entry to product's `stockHistory`
  4. If product doesn't exist in destination, creates a new product entry

**Impact on P&L**:
- **Inventory Value**: Increases by `quantity × unitPrice`
- **COGS**: Imported stock cost becomes part of inventory. COGS is recognized when products are sold (not at import time).
- **Formula**: `COGS = Beginning Inventory + Purchases (Imports) - Ending Inventory`

**Key Fields**:
- `Transfer.totalValue`: Total cost of imported stock (`quantity × unitPrice`)
- `Product.stockQuantity`: Updated inventory level
- `Product.buyingPrice`: Cost basis for future COGS calculation

**Example**:
```javascript
// Import 100 units at $10 each
{
  productId: ObjectId("..."),
  quantity: 100,
  cost: 10,
  toFranchise: ObjectId("..."),
  status: 'completed'
}
// Result: Inventory value increases by $1,000
// COGS will be calculated when these units are sold
```

### 3. Exported Stock Impact on Inventory Value

**Location**: `server/controllers/transfer.controller.js` → `exportStock()`

**How it works**:
- When stock is exported (Stock Out):
  1. Validates sufficient stock availability
  2. Creates a `Transfer` record with status 'completed'
  3. Reduces product stock in source franchise (decreases `stockQuantity`)
  4. Adds entry to product's `stockHistory` (with negative quantity)

**Impact on P&L**:
- **Inventory Value**: Decreases by `quantity × unitPrice`
- **COGS**: Exported stock reduces inventory, but COGS is still calculated from sales (not exports)

**Key Fields**:
- `Transfer.totalValue`: Total value of exported stock
- `Product.stockQuantity`: Updated inventory level (reduced)

**Example**:
```javascript
// Export 50 units at $10 each
{
  productId: ObjectId("..."),
  quantity: 50,
  cost: 10,
  fromFranchise: ObjectId("..."),
  status: 'completed'
}
// Result: Inventory value decreases by $500
```

### 4. P&L Report Calculation

**Location**: `server/controllers/report.controller.js` → `generateProfitLossReport()`

**Endpoint**: `GET /api/reports/profit-loss`

**Query Parameters**:
- `franchise` (optional): Filter by franchise ID
- `startDate` (optional): Start date for period (default: 1 month ago)
- `endDate` (optional): End date for period (default: now)

**Calculation Flow**:

1. **Revenue Calculation**:
   ```javascript
   totalRevenue = sum(sales.grandTotal) // All completed sales in period
   ```

2. **COGS Calculation** (Sales-Based - Most Accurate):
   ```javascript
   cogs = sum(sales.items.quantity × sales.items.buyingPrice)
   ```
   This reflects the actual cost of goods sold during the period.

3. **Inventory Tracking**:
   ```javascript
   importedStockCost = sum(transfers[toFranchise].totalValue) // Completed imports
   exportedStockValue = sum(transfers[fromFranchise].totalValue) // Completed exports
   currentInventoryValue = sum(products.stockQuantity × products.buyingPrice)
   beginningInventoryValue = currentInventoryValue - (importedStockCost - exportedStockValue)
   ```

4. **Profit Calculations**:
   ```javascript
   grossProfit = totalRevenue - cogs
   netProfit = grossProfit - operatingExpenses
   grossMargin = (grossProfit / totalRevenue) × 100
   netMargin = (netProfit / totalRevenue) × 100
   ```

**Response Structure**:
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalRevenue": 50000,
      "cogs": 30000,
      "grossProfit": 20000,
      "operatingExpenses": 0,
      "netProfit": 20000,
      "grossMargin": 40,
      "netMargin": 40,
      "inventoryChanges": {
        "beginningInventory": 10000,
        "importedStockCost": 5000,
        "exportedStockValue": 2000,
        "endingInventory": 13000,
        "netInventoryChange": 3000
      }
    },
    "categoryBreakdown": [
      {
        "category": "Electronics",
        "revenue": 30000,
        "cogs": 18000,
        "grossProfit": 12000,
        "netProfit": 12000,
        "quantitySold": 150,
        "grossMargin": 40,
        "netMargin": 40
      }
    ],
    "breakdown": {
      "revenue": {
        "totalSales": 250,
        "totalRevenue": 50000,
        "avgOrderValue": 200
      },
      "cogs": {
        "cogsFromSales": 30000,
        "cogsFromInventoryMethod": 2000
      },
      "inventory": {
        "beginningValue": 10000,
        "importedCost": 5000,
        "exportedValue": 2000,
        "endingValue": 13000,
        "netChange": 3000
      }
    },
    "period": {
      "startDate": "2026-01-01T00:00:00.000Z",
      "endDate": "2026-02-01T23:59:59.999Z"
    },
    "franchise": null
  }
}
```

## Data Flow Diagram

```
┌─────────────────┐
│   Sales Created │
└────────┬────────┘
         │
         ├─► Updates Product.stockQuantity (decreases)
         ├─► Updates Product.totalSold, totalRevenue, totalProfit
         └─► Calculates Sale.grandTotal, Sale.totalProfit
              │
              └─► P&L Report aggregates all sales
                   ├─► Revenue = sum(grandTotal)
                   └─► COGS = sum(items.quantity × items.buyingPrice)

┌─────────────────┐
│ Stock Imported  │
└────────┬────────┘
         │
         ├─► Creates Transfer record
         ├─► Updates Product.stockQuantity (increases)
         └─► Adds to Product.stockHistory
              │
              └─► P&L Report tracks importedStockCost
                   └─► Affects inventory value calculation

┌─────────────────┐
│ Stock Exported  │
└────────┬────────┘
         │
         ├─► Creates Transfer record
         ├─► Updates Product.stockQuantity (decreases)
         └─► Adds to Product.stockHistory (negative)
              │
              └─► P&L Report tracks exportedStockValue
                   └─► Affects inventory value calculation
```

## Key Formulas

### COGS Calculation (Two Methods)

**Method 1: Sales-Based (Primary - Most Accurate)**
```
COGS = Σ(sale.items.quantity × sale.items.buyingPrice)
```
This reflects the actual cost of products sold during the period.

**Method 2: Inventory-Based (Alternative)**
```
COGS = Beginning Inventory + Purchases (Imports) - Ending Inventory
```
This method is provided for validation but sales-based COGS is preferred.

### Inventory Value
```
Current Inventory Value = Σ(products.stockQuantity × products.buyingPrice)
```

### Profit Calculations
```
Gross Profit = Total Revenue - COGS
Net Profit = Gross Profit - Operating Expenses
Gross Margin % = (Gross Profit / Total Revenue) × 100
Net Margin % = (Net Profit / Total Revenue) × 100
```

## Security & Access Control

- **Franchise Filtering**: P&L reports respect franchise boundaries
- **Role-Based Access**: 
  - `admin`: Can view all franchises
  - `franchise_manager`: Can only view assigned franchises
- **Data Isolation**: All calculations are filtered by franchise when specified

## Performance Considerations

1. **Aggregation Pipelines**: Uses MongoDB aggregation for efficient server-side calculations
2. **Indexing**: Leverages indexes on:
   - `Sale.createdAt`, `Sale.franchise`, `Sale.status`
   - `Transfer.transferDate`, `Transfer.fromFranchise`, `Transfer.toFranchise`, `Transfer.status`
   - `Product.franchise`, `Product.status`

3. **Caching**: Consider implementing caching for frequently accessed P&L reports (30-60 second TTL)

## Future Enhancements

1. **Operating Expenses Tracking**: Add support for tracking operating expenses (rent, utilities, salaries)
2. **FIFO/LIFO Costing**: Implement advanced inventory costing methods
3. **Multi-Currency Support**: Add support for multiple currencies
4. **Tax Calculations**: Enhanced tax tracking and reporting
5. **Historical Inventory Snapshots**: Store inventory values at period end for accurate beginning inventory calculations

## Testing Scenarios

1. **Sales Impact**: Create a sale → Verify revenue and profit are calculated correctly
2. **Import Impact**: Import stock → Verify inventory value increases
3. **Export Impact**: Export stock → Verify inventory value decreases
4. **P&L Report**: Generate report → Verify all calculations are accurate
5. **Franchise Isolation**: Verify data is properly filtered by franchise
6. **Date Range Filtering**: Verify reports respect startDate/endDate parameters

## API Usage Examples

### Generate P&L Report (All Franchises)
```bash
GET /api/reports/profit-loss?startDate=2026-01-01&endDate=2026-02-01
```

### Generate P&L Report (Specific Franchise)
```bash
GET /api/reports/profit-loss?franchise=507f1f77bcf86cd799439011&startDate=2026-01-01&endDate=2026-02-01
```

### Import Stock
```bash
POST /api/transfers/import
Content-Type: application/json

{
  "productId": "507f1f77bcf86cd799439011",
  "quantity": 100,
  "cost": 10,
  "fromFranchise": "507f1f77bcf86cd799439012",
  "toFranchise": "507f1f77bcf86cd799439013",
  "status": "completed"
}
```

### Export Stock
```bash
POST /api/transfers/export
Content-Type: application/json

{
  "productId": "507f1f77bcf86cd799439011",
  "quantity": 50,
  "cost": 10,
  "fromFranchise": "507f1f77bcf86cd799439013",
  "toFranchise": "507f1f77bcf86cd799439012",
  "status": "completed"
}
```

## Conclusion

The Profit & Loss integration ensures that all financial transactions are properly tracked and reflected in backend-driven calculations. Sales affect revenue and profit, imported stock affects inventory value and COGS (when sold), and exported stock reduces inventory value. All calculations are performed server-side using MongoDB aggregation pipelines for accuracy and performance.
