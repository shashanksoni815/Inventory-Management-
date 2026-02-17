# Stock Import (Stock In) Feature Implementation (STEP 6)

## Overview
Implemented stock import functionality to track stock received by a franchise. This endpoint allows recording goods received from warehouses or other franchises, updating product stock, and creating transfer records.

## Implementation Details

### 1. Import Controller (`server/controllers/transfer.controller.js`)
**Function**: `importStock`

**Features**:
- Creates transfer records for stock received
- Updates product stock in destination franchise
- Supports single or bulk imports (array of transfers)
- Validates franchise ownership
- Creates product entries if they don't exist in destination franchise
- Adds stock history entries

### 2. Route (`server/routes/transfer.routes.js`)
- **Endpoint**: `POST /api/transfers/import`
- **Middleware**: `authMiddleware` (applied to all transfer routes)
- **Position**: Placed before `/:id` route to avoid conflicts

## API Endpoint

```
POST /api/transfers/import
Content-Type: application/json
Authorization: Bearer <token>

Body: Single transfer object or array of transfer objects
```

## Request Body

### Single Transfer:
```json
{
  "productId": "507f1f77bcf86cd799439011",
  "quantity": 10,
  "cost": 50.00,
  "fromFranchise": "507f1f77bcf86cd799439012",
  "toFranchise": "507f1f77bcf86cd799439013",
  "date": "2024-01-15T10:00:00Z",
  "status": "completed",
  "notes": "Stock received from warehouse"
}
```

### Bulk Transfer (Array):
```json
[
  {
    "productId": "507f1f77bcf86cd799439011",
    "quantity": 10,
    "cost": 50.00,
    "fromFranchise": "507f1f77bcf86cd799439012",
    "toFranchise": "507f1f77bcf86cd799439013",
    "date": "2024-01-15T10:00:00Z",
    "status": "completed"
  },
  {
    "productId": "507f1f77bcf86cd799439014",
    "quantity": 5,
    "cost": 75.00,
    "fromFranchise": "507f1f77bcf86cd799439012",
    "toFranchise": "507f1f77bcf86cd799439013",
    "status": "completed"
  }
]
```

## Request Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `productId` | ObjectId | ✅ | Product ID |
| `quantity` | Number | ✅ | Quantity received (>= 1) |
| `cost` | Number | ✅ | Unit cost/price (>= 0) |
| `fromFranchise` | ObjectId | ✅ | Source franchise/warehouse ID |
| `toFranchise` | ObjectId | ✅ | Destination franchise ID (receiving) |
| `date` | Date | ❌ | Transfer date (default: current date) |
| `status` | String | ❌ | Transfer status (default: 'completed') |
| `notes` | String | ❌ | Additional notes |

### Status Values:
- `pending` - Transfer pending approval
- `approved` - Transfer approved
- `rejected` - Transfer rejected
- `in_transit` - Transfer in transit
- `completed` - Transfer completed (default for stock in)
- `cancelled` - Transfer cancelled

## Key Features

### ✅ Stock Updates
- If status is `completed`, product stock is updated in destination franchise
- Stock quantity is increased by the imported quantity
- Creates product entry in destination franchise if it doesn't exist
- Uses import `cost` as the product's `buyingPrice` in destination franchise

### ✅ Franchise Ownership Validation
- Validates that user has access to the receiving franchise (`toFranchise`)
- Non-admin users can only import stock to their assigned franchises
- Validates that both franchises exist

### ✅ Product Management
- If product doesn't exist in destination franchise, creates a new product entry
- Copies product details (SKU, name, category, etc.) from source product
- Sets `buyingPrice` to the import `cost`
- Maintains product `sellingPrice` from source product

### ✅ Stock History
- Adds stock history entry when stock is imported
- Records transfer type as `transfer_in`
- Includes notes about source franchise

### ✅ Transfer Record
- Creates transfer record with all details
- Calculates total value: `cost × quantity`
- Sets `actualDelivery` date if status is `completed`
- Adds history entry for tracking

## API Response Format

### Success Response (Single Transfer):
```json
{
  "success": true,
  "message": "Processed 1 transfer(s), 0 error(s)",
  "data": {
    "successful": [
      {
        "transferId": "507f1f77bcf86cd799439015",
        "productId": "507f1f77bcf86cd799439011",
        "productName": "Laptop",
        "quantity": 10,
        "fromFranchise": "Warehouse A",
        "toFranchise": "Store B",
        "status": "completed",
        "totalValue": 500.00
      }
    ]
  }
}
```

### Success Response (Bulk Transfer):
```json
{
  "success": true,
  "message": "Processed 2 transfer(s), 1 error(s)",
  "data": {
    "successful": [
      {
        "transferId": "507f1f77bcf86cd799439015",
        "productId": "507f1f77bcf86cd799439011",
        "productName": "Laptop",
        "quantity": 10,
        "fromFranchise": "Warehouse A",
        "toFranchise": "Store B",
        "status": "completed",
        "totalValue": 500.00
      }
    ],
    "errors": [
      {
        "index": 1,
        "message": "Product not found"
      }
    ]
  }
}
```

### Error Response:
```json
{
  "success": false,
  "message": "All transfers failed",
  "errors": [
    {
      "index": 0,
      "message": "Missing required fields: productId, quantity, cost, fromFranchise, toFranchise are required"
    }
  ]
}
```

## Usage Examples

### Single Stock Import:
```typescript
const importStock = async () => {
  const response = await fetch('/api/transfers/import', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      productId: '507f1f77bcf86cd799439011',
      quantity: 10,
      cost: 50.00,
      fromFranchise: '507f1f77bcf86cd799439012',
      toFranchise: '507f1f77bcf86cd799439013',
      date: '2024-01-15T10:00:00Z',
      status: 'completed',
      notes: 'Stock received from warehouse',
    }),
  });

  const result = await response.json();
  console.log(result);
};
```

### Bulk Stock Import:
```typescript
const importBulkStock = async () => {
  const transfers = [
    {
      productId: '507f1f77bcf86cd799439011',
      quantity: 10,
      cost: 50.00,
      fromFranchise: '507f1f77bcf86cd799439012',
      toFranchise: '507f1f77bcf86cd799439013',
      status: 'completed',
    },
    {
      productId: '507f1f77bcf86cd799439014',
      quantity: 5,
      cost: 75.00,
      fromFranchise: '507f1f77bcf86cd799439012',
      toFranchise: '507f1f77bcf86cd799439013',
      status: 'completed',
    },
  ];

  const response = await fetch('/api/transfers/import', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(transfers),
  });

  const result = await response.json();
  console.log(result);
};
```

## Validation Rules

### Required Fields:
- `productId`: Must be a valid ObjectId
- `quantity`: Must be a number >= 1
- `cost`: Must be a number >= 0
- `fromFranchise`: Must be a valid ObjectId, franchise must exist
- `toFranchise`: Must be a valid ObjectId, franchise must exist

### Access Control:
- User must have access to `toFranchise` (receiving franchise)
- Non-admin users can only import to their assigned franchises
- Admin users can import to any franchise

### Product Validation:
- Product must exist in database
- Product SKU is used to find/create product in destination franchise

## Stock Update Logic

### When Status is 'completed':
1. **Find Product in Destination Franchise**:
   - Searches for product with same SKU in destination franchise
   - If found: Updates stock quantity
   - If not found: Creates new product entry

2. **Create Product Entry** (if needed):
   - Copies product details from source product
   - Sets `buyingPrice` to import `cost`
   - Sets `stockQuantity` to imported quantity
   - Sets `franchise` to destination franchise
   - Sets `status` to 'active'

3. **Update Stock**:
   - Increases `stockQuantity` by imported quantity
   - Adds stock history entry with type `transfer_in`

4. **Stock History Entry**:
   - Date: Transfer date
   - Quantity: Imported quantity
   - Type: `transfer_in`
   - Note: "Stock imported from {fromFranchise name}"
   - Franchise: Destination franchise

## Error Handling

### Common Errors:
1. **Missing Fields**: "Missing required fields: productId, quantity, cost, fromFranchise, toFranchise are required"
2. **Invalid ObjectId**: "Invalid productId" / "Invalid fromFranchise" / "Invalid toFranchise"
3. **Invalid Quantity**: "Quantity must be a number >= 1"
4. **Invalid Cost**: "Cost must be a number >= 0"
5. **Franchise Not Found**: "From franchise not found" / "To franchise not found"
6. **Access Denied**: "Access denied to receiving franchise"
7. **Product Not Found**: "Product not found"
8. **Invalid Status**: "Status must be one of: pending, approved, rejected, in_transit, completed, cancelled"

## Database Impact

### Collections Modified:
- **transfers**: New transfer records created
- **products**: Stock updated or new product entries created in destination franchise

### Indexes Used:
- `transfers.fromFranchise` (for franchise filtering)
- `transfers.toFranchise` (for franchise filtering)
- `products.sku` + `products.franchise` (for finding products in destination franchise)

## Security

- **Authentication Required**: All endpoints require authentication
- **Franchise Access Control**: Users can only import stock to their assigned franchises (unless admin)
- **Input Validation**: All fields are validated before processing

## Use Cases

1. **Warehouse Stock Receipt**: Record stock received from central warehouse
2. **Inter-Franchise Transfer**: Record stock received from another franchise
3. **Bulk Import**: Import multiple products at once
4. **Historical Data**: Import stock with custom dates for historical records
5. **Stock Adjustment**: Use to adjust stock levels (with appropriate notes)

## Differences from Regular Transfer

| Feature | Regular Transfer (`createTransfer`) | Stock Import (`importStock`) |
|---------|-----------------------------------|----------------------------|
| **Status** | Starts as 'pending' | Defaults to 'completed' |
| **Approval** | Requires approval workflow | Direct completion |
| **Stock Update** | Only on completion | Immediate if status is 'completed' |
| **Use Case** | Planned transfers | Stock already received |
| **Bulk Support** | Single transfer only | Supports bulk imports |

## Future Enhancements

1. **Excel Import**: Support Excel file uploads for bulk imports
2. **Stock Adjustment**: Separate endpoint for stock adjustments
3. **Warehouse Management**: Support for warehouse entities
4. **Cost Tracking**: Track cost variations over time
5. **Batch Processing**: Optimize bulk imports with database transactions
6. **Validation Rules**: Custom validation rules per franchise
7. **Notifications**: Notify relevant parties when stock is imported
8. **Reporting**: Generate import reports and analytics

## Testing Checklist

- [ ] Import single stock item
- [ ] Import bulk stock items
- [ ] Test with missing required fields
- [ ] Test with invalid ObjectIds
- [ ] Test with invalid quantity (< 1)
- [ ] Test with invalid cost (< 0)
- [ ] Test with non-existent franchises
- [ ] Test with non-existent product
- [ ] Test franchise access control
- [ ] Test stock update when status is 'completed'
- [ ] Test product creation in destination franchise
- [ ] Test stock history entry creation
- [ ] Test with different status values
- [ ] Test with custom date
- [ ] Test with notes
- [ ] Verify transfer record creation
- [ ] Verify total value calculation
