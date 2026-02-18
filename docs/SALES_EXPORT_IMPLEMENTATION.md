# Sales Export Feature Implementation (STEP 4)

## Overview
Implemented sales export functionality at line-item level (one row per product in each sale) supporting Excel, PDF, and CSV formats with filtering options.

## Implementation Details

### 1. Export Controller (`server/controllers/sale.controller.js`)
**Function**: `exportSalesReport` (enhanced)

**Features**:
- Line-item level export (one row per product sold)
- Supports Excel (.xlsx), PDF, and CSV formats
- Filtering by franchise, date range, and product
- Structured table output with totals row
- Color-coded profit in Excel (red for negative)

### 2. Route (`server/routes/sale.routes.js`)
- **Endpoint**: `GET /api/sales/export` (already exists)
- **Middleware**: Routes are protected (check if auth middleware is applied)

## API Endpoint

```
GET /api/sales/export?format=excel|pdf|csv&franchise=...&startDate=...&endDate=...&product=...
```

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `format` | String | No | Export format: `excel`, `xlsx`, `pdf`, or `csv` (default: `excel`) |
| `franchise` | ObjectId | No | Filter by franchise ID |
| `startDate` | Date | No | Start date for date range filter (ISO format) |
| `endDate` | Date | No | End date for date range filter (ISO format) |
| `product` | ObjectId | No | Filter by specific product ID |

### Filters

**Franchise Filtering**:
- If `franchise` is provided, shows sales from that franchise only
- If not provided and user is not admin, shows sales from user's assigned franchises
- Admin users see all sales if no franchise filter is applied

**Date Range Filter**:
- `startDate`: Include sales from this date onwards
- `endDate`: Include sales up to this date
- Both dates are inclusive
- Date format: ISO 8601 (e.g., `2024-01-01` or `2024-01-01T00:00:00Z`)

**Product Filter**:
- Filters line items to show only sales of the specified product
- Product ID must be a valid ObjectId

## Export Columns

The export includes the following columns (as specified):

| Column | Description | Source |
|--------|-------------|--------|
| `invoiceNo` | Invoice number | `sale.invoiceNumber` |
| `saleId` | Sale document ID | `sale._id` |
| `date` | Sale date | `sale.createdAt` (formatted) |
| `franchise` | Franchise name | `sale.franchise.name` |
| `productName` | Product name | `item.name` or `item.product.name` |
| `productId` | Product document ID | `item.product._id` |
| `qty` | Quantity sold | `item.quantity` |
| `revenue` | Revenue (selling price × quantity) | `item.sellingPrice × item.quantity` |
| `cost` | Cost (buying price × quantity) | `item.buyingPrice × item.quantity` |
| `profit` | Profit (revenue - cost) | `item.profit` or calculated |

**Additional Columns** (for reference):
- `franchiseCode`: Franchise code
- `productSku`: Product SKU

## Export Formats

### Excel (.xlsx) Format

**Columns**:
1. Invoice No
2. Sale ID
3. Date
4. Franchise
5. Product Name
6. Product ID
7. SKU
8. Quantity
9. Revenue
10. Cost
11. Profit

**Features**:
- Header row with bold font and gray background
- Color-coded profit:
  - Red background: Negative profit
  - Default: Positive profit
- Totals row with summary statistics (bold font, gray background)

**Totals Row Includes**:
- Total Quantity
- Total Revenue
- Total Cost
- Total Profit

### PDF Format

**Structure**:
1. **Header Section**:
   - Title: "Sales Export"
   - Generation timestamp

2. **Summary Section**:
   - Total Line Items
   - Total Quantity
   - Total Revenue
   - Total Cost
   - Total Profit

3. **Table Section**:
   - Columns: Invoice, Sale ID, Date, Franchise, Product, Product ID, SKU, Qty, Revenue, Cost, Profit
   - Alternating row colors for readability
   - Header row with gray background
   - Compact font size for better fit

4. **Totals Row**:
   - Summary statistics at the bottom of the table

**Features**:
- Professional table layout
- Automatic pagination for large datasets
- Alternating row colors
- Bold totals row

### CSV Format

**Structure**:
- Comma-separated values
- Headers in first row
- Data rows follow
- Totals row at the end
- Values enclosed in double quotes

## Data Processing

### Line-Item Expansion
- Each sale is expanded into multiple rows (one per product/item)
- If a sale has 3 products, it generates 3 rows in the export
- Each row represents one product sold in that sale

### Profit Calculation
- Uses `item.profit` if available
- Otherwise calculates: `(item.sellingPrice × item.quantity) - (item.buyingPrice × item.quantity)`

### Totals Calculation
- **Total Items**: Count of all line items
- **Total Quantity**: Sum of all quantities
- **Total Revenue**: Sum of all revenue values
- **Total Cost**: Sum of all cost values
- **Total Profit**: Sum of all profit values

## Usage Examples

### Excel Export
```bash
# Export all sales to Excel
GET /api/sales/export?format=excel

# Export sales from specific franchise
GET /api/sales/export?format=excel&franchise=507f1f77bcf86cd799439011

# Export sales in date range
GET /api/sales/export?format=excel&startDate=2024-01-01&endDate=2024-01-31

# Export sales for specific product
GET /api/sales/export?format=excel&product=507f1f77bcf86cd799439012

# Combined filters
GET /api/sales/export?format=excel&franchise=507f1f77bcf86cd799439011&startDate=2024-01-01&endDate=2024-01-31&product=507f1f77bcf86cd799439012
```

### PDF Export
```bash
# Export all sales to PDF
GET /api/sales/export?format=pdf

# Export with filters
GET /api/sales/export?format=pdf&franchise=507f1f77bcf86cd799439011&startDate=2024-01-01&endDate=2024-01-31
```

### CSV Export
```bash
# Export to CSV
GET /api/sales/export?format=csv&startDate=2024-01-01&endDate=2024-01-31
```

### Frontend Usage (React/TypeScript)
```typescript
const handleSalesExport = async (
  format: 'excel' | 'pdf' | 'csv',
  filters?: {
    franchise?: string;
    startDate?: string;
    endDate?: string;
    product?: string;
  }
) => {
  const params = new URLSearchParams();
  params.append('format', format);
  
  if (filters?.franchise) params.append('franchise', filters.franchise);
  if (filters?.startDate) params.append('startDate', filters.startDate);
  if (filters?.endDate) params.append('endDate', filters.endDate);
  if (filters?.product) params.append('product', filters.product);
  
  const url = `/api/sales/export?${params.toString()}`;
  
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
  link.download = `sales-export-${new Date().toISOString().split('T')[0]}.${
    format === 'pdf' ? 'pdf' : format === 'csv' ? 'csv' : 'xlsx'
  }`;
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
Content-Disposition: attachment; filename=sales-export-YYYY-MM-DD.xlsx
```

### PDF Export
```
Content-Type: application/pdf
Content-Disposition: attachment; filename=sales-export-YYYY-MM-DD.pdf
```

### CSV Export
```
Content-Type: text/csv
Content-Disposition: attachment; filename=sales-export-YYYY-MM-DD.csv
```

## Error Handling

### Invalid Format
```json
{
  "success": false,
  "message": "Invalid format. Supported formats: excel, xlsx, pdf, csv"
}
```

### General Error
```json
{
  "success": false,
  "message": "Failed to export sales report",
  "error": "Error message details"
}
```

## Security

- **Authentication Required**: Export endpoints should be protected (verify auth middleware)
- **Franchise Access Control**: Users can only export sales from their assigned franchises (unless admin)
- **Query Validation**: Filters are validated (dates, ObjectIds)

## Performance Considerations

- **No Pagination**: Exports all matching sales (consider adding pagination for very large datasets)
- **Memory Usage**: All sales loaded into memory before export generation
- **Database Queries**: 
  - Single query with population for franchise and product data
  - Line items expanded in memory (not in database)
- **Streaming**: PDF generation uses streaming for better memory efficiency

## File Naming Convention

- **Excel**: `sales-export-YYYY-MM-DD.xlsx`
- **PDF**: `sales-export-YYYY-MM-DD.pdf`
- **CSV**: `sales-export-YYYY-MM-DD.csv`
- Date format: ISO date (YYYY-MM-DD)

## Differences from Previous Export

### Previous Implementation (Sale-Level)
- One row per sale
- Columns: Invoice #, Date, Customer, Type, Payment, Items, Subtotal, Discount, Tax, Total, Profit, Status

### New Implementation (Line-Item Level)
- One row per product sold
- Columns: Invoice No, Sale ID, Date, Franchise, Product Name, Product ID, Qty, Revenue, Cost, Profit
- More detailed breakdown of each sale
- Better for product-level analysis

## Future Enhancements

1. **Pagination**: Support paginated exports for large datasets
2. **Custom Columns**: Allow users to select which columns to export
3. **Grouping**: Option to group by product, franchise, or date
4. **Aggregation**: Include summary rows by product/category
5. **Email Export**: Send export file via email
6. **Scheduled Exports**: Schedule automatic exports
7. **Export Templates**: Customizable export templates
8. **Compression**: Compress large exports
9. **Async Processing**: Process large exports in background jobs
10. **Progress Tracking**: WebSocket updates for export progress

## Testing Checklist

- [ ] Export all sales to Excel
- [ ] Export all sales to PDF
- [ ] Export all sales to CSV
- [ ] Export with franchise filter
- [ ] Export with date range filter
- [ ] Export with product filter
- [ ] Export with combined filters
- [ ] Verify line-item expansion (multiple rows per sale)
- [ ] Verify totals row in Excel
- [ ] Verify totals row in PDF
- [ ] Verify totals row in CSV
- [ ] Verify color coding in Excel (negative profit)
- [ ] Verify pagination in PDF for large datasets
- [ ] Test with no sales matching filters
- [ ] Test authentication requirement
- [ ] Test franchise access control
- [ ] Verify file download triggers correctly
- [ ] Verify file naming convention
- [ ] Test with sales containing multiple products
- [ ] Verify profit calculation accuracy
