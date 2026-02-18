# Product Export Feature Implementation (STEP 3)

## Overview
Implemented product export functionality supporting both Excel (.xlsx) and PDF formats with filtering options and totals row.

## Implementation Details

### 1. Export Controller (`server/controllers/product.controller.js`)
**Function**: `exportProducts`

**Features**:
- Supports Excel (.xlsx) and PDF formats
- Filtering by franchise, category, stock status
- Structured table output with totals row
- Franchise-specific stock calculation
- Color-coded stock status in Excel

### 2. Route (`server/routes/product.routes.js`)
- **Endpoint**: `GET /api/products/export`
- **Middleware**: `authMiddleware` (applied to all product routes)
- **Position**: Placed before `/:id` route to avoid conflicts

## API Endpoint

```
GET /api/products/export?format=excel|pdf&franchise=...&category=...&stockStatus=...
```

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `format` | String | No | Export format: `excel`, `xlsx`, or `pdf` (default: `excel`) |
| `franchise` | ObjectId | No | Filter by franchise ID |
| `category` | String | No | Filter by category (must match enum values) |
| `stockStatus` | String | No | Filter by stock status: `low-stock`, `out-of-stock`, `in-stock` |
| `status` | String | No | Filter by product status: `active`, `inactive`, `discontinued` |

### Filters

**Franchise Filtering**:
- If `franchise` is provided, shows products from that franchise (including shared products)
- If not provided and user is not admin, shows products from user's assigned franchises
- Admin users see all products if no franchise filter is applied

**Category Filter**:
- Filters by product category (Electronics, Clothing, Books, Home & Kitchen, Sports, Other)
- Use `category=all` to include all categories

**Stock Status Filter**:
- `low-stock`: Products with stock <= minimum stock threshold
- `out-of-stock`: Products with stock = 0
- `in-stock`: Products with stock > minimum stock threshold

## Export Formats

### Excel (.xlsx) Format

**Columns**:
1. Product ID
2. SKU
3. Product Name
4. Category
5. Brand
6. Buying Price
7. Selling Price
8. Profit Margin %
9. Stock Quantity
10. Min Stock
11. Inventory Value
12. Stock Status (color-coded)
13. Status
14. Franchise
15. Franchise Code
16. Last Sold

**Features**:
- Header row with bold font and gray background
- Color-coded stock status:
  - Red background: Out of Stock
  - Yellow background: Low Stock
- Totals row with summary statistics (bold font, gray background)

**Totals Row Includes**:
- Total Stock Quantity
- Total Inventory Value
- Average Profit Margin
- Low Stock Count
- Out of Stock Count
- Total Products Count

### PDF Format

**Structure**:
1. **Header Section**:
   - Title: "Products Export"
   - Generation timestamp

2. **Summary Section**:
   - Total Products
   - Total Stock
   - Total Inventory Value
   - Average Profit Margin
   - Low Stock Items Count
   - Out of Stock Items Count

3. **Table Section**:
   - Columns: SKU, Name, Category, Buying $, Selling $, Stock, Status, Franchise, Value, Margin
   - Alternating row colors for readability
   - Header row with gray background

4. **Totals Row**:
   - Summary statistics at the bottom of the table

**Features**:
- Professional table layout
- Automatic pagination for large datasets
- Alternating row colors
- Bold totals row

## Data Processing

### Franchise-Specific Stock Calculation
- For each product, calculates franchise-specific stock:
  - If product belongs to selected franchise: uses `stockQuantity`
  - If product is shared: uses `sharedWith[].quantity`
  - Otherwise: uses `stockQuantity` from product's franchise

### Stock Status Calculation
- **Out of Stock**: `stockQuantity === 0`
- **Low Stock**: `stockQuantity <= minimumStock` or `stockQuantity <= reorderPoint`
- **In Stock**: `stockQuantity > minimumStock`

### Totals Calculation
- **Total Products**: Count of filtered products
- **Total Stock**: Sum of all stock quantities
- **Total Inventory Value**: Sum of (stockQuantity × buyingPrice)
- **Average Profit Margin**: Average of all profit margins
- **Low Stock Count**: Count of products with low stock status
- **Out of Stock Count**: Count of products with out of stock status

## Usage Examples

### Excel Export
```bash
# Export all products to Excel
GET /api/products/export?format=excel

# Export products from specific franchise
GET /api/products/export?format=excel&franchise=507f1f77bcf86cd799439011

# Export low stock products
GET /api/products/export?format=excel&stockStatus=low-stock

# Export Electronics category products
GET /api/products/export?format=excel&category=Electronics

# Combined filters
GET /api/products/export?format=excel&franchise=507f1f77bcf86cd799439011&category=Electronics&stockStatus=low-stock
```

### PDF Export
```bash
# Export all products to PDF
GET /api/products/export?format=pdf

# Export with filters
GET /api/products/export?format=pdf&franchise=507f1f77bcf86cd799439011&stockStatus=out-of-stock
```

### Frontend Usage (React/TypeScript)
```typescript
const handleExport = async (format: 'excel' | 'pdf', filters?: {
  franchise?: string;
  category?: string;
  stockStatus?: string;
}) => {
  const params = new URLSearchParams();
  params.append('format', format);
  
  if (filters?.franchise) params.append('franchise', filters.franchise);
  if (filters?.category) params.append('category', filters.category);
  if (filters?.stockStatus) params.append('stockStatus', filters.stockStatus);
  
  const url = `/api/products/export?${params.toString()}`;
  
  // Open in new window to trigger download
  window.open(url, '_blank');
  
  // Or use fetch for more control
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  const blob = await response.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = `products-export-${new Date().toISOString().split('T')[0]}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(downloadUrl);
};
```

## Response Headers

### Excel Export
```
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename=products-export-YYYY-MM-DD.xlsx
```

### PDF Export
```
Content-Type: application/pdf
Content-Disposition: attachment; filename=products-export-YYYY-MM-DD.pdf
```

## Error Handling

### Invalid Format
```json
{
  "success": false,
  "message": "Invalid format. Supported formats: excel, xlsx, pdf"
}
```

### General Error
```json
{
  "success": false,
  "message": "Error exporting products",
  "error": "Error message details"
}
```

## Security

- **Authentication Required**: All export endpoints require authentication
- **Franchise Access Control**: Users can only export products from their assigned franchises (unless admin)
- **Query Validation**: Filters are validated against allowed values

## Performance Considerations

- **No Pagination**: Exports all matching products (consider adding pagination for very large datasets)
- **Memory Usage**: All products loaded into memory before export generation
- **Database Queries**: Single query with population for franchise data
- **Streaming**: PDF generation uses streaming for better memory efficiency

## File Naming Convention

- **Excel**: `products-export-YYYY-MM-DD.xlsx`
- **PDF**: `products-export-YYYY-MM-DD.pdf`
- Date format: ISO date (YYYY-MM-DD)

## Future Enhancements

1. **Pagination**: Support paginated exports for large datasets
2. **Custom Columns**: Allow users to select which columns to export
3. **Date Range Filter**: Filter products by creation/update date
4. **Search Filter**: Include search term filtering
5. **Sort Options**: Allow custom sorting in exports
6. **CSV Format**: Add CSV export option
7. **Email Export**: Send export file via email
8. **Scheduled Exports**: Schedule automatic exports
9. **Export Templates**: Customizable export templates
10. **Compression**: Compress large exports

## Testing Checklist

- [ ] Export all products to Excel
- [ ] Export all products to PDF
- [ ] Export with franchise filter
- [ ] Export with category filter
- [ ] Export with stock status filter
- [ ] Export with combined filters
- [ ] Verify totals row in Excel
- [ ] Verify totals row in PDF
- [ ] Verify color coding in Excel
- [ ] Verify pagination in PDF for large datasets
- [ ] Test with no products matching filters
- [ ] Test authentication requirement
- [ ] Test franchise access control
- [ ] Verify file download triggers correctly
- [ ] Verify file naming convention
