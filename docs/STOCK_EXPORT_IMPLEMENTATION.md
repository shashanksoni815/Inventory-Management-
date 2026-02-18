# Stock Export (Stock Out) Feature Implementation (STEP 7)

## Overview
Implemented stock export functionality to track stock sent out from a franchise. This endpoint allows recording goods sent to warehouses or other franchises, reducing product stock, and creating transfer records.

## Implementation Details

### 1. Export Controller (`server/controllers/transfer.controller.js`)
**Function**: `exportStock`

**Features**:
- Creates transfer records for stock sent out
- Reduces product stock in source franchise
- Supports single or bulk exports (array of transfers)
- Validates franchise ownership and stock availability
- Adds stock history entries

### 2. Route (`server/routes/transfer.routes.js`)
- **Endpoint**: `POST /api/transfers/export`
- **Middleware**: `authMiddleware` (applied to all transfer routes)
- **Position**: Placed before `/:id` route to avoid conflicts

## API Endpoint

```
POST /api/transfers/export
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
  "fromFranchise": "507f1f77bcf86cd799439013",
  "toFranchise": "507f1f77bcf86cd799439012",
  "date": "2024-01-15T10:00:00Z",
  "status": "completed",
  "notes": "Stock sent to warehouse"
}
```

### Bulk Transfer (Array):
```json
[
  {
    "productId": "507f1f77bcf86cd799439011",
    "quantity": 10,
    "cost": 50.00,
    "fromFranchise": "507f1f77bcf86cd799439013",
    "toFranchise": "507f1f77bcf86cd799439012",
    "status": "completed"
  },
  {
    "productId": "507f1f77bcf86cd799439014",
    "quantity": 5,
    "cost": 75.00,
    "fromFranchise": "507f1f77bcf86cd799439013",
    "toFranchise": "507f1f77bcf86cd799439012",
    "status": "completed"
  }
]
```

## Request Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `productId` | ObjectId | ✅ | Product ID |
| `quantity` | Number | ✅ | Quantity to export (>= 1) |
| `cost` | Number | ✅ | Unit cost/price (>= 0) |
| `fromFranchise` | ObjectId | ✅ | Source franchise ID (sending) |
| `toFranchise` | ObjectId | ✅ | Destination franchise/warehouse ID |
| `date` | Date | ❌ | Transfer date (default: current date) |
| `status` | String | ❌ | Transfer status (default: 'completed') |
| `notes` | String | ❌ | Additional notes |

### Status Values:
- `pending` - Transfer pending approval
- `approved` - Transfer approved
- `rejected` - Transfer rejected
- `in_transit` - Transfer in transit
- `completed` - Transfer completed (default for stock out)
- `cancelled` - Transfer cancelled

## Key Features

### ✅ Stock Reduction
- If status is `completed`, product stock is reduced in source franchise
- Stock quantity is decreased by the exported quantity
- Validates stock availability before export
- Prevents negative stock quantities

### ✅ Franchise Ownership Validation
- Validates that user has access to the sending franchise (`fromFranchise`)
- Non-admin users can only export stock from their assigned franchises
- Validates that both franchises exist
- Validates that product belongs to source franchise

### ✅ Stock Availability Check
- Checks if sufficient stock is available before export
- Returns error if stock is insufficient
- Shows available vs requested quantity in error message

### ✅ Stock History
- Adds stock history entry when stock is exported
- Records transfer type as `transfer_out`
- Includes notes about destination franchise
- Records negative quantity for stock reduction

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
        "fromFranchise": "Store B",
        "toFranchise": "Warehouse A",
        "status": "completed",
        "totalValue": 500.00,
        "remainingStock": 40
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
        "fromFranchise": "Store B",
        "toFranchise": "Warehouse A",
        "status": "completed",
        "totalValue": 500.00,
        "remainingStock": 40
      }
    ],
    "errors": [
      {
        "index": 1,
        "message": "Insufficient stock. Available: 3, Requested: 5"
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

### Single Stock Export:
```typescript
const exportStock = async () => {
  const response = await fetch('/api/transfers/export', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      productId: '507f1f77bcf86cd799439011',
      quantity: 10,
      cost: 50.00,
      fromFranchise: '507f1f77bcf86cd799439013',
      toFranchise: '507f1f77bcf86cd799439012',
      date: '2024-01-15T10:00:00Z',
      status: 'completed',
      notes: 'Stock sent to warehouse',
    }),
  });

  const result = await response.json();
  console.log(result);
};
```

### Bulk Stock Export:
```typescript
const exportBulkStock = async () => {
  const transfers = [
    {
      productId: '507f1f77bcf86cd799439011',
      quantity: 10,
      cost: 50.00,
      fromFranchise: '507f1f77bcf86cd799439013',
      toFranchise: '507f1f77bcf86cd799439012',
      status: 'completed',
    },
    {
      productId: '507f1f77bcf86cd799439014',
      quantity: 5,
      cost: 75.00,
      fromFranchise: '507f1f77bcf86cd799439013',
      toFranchise: '507f1f77bcf86cd799439012',
      status: 'completed',
    },
  ];

  const response = await fetch('/api/transfers/export', {
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
- User must have access to `fromFranchise` (sending franchise)
- Non-admin users can only export from their assigned franchises
- Admin users can export from any franchise

### Product Validation:
- Product must exist in database
- Product must belong to source franchise (`fromFranchise`)
- Product must have sufficient stock (`stockQuantity >= quantity`)

## Stock Reduction Logic

### When Status is 'completed':
1. **Validate Stock Availability**:
   - Checks if `product.stockQuantity >= quantity`
   - Returns error if insufficient stock

2. **Reduce Stock**:
   - Decreases `stockQuantity` by exported quantity
   - Uses MongoDB `$inc` operator: `{ $inc: { stockQuantity: -qty } }`

3. **Stock History Entry**:
   - Date: Transfer date
   - Quantity: Negative value (-qty) for stock out
   - Type: `transfer_out`
   - Note: "Stock exported to {toFranchise name}"
   - Franchise: Source franchise

## Error Handling

### Common Errors:
1. **Missing Fields**: "Missing required fields: productId, quantity, cost, fromFranchise, toFranchise are required"
2. **Invalid ObjectId**: "Invalid productId" / "Invalid fromFranchise" / "Invalid toFranchise"
3. **Invalid Quantity**: "Quantity must be a number >= 1"
4. **Invalid Cost**: "Cost must be a number >= 0"
5. **Franchise Not Found**: "From franchise not found" / "To franchise not found"
6. **Access Denied**: "Access denied to sending franchise"
7. **Product Not Found**: "Product not found"
8. **Product Mismatch**: "Product does not belong to the source franchise"
9. **Insufficient Stock**: "Insufficient stock. Available: X, Requested: Y"
10. **Invalid Status**: "Status must be one of: pending, approved, rejected, in_transit, completed, cancelled"

## Database Impact

### Collections Modified:
- **transfers**: New transfer records created
- **products**: Stock reduced in source franchise

### Indexes Used:
- `transfers.fromFranchise` (for franchise filtering)
- `transfers.toFranchise` (for franchise filtering)
- `products._id` (for product lookup and update)
- `products.franchise` (for franchise validation)

## Security

- **Authentication Required**: All endpoints require authentication
- **Franchise Access Control**: Users can only export stock from their assigned franchises (unless admin)
- **Input Validation**: All fields are validated before processing
- **Stock Validation**: Prevents exporting more stock than available

## Use Cases

1. **Warehouse Returns**: Send stock back to central warehouse
2. **Inter-Franchise Transfer**: Send stock to another franchise
3. **Bulk Export**: Export multiple products at once
4. **Stock Adjustment**: Use to reduce stock levels (with appropriate notes)
5. **Historical Records**: Export stock with custom dates for historical records

## Differences from Stock Import

| Feature | Stock Import (`importStock`) | Stock Export (`exportStock`) |
|---------|----------------------------|----------------------------|
| **Stock Change** | Increases stock | Decreases stock |
| **Franchise** | Updates destination franchise | Updates source franchise |
| **Product Creation** | Creates product if not exists | Requires product to exist |
| **Stock Check** | No stock check needed | Validates stock availability |
| **History Type** | `transfer_in` | `transfer_out` |
| **History Quantity** | Positive (+qty) | Negative (-qty) |
| **Use Case** | Receiving goods | Sending goods |

## Future Enhancements

1. **Excel Export**: Support Excel file uploads for bulk exports
2. **Stock Reservation**: Reserve stock before export
3. **Batch Processing**: Optimize bulk exports with database transactions
4. **Validation Rules**: Custom validation rules per franchise
5. **Notifications**: Notify relevant parties when stock is exported
6. **Reporting**: Generate export reports and analytics
7. **Cost Tracking**: Track cost variations over time
8. **Reverse Export**: Ability to reverse/cancel exports

## Testing Checklist

- [ ] Export single stock item
- [ ] Export bulk stock items
- [ ] Test with missing required fields
- [ ] Test with invalid ObjectIds
- [ ] Test with invalid quantity (< 1)
- [ ] Test with invalid cost (< 0)
- [ ] Test with non-existent franchises
- [ ] Test with non-existent product
- [ ] Test franchise access control
- [ ] Test product franchise mismatch
- [ ] Test insufficient stock scenario
- [ ] Test stock reduction when status is 'completed'
- [ ] Test stock history entry creation
- [ ] Test with different status values
- [ ] Test with custom date
- [ ] Test with notes
- [ ] Verify transfer record creation
- [ ] Verify total value calculation
- [ ] Verify remaining stock in response
- [ ] Test that stock cannot go negative
