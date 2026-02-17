# Backend Sales Import API Verification

## ✅ Endpoint Exists

**Route:** `POST /api/sales/import`
- **Location:** `server/routes/sale.routes.js` (line 23)
- **Middleware:** `uploadExcel` (handles multipart/form-data)
- **Auth:** Protected by `authMiddleware`
- **Controller:** `importSales` in `server/controllers/sale.controller.js`

---

## ✅ File Upload Handling

**Middleware:** `server/middleware/upload.middleware.js`
- ✅ Accepts **Excel files** (.xlsx, .xls)
- ✅ Accepts **CSV files** (.csv) - **ADDED**
- ✅ Content-Type: `multipart/form-data`
- ✅ File size limit: 10MB
- ✅ Stores file in memory buffer (`req.file.buffer`)

**Supported MIME Types:**
- `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (.xlsx)
- `application/vnd.ms-excel` (.xls)
- `text/csv` (.csv)

---

## ✅ File Parsing

**Excel Parsing:**
- Uses `ExcelJS` library
- Reads first worksheet
- Extracts header row
- Processes all data rows

**CSV Parsing:**
- Parses UTF-8 CSV content
- Handles quoted values correctly
- Splits by commas (respects quotes)
- Extracts header row
- Processes all data rows

---

## ✅ Data Validation

**Required Columns:**
- `invoiceNo` (required, used to group items into sales)
- `saleDate` (required, ISO date format)
- `franchiseId` (required, valid ObjectId)
- `productId` (required, valid ObjectId)
- `quantity` (required, >= 1, integer)
- `sellingPrice` (required, >= 0)
- `paymentMethod` (required: cash, card, upi, bank_transfer, credit)
- `saleType` (required: online, offline)

**Optional Columns:**
- `productSku` (for validation)
- `buyingPrice` (will use product's buyingPrice if not provided)
- `discount` (0-100)
- `tax` (0-100)
- `customerName`
- `customerEmail`
- `notes`

**Validation Checks:**
1. ✅ Required columns present
2. ✅ Data types correct (numbers, dates, strings)
3. ✅ Values within valid ranges
4. ✅ Payment method matches enum values
5. ✅ Sale type matches enum values
6. ✅ Franchise ID is valid ObjectId
7. ✅ User has access to franchise (RBAC)
8. ✅ Product ID is valid ObjectId
9. ✅ Product belongs to sale's franchise
10. ✅ Invoice number uniqueness (prevents duplicates)

---

## ✅ Auto-Calculates Profit

**Profit Calculation:**
- **Location:** Line 1450 in `sale.controller.js`
- **Formula:** `profit = (sellingPrice - buyingPrice) * quantity`
- **Buying Price Source:**
  - Uses `buyingPrice` from import if provided
  - Falls back to product's `buyingPrice` if not provided (line 1447)
- **Total Profit:** Sum of all item profits (line 1483)

**Example:**
```javascript
const profit = (item.sellingPrice - finalBuyingPrice) * item.quantity;
// profit is calculated per item
// totalProfit = sum of all item profits
```

---

## ✅ Assigns Franchise

**Franchise Assignment:**
- **Location:** Line 1517 in `sale.controller.js`
- **Source:** From import data (`franchiseId` column)
- **Validation:**
  - Validates franchise exists (line 1388)
  - Validates user has access to franchise (line 1243)
  - Validates all products belong to the same franchise (line 1425)
  - Ensures sale franchise matches product franchise (line 1436)

**Franchise Assignment Code:**
```javascript
franchise: saleData.franchiseId, // Line 1517
```

**Franchise Validation:**
- Checks franchise exists in database
- Validates RBAC (user must have access)
- Ensures consistency (all products must belong to sale's franchise)

---

## ✅ Stores Imported Sales Safely

**Safety Features:**

1. **Transaction Safety:**
   - Each sale is created individually
   - Errors don't affect other sales
   - Failed sales are logged but don't stop processing

2. **Duplicate Prevention:**
   - Checks for existing invoice numbers (line 1486)
   - Prevents duplicate sales
   - Skips duplicates with warning

3. **Data Integrity:**
   - Validates all required fields
   - Validates relationships (product exists, franchise exists)
   - Validates franchise-product consistency
   - Validates user permissions

4. **Error Handling:**
   - Catches errors per sale
   - Logs errors with row numbers
   - Continues processing other sales
   - Returns detailed error report

5. **Audit Trail:**
   - Creates `ImportLog` entry
   - Creates `AuditLog` entry
   - Marks sales as imported (adds note with timestamp)
   - Tracks all operations

6. **Stock Updates:**
   - Sales decrease product stock quantities
   - Updates `lastSold` date
   - Updates `totalSold` and `totalRevenue` on products

**Sale Creation:**
```javascript
const sale = await Sale.create({
  invoiceNumber: invoiceNo,
  items: enrichedItems,
  customerName: saleData.customerName || undefined,
  customerEmail: saleData.customerEmail || undefined,
  paymentMethod: saleData.paymentMethod,
  saleType: saleData.saleType,
  status: 'completed',
  notes: saleNotes, // Includes "[Imported on ...]"
  subTotal,
  totalDiscount,
  totalTax,
  grandTotal,
  totalProfit, // Auto-calculated
  franchise: saleData.franchiseId, // Assigned from import
  createdAt: saleData.saleDate || new Date(),
});
```

---

## ✅ Response Format

**Success Response:**
```json
{
  "success": true,
  "message": "Import completed: X sales imported, Y failed, Z rows skipped",
  "data": {
    "importLogId": "...",
    "totalRows": 100,
    "successfulSales": 95,
    "failedSales": 3,
    "skippedRows": 2,
    "errors": [...], // Limited to 50 errors
    "warnings": [...], // Limited to 20 warnings
    "processedSales": [...] // Limited to 100 sales
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "Error message",
  "error": "Detailed error message"
}
```

---

## ✅ Features Summary

1. **Groups by Invoice:**
   - Multiple rows with same `invoiceNo` are grouped into one sale
   - Each sale can have multiple items

2. **Auto-Enriches Products:**
   - Fetches product data from database
   - Uses product's buyingPrice if not provided
   - Validates product belongs to franchise

3. **Calculates Totals:**
   - Subtotal: sum of (sellingPrice × quantity)
   - Discount: sum of discounts
   - Tax: calculated on discounted amount
   - Grand Total: subtotal - discount + tax
   - Total Profit: sum of item profits

4. **Marks as Imported:**
   - Adds note: `[Imported on {timestamp}]`
   - Preserves existing notes if any

---

## Summary

✅ **Endpoint:** POST /api/sales/import exists and is properly configured
✅ **File Parsing:** Supports both Excel (.xlsx, .xls) and CSV (.csv) files
✅ **Auto-Calculates Profit:** Calculates profit per item and total profit
✅ **Assigns Franchise:** Validates and assigns franchise from import data
✅ **Stores Safely:** Comprehensive validation, error handling, and audit logging
✅ **Response Format:** Returns detailed success/error responses with statistics

**Status:** ✅ **READY FOR PRODUCTION**
