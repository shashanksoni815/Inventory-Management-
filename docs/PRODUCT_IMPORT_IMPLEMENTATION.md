# Product Import Feature Implementation (STEP 2)

## Overview
Implemented bulk product import functionality for admin and franchise managers using Excel (.xlsx) files.

## Implementation Details

### 1. ImportLog Model (`server/models/ImportLog.model.js`)
- Tracks all import operations
- Fields:
  - `importType`: 'products', 'sales', 'transfers'
  - `fileName`, `fileSize`, `totalRows`
  - `successfulRows`, `failedRows`, `skippedRows`
  - `errors[]`, `warnings[]`
  - `importedBy`, `franchise`
  - `status`: 'pending', 'processing', 'completed', 'failed', 'partial'
  - `startedAt`, `completedAt`, `duration`

### 2. Upload Middleware (`server/middleware/upload.middleware.js`)
- Uses `multer` for file upload handling
- Memory storage (file in `req.file.buffer`)
- File filter: Only accepts Excel files (.xlsx, .xls)
- File size limit: 10MB

### 3. Import Controller (`server/controllers/product.controller.js`)
**Function**: `importProducts`

**Process Flow**:
1. **File Validation**
   - Checks if file exists
   - Validates file type (.xlsx)
   - Creates import log entry

2. **Excel Parsing**
   - Uses `exceljs` library
   - Reads first worksheet
   - Extracts header row
   - Validates required columns

3. **Row Validation**
   - Validates each row:
     - `productName`: Required, non-empty
     - `sku`: Required, unique per franchise
     - `category`: Required, must be valid enum value
     - `costPrice`: Required, number >= 0
     - `sellingPrice`: Required, number >= 0
     - `quantity`: Required, number >= 0
     - `franchiseId`: Required, valid ObjectId
   - Checks user access to franchise
   - Validates SKU uniqueness (within file and database)

4. **Product Processing**
   - For each valid row:
     - Checks if product exists (by `productId` or `sku`+`franchise`)
     - **Update**: If exists, updates fields and stock
     - **Create**: If new, creates product with initial stock
     - Adds stock history entries
     - Tracks success/failure

5. **Import Log**
   - Updates import log with results
   - Records errors and warnings
   - Sets final status

### 4. Route (`server/routes/product.routes.js`)
- **Endpoint**: `POST /api/products/import`
- **Middleware**: 
  - `authMiddleware` (applied to all product routes)
  - `uploadExcel` (single file upload)
- **Position**: Placed before `/:id` route to avoid conflicts

## Excel File Format

### Required Columns:
| Column Name | Type | Required | Description |
|------------|------|----------|-------------|
| `productName` | String | ✅ | Product name |
| `sku` | String | ✅ | SKU (unique per franchise) |
| `category` | String | ✅ | One of: Electronics, Clothing, Books, Home & Kitchen, Sports, Other |
| `costPrice` | Number | ✅ | Buying price (>= 0) |
| `sellingPrice` | Number | ✅ | Selling price (>= 0) |
| `quantity` | Number | ✅ | Stock quantity (>= 0) |
| `franchiseId` | ObjectId | ✅ | Franchise ID |

### Optional Columns:
| Column Name | Type | Required | Description |
|------------|------|----------|-------------|
| `productId` | ObjectId | ❌ | Product ID (for updates) |
| `brand` | String | ❌ | Product brand |
| `description` | String | ❌ | Product description |

### Example Excel Structure:
```
| productId | productName | sku      | category | costPrice | sellingPrice | quantity | franchiseId          | brand | description |
|-----------|-------------|----------|----------|-----------|--------------|----------|----------------------|-------|-------------|
|           | Laptop      | LAP001   | Electronics | 800    | 1200        | 10       | 507f1f77bcf86cd799439011 | Dell  | High-end laptop |
| 507f...   | Mouse       | MOU001   | Electronics | 10     | 25          | 50       | 507f1f77bcf86cd799439011 | Logitech | Wireless mouse |
```

## API Response Format

### Success Response:
```json
{
  "success": true,
  "message": "Import completed: 50 successful, 2 failed, 0 skipped",
  "data": {
    "importLogId": "507f1f77bcf86cd799439011",
    "totalRows": 52,
    "successfulRows": 50,
    "failedRows": 2,
    "skippedRows": 0,
    "errors": [
      {
        "row": 5,
        "field": "sku",
        "message": "SKU \"LAP001\" already exists in this franchise",
        "value": "LAP001"
      }
    ],
    "processedProducts": [
      {
        "productId": "507f1f77bcf86cd799439012",
        "action": "created",
        "sku": "MOU001"
      }
    ]
  }
}
```

### Error Response:
```json
{
  "success": false,
  "message": "Error importing products",
  "error": "Missing required columns: sku, category",
  "importLogId": "507f1f77bcf86cd799439011"
}
```

## Features

### ✅ Validation
- Product name validation
- SKU uniqueness validation (per franchise)
- Franchise ID validation
- Quantity >= 0 validation
- Category enum validation
- Price >= 0 validation
- User access control (franchise permissions)

### ✅ Product Management
- **Create**: New products with initial stock
- **Update**: Existing products (by ID or SKU+franchise)
- Stock history tracking
- Automatic profit margin calculation

### ✅ Import Tracking
- Complete import log
- Error tracking per row
- Success/failure statistics
- Import duration tracking

### ✅ Security
- Authentication required
- Franchise access control
- File type validation
- File size limits

## Usage Example

### Frontend (React/TypeScript):
```typescript
const handleImport = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch('/api/products/import', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    const result = await response.json();
    if (result.success) {
      console.log(`Imported ${result.data.successfulRows} products`);
      console.log(`Errors: ${result.data.failedRows}`);
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
3. **Missing Columns**: "Missing required columns: sku, category"
4. **Invalid Franchise**: "Access denied to this franchise"
5. **Duplicate SKU**: "SKU \"XXX\" already exists in this franchise"
6. **Invalid Data**: Field-specific validation errors

## Database Impact

### Collections Modified:
- **products**: Created/updated products
- **importlogs**: New import log entries

### Indexes Used:
- `products.sku` + `products.franchise` (compound unique index)
- `products.franchise` (for franchise filtering)
- `importlogs.importedBy`, `importlogs.franchise` (for querying)

## Performance Considerations

- **Batch Processing**: Processes rows sequentially (can be optimized for large files)
- **Memory Usage**: File loaded into memory (10MB limit)
- **Database Queries**: 
  - One query per row for franchise validation (can be optimized with batch lookup)
  - One query per product (create/update)
- **Error Limits**: Response includes max 50 errors, 100 processed products

## Future Enhancements

1. **Batch Operations**: Optimize database queries with bulk operations
2. **Async Processing**: Process large files in background jobs
3. **Progress Tracking**: WebSocket updates for import progress
4. **Template Download**: Provide Excel template with validation
5. **Partial Updates**: Allow updating only specific fields
6. **Stock Adjustment Types**: Support different stock adjustment types (purchase, adjustment, return)

## Testing Checklist

- [ ] Upload valid Excel file
- [ ] Upload invalid file type
- [ ] Test with missing required columns
- [ ] Test with duplicate SKUs in file
- [ ] Test with duplicate SKUs in database
- [ ] Test with invalid franchise ID
- [ ] Test with unauthorized franchise access
- [ ] Test product creation
- [ ] Test product update (by ID)
- [ ] Test product update (by SKU)
- [ ] Test with empty rows
- [ ] Test with large file (1000+ rows)
- [ ] Verify import log creation
- [ ] Verify stock history entries
