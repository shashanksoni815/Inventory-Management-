# Franchise Dashboard - Import & Export View Implementation (STEP 8)

## Overview
Implemented franchise imports/exports view endpoint that displays total imports and exports statistics along with transfer history table, with filtering capabilities.

## Implementation Details

### 1. Controller (`server/controllers/franchise.controller.js`)
**Function**: `getFranchiseImportsExports`

**Features**:
- Calculates total imports (count, quantity, value)
- Calculates total exports (count, quantity, value)
- Returns transfer history table with pagination
- Supports filtering by date range, product, status, and type
- Identifies transfer type (import/export) for each record

### 2. Route (`server/routes/franchise.routes.js`)
- **Endpoint**: `GET /api/franchises/:franchiseId/imports`
- **Middleware**: `authMiddleware` (applied to all franchise routes)
- **Position**: Placed before `/:id` route to avoid conflicts

## API Endpoint

```
GET /api/franchises/:franchiseId/imports?startDate=...&endDate=...&productId=...&status=...&type=...&page=...&limit=...
```

## Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `franchiseId` | ObjectId | ✅ | Franchise ID (URL parameter) |
| `startDate` | Date | ❌ | Start date for date range filter (ISO format) |
| `endDate` | Date | ❌ | End date for date range filter (ISO format) |
| `productId` | ObjectId | ❌ | Filter by specific product ID |
| `status` | String | ❌ | Filter by transfer status (pending, approved, rejected, in_transit, completed, cancelled) |
| `type` | String | ❌ | Filter by type: `import`, `export`, or `all` (default: all) |
| `page` | Number | ❌ | Page number for pagination (default: 1) |
| `limit` | Number | ❌ | Items per page (default: 20) |

## Response Format

```json
{
  "success": true,
  "data": {
    "franchise": {
      "_id": "507f1f77bcf86cd799439011",
      "name": "Store A",
      "code": "STORE-A"
    },
    "summary": {
      "imports": {
        "count": 25,
        "totalQuantity": 150,
        "totalValue": 7500.00
      },
      "exports": {
        "count": 10,
        "totalQuantity": 50,
        "totalValue": 2500.00
      }
    },
    "transfers": [
      {
        "_id": "507f1f77bcf86cd799439015",
        "transferId": "507f1f77bcf86cd799439015",
        "type": "import",
        "productId": "507f1f77bcf86cd799439012",
        "productName": "Laptop",
        "productSku": "LAP001",
        "quantity": 10,
        "unitPrice": 50.00,
        "totalValue": 500.00,
        "fromFranchise": {
          "_id": "507f1f77bcf86cd799439013",
          "name": "Warehouse",
          "code": "WH-001"
        },
        "toFranchise": {
          "_id": "507f1f77bcf86cd799439011",
          "name": "Store A",
          "code": "STORE-A"
        },
        "status": "completed",
        "transferDate": "2024-01-15T10:00:00Z",
        "actualDelivery": "2024-01-15T10:00:00Z",
        "initiatedBy": "john.doe",
        "approvedBy": "jane.smith",
        "notes": "Stock imported from warehouse",
        "createdAt": "2024-01-15T10:00:00Z",
        "updatedAt": "2024-01-15T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 35,
      "pages": 2
    }
  }
}
```

## Features

### ✅ Summary Statistics
- **Total Imports**:
  - Count: Number of import transfers
  - Total Quantity: Sum of all imported quantities
  - Total Value: Sum of all import values
  
- **Total Exports**:
  - Count: Number of export transfers
  - Total Quantity: Sum of all exported quantities
  - Total Value: Sum of all export values

### ✅ Transfer History Table
- Lists all transfers (imports and exports) for the franchise
- Each transfer includes:
  - Transfer ID
  - Type (import/export)
  - Product details (ID, name, SKU)
  - Quantity and pricing
  - Source and destination franchises
  - Status and dates
  - User information (initiated by, approved by)
  - Notes

### ✅ Filtering
- **Date Range**: Filter transfers by `transferDate`
- **Product**: Filter by specific product ID
- **Status**: Filter by transfer status
- **Type**: Filter by import, export, or show all

### ✅ Pagination
- Supports pagination with `page` and `limit` parameters
- Returns pagination metadata (total, pages)

## Usage Examples

### Get All Imports/Exports:
```typescript
const getImportsExports = async (franchiseId: string) => {
  const response = await fetch(`/api/franchises/${franchiseId}/imports`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  const result = await response.json();
  return result.data;
};
```

### Filter by Date Range:
```typescript
const getImportsExportsByDate = async (
  franchiseId: string,
  startDate: string,
  endDate: string
) => {
  const params = new URLSearchParams({
    startDate,
    endDate,
  });
  const response = await fetch(
    `/api/franchises/${franchiseId}/imports?${params.toString()}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );
  const result = await response.json();
  return result.data;
};
```

### Filter by Product:
```typescript
const getImportsExportsByProduct = async (
  franchiseId: string,
  productId: string
) => {
  const params = new URLSearchParams({ productId });
  const response = await fetch(
    `/api/franchises/${franchiseId}/imports?${params.toString()}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );
  const result = await response.json();
  return result.data;
};
```

### Filter by Type (Imports Only):
```typescript
const getImportsOnly = async (franchiseId: string) => {
  const params = new URLSearchParams({ type: 'import' });
  const response = await fetch(
    `/api/franchises/${franchiseId}/imports?${params.toString()}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );
  const result = await response.json();
  return result.data;
};
```

### Paginated Results:
```typescript
const getImportsExportsPaginated = async (
  franchiseId: string,
  page: number = 1,
  limit: number = 20
) => {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });
  const response = await fetch(
    `/api/franchises/${franchiseId}/imports?${params.toString()}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );
  const result = await response.json();
  return result.data;
};
```

## Data Processing

### Transfer Type Identification
- **Import**: `transfer.toFranchise._id === franchiseId`
- **Export**: `transfer.fromFranchise._id === franchiseId`

### Aggregation Pipeline
Uses MongoDB `$facet` to calculate imports and exports totals in parallel:
```javascript
{
  $facet: {
    imports: [
      { $match: { toFranchise: franchiseId } },
      { $group: { count, totalQuantity, totalValue } }
    ],
    exports: [
      { $match: { fromFranchise: franchiseId } },
      { $group: { count, totalQuantity, totalValue } }
    ]
  }
}
```

### Value Calculation
- Uses `totalValue` field if available
- Otherwise calculates: `unitPrice × quantity`

## Security

- **Authentication Required**: All endpoints require authentication
- **Franchise Access Control**: Users can only view imports/exports for their assigned franchises (unless admin)
- **Input Validation**: Franchise ID and query parameters are validated

## Error Handling

### Invalid Franchise ID:
```json
{
  "success": false,
  "message": "Invalid franchise ID"
}
```

### Access Denied:
```json
{
  "success": false,
  "message": "Access denied to this franchise"
}
```

### Franchise Not Found:
```json
{
  "success": false,
  "message": "Franchise not found"
}
```

## Frontend Integration Example

```typescript
// React component example
const FranchiseImportsExports = ({ franchiseId }: { franchiseId: string }) => {
  const [data, setData] = useState(null);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    productId: '',
    status: '',
    type: 'all',
    page: 1,
    limit: 20,
  });

  useEffect(() => {
    const fetchData = async () => {
      const params = new URLSearchParams();
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.productId) params.append('productId', filters.productId);
      if (filters.status) params.append('status', filters.status);
      if (filters.type !== 'all') params.append('type', filters.type);
      params.append('page', filters.page.toString());
      params.append('limit', filters.limit.toString());

      const response = await fetch(
        `/api/franchises/${franchiseId}/imports?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );
      const result = await response.json();
      setData(result.data);
    };

    fetchData();
  }, [franchiseId, filters]);

  if (!data) return <div>Loading...</div>;

  return (
    <div>
      <h2>Imports & Exports</h2>
      
      {/* Summary Cards */}
      <div className="summary-cards">
        <div className="card">
          <h3>Total Imports</h3>
          <p>Count: {data.summary.imports.count}</p>
          <p>Quantity: {data.summary.imports.totalQuantity}</p>
          <p>Value: ${data.summary.imports.totalValue.toFixed(2)}</p>
        </div>
        <div className="card">
          <h3>Total Exports</h3>
          <p>Count: {data.summary.exports.count}</p>
          <p>Quantity: {data.summary.exports.totalQuantity}</p>
          <p>Value: ${data.summary.exports.totalValue.toFixed(2)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="filters">
        <input
          type="date"
          value={filters.startDate}
          onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
          placeholder="Start Date"
        />
        <input
          type="date"
          value={filters.endDate}
          onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
          placeholder="End Date"
        />
        <select
          value={filters.type}
          onChange={(e) => setFilters({ ...filters, type: e.target.value })}
        >
          <option value="all">All</option>
          <option value="import">Imports</option>
          <option value="export">Exports</option>
        </select>
      </div>

      {/* Transfer History Table */}
      <table>
        <thead>
          <tr>
            <th>Type</th>
            <th>Product</th>
            <th>Quantity</th>
            <th>Value</th>
            <th>From/To</th>
            <th>Status</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {data.transfers.map((transfer) => (
            <tr key={transfer.transferId}>
              <td>{transfer.type}</td>
              <td>{transfer.productName}</td>
              <td>{transfer.quantity}</td>
              <td>${transfer.totalValue.toFixed(2)}</td>
              <td>
                {transfer.type === 'import'
                  ? transfer.fromFranchise.name
                  : transfer.toFranchise.name}
              </td>
              <td>{transfer.status}</td>
              <td>{new Date(transfer.transferDate).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Pagination */}
      <div className="pagination">
        <button
          disabled={filters.page === 1}
          onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
        >
          Previous
        </button>
        <span>
          Page {data.pagination.page} of {data.pagination.pages}
        </span>
        <button
          disabled={filters.page >= data.pagination.pages}
          onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
        >
          Next
        </button>
      </div>
    </div>
  );
};
```

## Performance Considerations

- **Aggregation**: Uses `$facet` for parallel calculation of imports/exports totals
- **Indexes**: Leverages existing indexes on `toFranchise`, `fromFranchise`, `transferDate`, `product`
- **Pagination**: Limits results to prevent large data transfers
- **Population**: Efficiently populates related documents (product, franchises, users)

## Future Enhancements

1. **Export to Excel/PDF**: Add export functionality for transfer history
2. **Advanced Filters**: Add filters for value range, quantity range
3. **Sorting**: Add sorting options (by date, value, quantity)
4. **Charts**: Add visualizations for imports/exports trends
5. **Summary by Period**: Group statistics by day/week/month
6. **Product-wise Summary**: Aggregate statistics by product
7. **Status Breakdown**: Show counts by status
8. **Real-time Updates**: WebSocket support for live updates

## Testing Checklist

- [ ] Get imports/exports for valid franchise
- [ ] Test with invalid franchise ID
- [ ] Test access control (non-admin user)
- [ ] Test date range filter
- [ ] Test product filter
- [ ] Test status filter
- [ ] Test type filter (import, export, all)
- [ ] Test pagination
- [ ] Verify summary calculations
- [ ] Verify transfer type identification
- [ ] Test with no transfers
- [ ] Test with large dataset
- [ ] Verify populated fields (product, franchises, users)
