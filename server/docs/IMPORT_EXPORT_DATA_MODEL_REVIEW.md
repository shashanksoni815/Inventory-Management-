# Import & Export Data Model Review

## STEP 1: Data Model Analysis

### ✅ Product Model (`server/models/Product.model.js`)

**Unique ID:**
- ✅ `_id` (Mongoose default ObjectId)
- ✅ `sku` (unique per franchise via compound index: `{ sku: 1, franchise: 1 }`)

**Franchise Reference:**
- ✅ `franchise` (ObjectId, ref: 'Franchise', required, indexed)
- ✅ `isGlobal` (Boolean) - indicates shared products
- ✅ `sharedWith[]` - array of franchises with shared access
- ✅ `originalFranchise` - tracks original owner for shared products

**Timestamps:**
- ✅ `createdAt` (via `timestamps: true`)
- ✅ `updatedAt` (via `timestamps: true`)
- ✅ `lastSold` (Date) - last sale date

**Cost, Price, Quantity Fields:**
- ✅ `buyingPrice` (Number, required, min: 0) - **COST**
- ✅ `sellingPrice` (Number, required, min: 0) - **PRICE**
- ✅ `stockQuantity` (Number, required, min: 0, default: 0) - **QUANTITY**
- ✅ `profitMargin` (Number, calculated)
- ✅ `minimumStock` (Number, default: 10)
- ✅ `franchisePricing[]` - franchise-specific pricing overrides

**Additional Export-Relevant Fields:**
- `name` (String, required)
- `category` (String, enum, indexed)
- `brand` (String)
- `description` (String)
- `status` (String: 'active', 'inactive', 'discontinued')
- `totalSold` (Number, default: 0)
- `totalRevenue` (Number, default: 0)
- `totalProfit` (Number, default: 0)
- `stockHistory[]` - array of stock movement records

**Export Format Fields:**
- Product ID: `_id`
- SKU: `sku`
- Name: `name`
- Category: `category`
- Brand: `brand`
- Buying Price: `buyingPrice`
- Selling Price: `sellingPrice`
- Stock Quantity: `stockQuantity`
- Franchise: `franchise` (need to populate for name/code)
- Status: `status`
- Created: `createdAt`
- Updated: `updatedAt`

---

### ✅ Sale Model (`server/models/Sale.model.js`)

**Unique ID:**
- ✅ `_id` (Mongoose default ObjectId)
- ✅ `invoiceNumber` (String, required, unique, uppercase)

**Franchise Reference:**
- ✅ `franchise` (ObjectId, ref: 'Franchise', required, indexed)

**Timestamps:**
- ✅ `createdAt` (via `timestamps: true`)
- ✅ `updatedAt` (via `timestamps: true`)
- ✅ `transferDate` (Date) - for transfers

**Cost, Price, Quantity Fields:**

**Sale Level:**
- ✅ `subTotal` (Number, required, min: 0)
- ✅ `totalDiscount` (Number, default: 0)
- ✅ `totalTax` (Number, default: 0)
- ✅ `grandTotal` (Number, required, min: 0) - **TOTAL PRICE**
- ✅ `totalProfit` (Number, default: 0) - **PROFIT**

**Sale Item Level (`items[]` array):**
- ✅ `quantity` (Number, required, min: 1) - **QUANTITY**
- ✅ `buyingPrice` (Number, required) - **COST**
- ✅ `sellingPrice` (Number, required) - **PRICE**
- ✅ `discount` (Number, default: 0, min: 0, max: 100)
- ✅ `tax` (Number, default: 0)
- ✅ `profit` (Number, default: 0) - **ITEM PROFIT**

**Additional Export-Relevant Fields:**
- `customerName` (String)
- `customerEmail` (String)
- `paymentMethod` (String: 'cash', 'card', 'upi', 'bank_transfer', 'credit')
- `saleType` (String: 'online', 'offline')
- `status` (String: 'completed', 'pending', 'refunded', 'cancelled')
- `notes` (String)
- `refundedAmount` (Number, default: 0)
- `refundReason` (String)
- `items[].product` (ObjectId, ref: 'Product') - need to populate for SKU/name
- `items[].sku` (String) - stored in item
- `items[].name` (String) - stored in item

**Export Format Fields:**
- Sale ID: `_id`
- Invoice Number: `invoiceNumber`
- Franchise: `franchise` (need to populate for name/code)
- Date: `createdAt`
- Customer: `customerName`
- Customer Email: `customerEmail`
- Payment Method: `paymentMethod`
- Sale Type: `saleType`
- Status: `status`
- Sub Total: `subTotal`
- Discount: `totalDiscount`
- Tax: `totalTax`
- Grand Total: `grandTotal`
- Total Profit: `totalProfit`
- Items: `items[]` (array of line items)
  - Product SKU: `items[].sku`
  - Product Name: `items[].name`
  - Quantity: `items[].quantity`
  - Buying Price: `items[].buyingPrice`
  - Selling Price: `items[].sellingPrice`
  - Discount %: `items[].discount`
  - Tax %: `items[].tax`
  - Profit: `items[].profit`

---

### ✅ Franchise Model (`server/models/Franchise.js`)

**Unique ID:**
- ✅ `_id` (Mongoose default ObjectId)
- ✅ `code` (String, required, unique, uppercase)

**Franchise Reference:**
- ✅ N/A (this is the franchise entity itself)

**Timestamps:**
- ✅ `createdAt` (Date, default: Date.now)
- ✅ `updatedAt` (Date, default: Date.now)
- ✅ Also has `timestamps: true` in schema options

**Cost, Price, Quantity Fields:**
- ❌ N/A (Franchise is a master data entity, not transactional)

**Additional Export-Relevant Fields:**
- `name` (String, required)
- `code` (String, required, unique, uppercase)
- `location` (String, required)
- `manager` (String, required)
- `contact.email` (String, required)
- `contact.phone` (String, required)
- `contact.address` (String, required)
- `settings.currency` (String, default: 'USD')
- `settings.taxRate` (Number, default: 0)
- `settings.openingHours` (String)
- `settings.timezone` (String)
- `status` (String: 'active', 'inactive', 'maintenance')
- `metadata.color` (String)
- `metadata.icon` (String)

**Export Format Fields:**
- Franchise ID: `_id`
- Code: `code`
- Name: `name`
- Location: `location`
- Manager: `manager`
- Email: `contact.email`
- Phone: `contact.phone`
- Address: `contact.address`
- Currency: `settings.currency`
- Tax Rate: `settings.taxRate`
- Status: `status`
- Created: `createdAt`
- Updated: `updatedAt`

---

### ✅ Transfer Model (`server/models/Transfer.js`)

**Unique ID:**
- ✅ `_id` (Mongoose default ObjectId)

**Franchise Reference:**
- ✅ `fromFranchise` (ObjectId, ref: 'Franchise', required, indexed)
- ✅ `toFranchise` (ObjectId, ref: 'Franchise', required, indexed)

**Timestamps:**
- ✅ `createdAt` (via `timestamps: true`)
- ✅ `updatedAt` (via `timestamps: true`)
- ✅ `transferDate` (Date, default: Date.now)
- ✅ `expectedDelivery` (Date)
- ✅ `actualDelivery` (Date)

**Cost, Price, Quantity Fields:**
- ✅ `quantity` (Number, required, min: 1) - **QUANTITY**
- ✅ `unitPrice` (Number, min: 0) - **UNIT PRICE**
- ✅ `totalValue` (Number, min: 0) - **TOTAL VALUE** (calculated: unitPrice * quantity)
- ✅ `shippingCost` (Number, default: 0, min: 0) - **SHIPPING COST**

**Additional Export-Relevant Fields:**
- `product` (ObjectId, ref: 'Product', required, indexed) - need to populate for SKU/name
- `status` (String: 'pending', 'approved', 'rejected', 'in_transit', 'completed', 'cancelled')
- `initiatedBy` (ObjectId, ref: 'User', required) - need to populate for username
- `approvedBy` (ObjectId, ref: 'User') - need to populate for username
- `trackingNumber` (String)
- `carrier` (String)
- `notes` (String)
- `documents[]` - array of document references
- `history[]` - array of status change records

**Export Format Fields:**
- Transfer ID: `_id`
- Product: `product` (need to populate for SKU/name)
- From Franchise: `fromFranchise` (need to populate for name/code)
- To Franchise: `toFranchise` (need to populate for name/code)
- Quantity: `quantity`
- Unit Price: `unitPrice`
- Total Value: `totalValue`
- Shipping Cost: `shippingCost`
- Status: `status`
- Transfer Date: `transferDate`
- Expected Delivery: `expectedDelivery`
- Actual Delivery: `actualDelivery`
- Tracking Number: `trackingNumber`
- Carrier: `carrier`
- Initiated By: `initiatedBy` (need to populate)
- Approved By: `approvedBy` (need to populate)
- Notes: `notes`
- Created: `createdAt`
- Updated: `updatedAt`

---

## Summary Checklist

| Entity | _id | Franchise Ref | createdAt | updatedAt | Cost | Price | Quantity | Status |
|--------|-----|---------------|-----------|----------|------|-------|----------|--------|
| **Product** | ✅ | ✅ | ✅ | ✅ | ✅ (`buyingPrice`) | ✅ (`sellingPrice`) | ✅ (`stockQuantity`) | ✅ |
| **Sale** | ✅ | ✅ | ✅ | ✅ | ✅ (`items[].buyingPrice`) | ✅ (`items[].sellingPrice`, `grandTotal`) | ✅ (`items[].quantity`) | ✅ |
| **Franchise** | ✅ | N/A | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| **Transfer** | ✅ | ✅ (from/to) | ✅ | ✅ | ✅ (`shippingCost`) | ✅ (`unitPrice`, `totalValue`) | ✅ (`quantity`) | ✅ |

---

## Export Requirements Analysis

### ✅ All Models Have:
1. **Unique IDs**: All models have `_id` (Mongoose default ObjectId)
2. **Franchise Reference**: 
   - Product: `franchise` field
   - Sale: `franchise` field
   - Transfer: `fromFranchise` and `toFranchise` fields
   - Franchise: N/A (master entity)
3. **Timestamps**: All models have `createdAt` and `updatedAt` via `timestamps: true`
4. **Cost/Price/Quantity**: All transactional models have these fields

### 📋 Export Data Structure Requirements:

#### Products Export:
- Include: `_id`, `sku`, `name`, `category`, `brand`, `buyingPrice`, `sellingPrice`, `stockQuantity`, `franchise` (populated), `status`, `createdAt`, `updatedAt`
- Filter by: `franchise` (for franchise isolation)
- Format: Table with columns for each field

#### Sales Export:
- Include: `_id`, `invoiceNumber`, `franchise` (populated), `createdAt`, `customerName`, `customerEmail`, `paymentMethod`, `saleType`, `status`, `subTotal`, `totalDiscount`, `totalTax`, `grandTotal`, `totalProfit`
- Items: Expand `items[]` array into separate rows or nested structure
- Filter by: `franchise` (for franchise isolation)
- Format: Table with sale header + line items

#### Franchise Export:
- Include: All franchise fields
- Filter by: `_id` or `code` (single franchise)
- Format: Table with franchise details

#### Transfer Export (Import/Export):
- Include: `_id`, `product` (populated), `fromFranchise` (populated), `toFranchise` (populated), `quantity`, `unitPrice`, `totalValue`, `shippingCost`, `status`, `transferDate`, `expectedDelivery`, `actualDelivery`, `trackingNumber`, `carrier`, `initiatedBy` (populated), `approvedBy` (populated), `notes`, `createdAt`, `updatedAt`
- Filter by: `fromFranchise` (exports) or `toFranchise` (imports)
- Format: Table with transfer details

---

## Next Steps (STEP 2+):

1. **Backend Export Endpoints**: Create API endpoints for Excel/PDF export
2. **Frontend Export UI**: Add export buttons to dashboards
3. **Excel Generation**: Use library like `exceljs` or `xlsx`
4. **PDF Generation**: Use library like `pdfkit` or `jspdf`
5. **Franchise Isolation**: Ensure all exports filter by franchise context
6. **Date Range Filtering**: Support time-based exports
7. **Data Population**: Populate references (franchise names, product details, user names)

---

## Notes:

- All models are properly structured for export
- No schema modifications needed
- Need to populate references (`franchise`, `product`, `user`) for readable exports
- Consider pagination for large datasets
- Consider async/streaming for large exports to avoid memory issues
