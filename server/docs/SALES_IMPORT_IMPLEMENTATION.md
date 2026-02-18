# Sales Import Feature Implementation (STEP 5)

## Overview
Implemented sales import functionality for legacy data import. Supports bulk import of sales from Excel files with automatic profit calculation, franchise ownership validation, and import tracking.

## Implementation Details

### 1. Import Controller (`server/controllers/sale.controller.js`)
**Function**: `importSales`

**Features**:
- Excel file parsing (.xlsx)
- Groups rows by invoice number (multiple items per sale)
- Auto-calculates profit: `(sellingPrice - buyingPrice) * quantity`
- Validates franchise ownership
- Marks sales as imported (adds note with import timestamp)
- Comprehensive error tracking and reporting

### 2. Route (`server/routes/sale.routes.js`)
- **Endpoint**: `POST /api/sales/import`
- **Middleware**: 
  - `authMiddleware` (applied to all sale routes)
  - `uploadExcel` (single file upload)
- **Position**: Placed before `/:id` route to avoid conflicts

## API Endpoint

```
POST /api/sales/import
Content-Type: multipart/form-data
Authorization: Bearer <token>

Body: { file: <Excel file> }
```

## Excel File Format

### Required Columns:
| Column Name | Type | Required | Description |
|------------|------|----------|-------------|
| `invoiceNo` | String | ✅ | Invoice number (used to group items into sales) |
| `saleDate` | Date | ✅ | Sale date (ISO format: YYYY-MM-DD) |
| `franchiseId` | ObjectId | ✅ | Franchise ID |
| `productId` | ObjectId | ✅ | Product ID |
| `quantity` | Integer | ✅ | Quantity sold (>= 1) |
| `sellingPrice` | Number | ✅ | Selling price per unit (>= 0) |
| `paymentMethod` | String | ✅ | One of: cash, card, upi, bank_transfer, credit |
| `saleType` | String | ✅ | One of: online, offline |

### Optional Columns:
| Column Name | Type | Required | Description |
|------------|------|----------|-------------|
| `productSku` | String | ❌ | Product SKU (for validation) |
| `buyingPrice` | Number | ❌ | Buying price (uses product's buyingPrice if not provided) |
| `discount` | Number | ❌ | Discount percentage (0-100) |
| `tax` | Number | ❌ | Tax percentage (0-100) |
| `customerName` | String | ❌ | Customer name |
| `customerEmail` | String | ❌ | Customer email |
| `notes` | String | ❌ | Additional notes |

### Example Excel Structure:
```
| invoiceNo | saleDate   | franchiseId          | productId            | quantity | sellingPrice | buyingPrice | discount | tax | paymentMethod | saleType | customerName | customerEmail |
|-----------|------------|----------------------|----------------------|----------|--------------|-------------|----------|-----|---------------|----------|--------------|---------------|
| INV-001   | 2024-01-15 | 507f1f77bcf86cd799439011 | 507f1f77bcf86cd799439012 | 2        | 1200         | 800         | 0        | 10  | cash          | offline  | John Doe     | john@example.com |
| INV-001   | 2024-01-15 | 507f1f77bcf86cd799439011 | 507f1f77bcf86cd799439013 | 1        | 500          | 300         | 5        | 10  | cash          | offline  | John Doe     | john@example.com |
| INV-002   | 2024-01-16 | 507f1f77bcf86cd799439011 | 507f1f77bcf86cd799439014 | 3        | 800          | 600         | 0        | 10  | card          | online   | Jane Smith   | jane@example.com |
```

**Note**: Multiple rows with the same `invoiceNo` will be grouped into a single sale with multiple items.

## Key Features

### ✅ Auto-Calculate Profit
- Profit is automatically calculated: `(sellingPrice - buyingPrice) * quantity`
- If `buyingPrice` is not provided in Excel, uses product's `buyingPrice` from database
- Profit is calculated per item and summed for total sale profit

### ✅ Franchise Ownership Validation
- Validates that user has access to the franchise specified in each row
- Validates that all products in a sale belong to the same franchise
- Validates that sale franchise matches product franchise
- Non-admin users can only import sales for their assigned franchises

### ✅ Mark as Imported
- Adds import timestamp to sale notes: `[Imported on YYYY-MM-DD HH:MM:SS]`
- Preserves existing notes if present
- Allows filtering imported sales in reports

### ✅ Grouping by Invoice Number
- Rows with the same `invoiceNo` are grouped into a single sale
- Each sale can have multiple items (products)
- All items in a sale must belong to the same franchise

### ✅ Validation
- Invoice number validation (required, unique)
- Sale date validation (required, valid date format)
- Franchise ID validation (required, valid ObjectId, user access)
- Product ID validation (required, valid ObjectId, exists in database)
- Quantity validation (required, integer >= 1)
- Price validation (sellingPrice >= 0, buyingPrice >= 0 if provided)
- Discount validation (0-100 if provided)
- Tax validation (0-100 if provided)
- Payment method validation (enum values)
- Sale type validation (enum values)
- Duplicate invoice number check

## API Response Format

### Success Response:
```json
{
  "success": true,
  "message": "Import completed: 50 sales imported, 2 failed, 0 rows skipped",
  "data": {
    "importLogId": "507f1f77bcf86cd799439011",
    "totalRows": 52,
    "successfulSales": 50,
    "failedSales": 2,
    "skippedRows": 0,
    "errors": [
      {
        "row": 5,
        "field": "invoiceNo",
        "message": "Invoice number \"INV-001\" already exists",
        "value": "INV-001"
      }
    ],
    "warnings": [
      {
        "row": 0,
        "field": "invoiceNo",
        "message": "Invoice number INV-002 already exists, skipping",
        "value": "INV-002"
      }
    ],
    "processedSales": [
      {
        "saleId": "507f1f77bcf86cd799439012",
        "invoiceNumber": "INV-003",
        "itemsCount": 2,
        "totalProfit": 800
      }
    ]
  }
}
```

### Error Response:
```json
{
  "success": false,
  "message": "Error importing sales",
  "error": "Missing required columns: invoiceNo, saleDate",
  "importLogId": "507f1f77bcf86cd799439011"
}
```

## Data Processing Flow

1. **Parse Excel File**
   - Read first worksheet
   - Extract header row
   - Validate required columns

2. **Validate Rows**
   - Validate each row's data
   - Check franchise access
   - Collect errors for invalid rows

3. **Group by Invoice Number**
   - Group rows with same `invoiceNo` into sales
   - Each group becomes one sale with multiple items

4. **Enrich Items**
   - Fetch product data from database
   - Validate franchise ownership
   - Use product's buyingPrice if not provided
   - Auto-calculate profit

5. **Create Sales**
   - Calculate totals (subTotal, discount, tax, grandTotal, profit)
   - Check for duplicate invoice numbers
   - Create sale with imported flag in notes
   - Update product stock (via Sale model pre-save hook)

6. **Track Import**
   - Create import log entry
   - Record success/failure statistics
   - Return detailed results

## Important Notes

### Stock Updates
- Product stock is automatically updated via Sale model's `pre('save')` hook
- Stock is decremented: `stockQuantity -= quantity`
- Product sales statistics are updated: `totalSold`, `totalRevenue`, `totalProfit`, `lastSold`

### Duplicate Invoice Numbers
- If an invoice number already exists, the sale is skipped
- A warning is added to the import log
- The sale is not created (prevents duplicates)

### Date Handling
- Sale date from Excel is used for `createdAt` field
- If not provided or invalid, uses current date
- Allows importing historical sales data

### Profit Calculation
- Profit per item: `(sellingPrice - buyingPrice) * quantity`
- Total profit: Sum of all item profits
- Automatically calculated, no manual input required

## Security

- **Authentication Required**: All import endpoints require authentication
- **Franchise Access Control**: Users can only import sales for their assigned franchises (unless admin)
- **File Type Validation**: Only Excel files (.xlsx) are accepted
- **File Size Limit**: 10MB (configured in upload middleware)

## Usage Example

### Frontend (React/TypeScript):
```typescript
const handleSalesImport = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch('/api/sales/import', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    const result = await response.json();
    if (result.success) {
      console.log(`Imported ${result.data.successfulSales} sales`);
      console.log(`Errors: ${result.data.failedSales}`);
      console.log(`Warnings: ${result.data.warnings.length}`);
    }
  } catch (error) {
    console.error('Import failed:', error);
  }
};
```

## Error Handling

### Common Errors:
1. **Missing File**: "No file uploaded. Please upload an Excel (.xlsx) file."
2. **Invalid File Type**: "Invalid file type. Please upload an Excel (.xlsx) file."
3. **Missing Columns**: "Missing required columns: invoiceNo, saleDate"
4. **Invalid Franchise**: "Access denied to this franchise"
5. **Invalid Product**: "Product not found: {productId}"
6. **Franchise Mismatch**: "Sale franchise does not match product franchise"
7. **Duplicate Invoice**: "Invoice number \"XXX\" already exists"
8. **Invalid Data**: Field-specific validation errors

## Database Impact

### Collections Modified:
- **sales**: Created sales records
- **products**: Updated stock quantities and sales statistics (via pre-save hook)
- **importlogs**: New import log entries

### Indexes Used:
- `sales.invoiceNumber` (unique index for duplicate checking)
- `sales.franchise` (for franchise filtering)
- `products._id` (for product lookup)
- `franchises._id` (for franchise validation)

## Performance Considerations

- **Batch Processing**: Processes sales sequentially (can be optimized for large files)
- **Memory Usage**: File loaded into memory (10MB limit)
- **Database Queries**: 
  - One query per sale for duplicate checking
  - One query per product for enrichment
  - One query per franchise for validation
- **Error Limits**: Response includes max 50 errors, 20 warnings, 100 processed sales

## Future Enhancements

1. **Batch Operations**: Optimize database queries with bulk operations
2. **Async Processing**: Process large files in background jobs
3. **Progress Tracking**: WebSocket updates for import progress
4. **Template Download**: Provide Excel template with validation
5. **Skip Stock Updates**: Option to import without updating stock (for historical data)
6. **Dry Run Mode**: Validate without creating sales
7. **Rollback Support**: Ability to rollback failed imports
8. **Import History**: View and manage import history

## Testing Checklist

- [ ] Upload valid Excel file
- [ ] Upload invalid file type
- [ ] Test with missing required columns
- [ ] Test with duplicate invoice numbers
- [ ] Test with invalid franchise ID
- [ ] Test with unauthorized franchise access
- [ ] Test with invalid product ID
- [ ] Test with franchise mismatch (product from different franchise)
- [ ] Test with multiple items per sale (grouping)
- [ ] Test profit calculation (with and without buyingPrice)
- [ ] Test stock updates
- [ ] Test with empty rows
- [ ] Test with large file (1000+ rows)
- [ ] Verify import log creation
- [ ] Verify sales marked as imported
- [ ] Test with historical dates
- [ ] Test with all optional fields
