# Franchise Dashboard - Sales & Product Overview Implementation (STEP 9)

## Overview
Implemented comprehensive franchise dashboard endpoint that displays total sales, revenue, profit, product-wise performance, fast-moving products, and low-stock products. All data is filtered by franchiseId.

## Implementation Details

### 1. Controller (`server/controllers/franchise.controller.js`)
**Function**: `getFranchiseDashboard`

**Features**:
- Total sales count
- Total revenue
- Total profit
- Average order value
- Product-wise performance (top 20 products)
- Fast-moving products (top 10)
- Low-stock products
- Total products count
- Inventory value
- Date range filtering support

### 2. Route (`server/routes/franchise.routes.js`)
- **Endpoint**: `GET /api/franchises/:franchiseId/dashboard`
- **Middleware**: `authMiddleware` (applied to all franchise routes)
- **Position**: Placed before `/:id` route to avoid conflicts

## API Endpoint

```
GET /api/franchises/:franchiseId/dashboard?startDate=...&endDate=...&period=...
```

## Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `franchiseId` | ObjectId | ✅ | Franchise ID (URL parameter) |
| `startDate` | Date | ❌ | Start date for date range filter (ISO format) |
| `endDate` | Date | ❌ | End date for date range filter (ISO format) |
| `period` | String | ❌ | Predefined period: `7d`, `30d`, `90d`, `1y`, `all` (default: `30d`) |

**Note**: If `startDate` and `endDate` are provided, they override `period`. Otherwise, `period` is used.

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
    "period": {
      "startDate": "2024-01-01T00:00:00Z",
      "endDate": "2024-01-31T23:59:59Z",
      "period": "30d"
    },
    "sales": {
      "totalSales": 150,
      "totalRevenue": 75000.00,
      "totalProfit": 25000.00,
      "avgOrderValue": 500.00
    },
    "products": {
      "totalProducts": 200,
      "inventoryValue": 50000.00
    },
    "productPerformance": [
      {
        "productId": "507f1f77bcf86cd799439012",
        "productName": "Laptop",
        "productSku": "LAP001",
        "revenue": 12000.00,
        "cost": 8000.00,
        "profit": 4000.00,
        "quantitySold": 20,
        "saleCount": 15,
        "marginPercent": 33.33
      }
    ],
    "fastMovingProducts": [
      {
        "productId": "507f1f77bcf86cd799439012",
        "productName": "Laptop",
        "productSku": "LAP001",
        "quantitySold": 50,
        "saleCount": 30,
        "revenue": 30000.00,
        "lastSold": "2024-01-31T10:00:00Z",
        "velocityScore": 42.00
      }
    ],
    "lowStockProducts": [
      {
        "productId": "507f1f77bcf86cd799439013",
        "sku": "MOU001",
        "name": "Mouse",
        "category": "Electronics",
        "stockQuantity": 5,
        "minimumStock": 10,
        "buyingPrice": 10.00,
        "sellingPrice": 25.00,
        "inventoryValue": 50.00,
        "lastSold": "2024-01-15T10:00:00Z",
        "stockStatus": "low-stock"
      }
    ]
  }
}
```

## Features

### ✅ Sales Statistics
- **Total Sales**: Count of completed sales
- **Total Revenue**: Sum of all `grandTotal` values
- **Total Profit**: Sum of all `totalProfit` values
- **Average Order Value**: Average of `grandTotal` values

### ✅ Product Statistics
- **Total Products**: Count of active products in franchise
- **Inventory Value**: Total value of inventory (stockQuantity × buyingPrice)

### ✅ Product Performance
- Top 20 products by revenue
- For each product:
  - Revenue, Cost, Profit
  - Quantity sold
  - Sale count (number of times sold)
  - Margin percentage

### ✅ Fast-Moving Products
- Top 10 products by velocity score
- Velocity score calculation:
  - `(quantitySold × 0.6) + (saleCount × 0.4)`
  - Weights quantity more than frequency
- Includes:
  - Quantity sold
  - Sale count
  - Revenue
  - Last sold date

### ✅ Low-Stock Products
- Products with stock <= minimum stock threshold
- Up to 20 products sorted by stock quantity (ascending)
- Includes:
  - Stock quantity and minimum stock
  - Inventory value
  - Stock status (low-stock or out-of-stock)
  - Last sold date

## Data Filtering

### Franchise Filtering
- **Sales**: Filtered by `franchise` field
- **Products**: Includes:
  - Products belonging to franchise
  - Global products shared with franchise
  - Global products owned by franchise

### Date Filtering
- **Period Options**:
  - `7d`: Last 7 days
  - `30d`: Last 30 days (default)
  - `90d`: Last 90 days
  - `1y`: Last 1 year
  - `all`: All time (no date filter)
- **Custom Date Range**: Use `startDate` and `endDate` parameters

## Usage Examples

### Get Dashboard for Last 30 Days (Default):
```typescript
const getDashboard = async (franchiseId: string) => {
  const response = await fetch(`/api/franchises/${franchiseId}/dashboard`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  const result = await response.json();
  return result.data;
};
```

### Get Dashboard for Custom Period:
```typescript
const getDashboardByPeriod = async (
  franchiseId: string,
  period: '7d' | '30d' | '90d' | '1y' | 'all'
) => {
  const params = new URLSearchParams({ period });
  const response = await fetch(
    `/api/franchises/${franchiseId}/dashboard?${params.toString()}`,
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

### Get Dashboard for Date Range:
```typescript
const getDashboardByDateRange = async (
  franchiseId: string,
  startDate: string,
  endDate: string
) => {
  const params = new URLSearchParams({
    startDate,
    endDate,
  });
  const response = await fetch(
    `/api/franchises/${franchiseId}/dashboard?${params.toString()}`,
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

### Sales Aggregation
Uses MongoDB aggregation to calculate:
- Total sales count
- Total revenue (sum of grandTotal)
- Total profit (sum of totalProfit)
- Average order value

### Product Performance Aggregation
Groups sales by product and calculates:
- Revenue per product
- Cost per product
- Profit per product
- Quantity sold
- Sale count
- Margin percentage

### Fast-Moving Products Calculation
- Groups sales by product
- Calculates velocity score: `(quantitySold × 0.6) + (saleCount × 0.4)`
- Sorts by velocity score descending
- Returns top 10 products

### Low-Stock Products Query
- Finds products where `stockQuantity <= minimumStock` (or reorderPoint)
- Sorts by stock quantity (ascending)
- Limits to 20 products
- Includes stock status calculation

### Inventory Value Calculation
- Handles franchise-specific stock (including shared products)
- Calculates value: `stockQuantity × buyingPrice`
- Sums all product values

## Security

- **Authentication Required**: All endpoints require authentication
- **Franchise Access Control**: Users can only view dashboards for their assigned franchises (unless admin)
- **Input Validation**: Franchise ID and query parameters are validated

## Performance Considerations

- **Aggregation Pipelines**: Uses efficient MongoDB aggregations
- **Indexes**: Leverages existing indexes on `franchise`, `createdAt`, `status`
- **Parallel Queries**: Uses `Promise.all` where possible
- **Limits**: Limits results (top 20 products, top 10 fast-moving, 20 low-stock)

## Frontend Integration Example

```typescript
// React component example
const FranchiseDashboard = ({ franchiseId }: { franchiseId: string }) => {
  const [dashboardData, setDashboardData] = useState(null);
  const [period, setPeriod] = useState('30d');

  useEffect(() => {
    const fetchDashboard = async () => {
      const params = new URLSearchParams({ period });
      const response = await fetch(
        `/api/franchises/${franchiseId}/dashboard?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );
      const result = await response.json();
      setDashboardData(result.data);
    };

    fetchDashboard();
  }, [franchiseId, period]);

  if (!dashboardData) return <div>Loading...</div>;

  return (
    <div>
      <h2>{dashboardData.franchise.name} Dashboard</h2>
      
      {/* Period Selector */}
      <select value={period} onChange={(e) => setPeriod(e.target.value)}>
        <option value="7d">Last 7 Days</option>
        <option value="30d">Last 30 Days</option>
        <option value="90d">Last 90 Days</option>
        <option value="1y">Last Year</option>
        <option value="all">All Time</option>
      </select>

      {/* Sales KPIs */}
      <div className="kpi-cards">
        <div className="kpi-card">
          <h3>Total Sales</h3>
          <p>{dashboardData.sales.totalSales}</p>
        </div>
        <div className="kpi-card">
          <h3>Total Revenue</h3>
          <p>${dashboardData.sales.totalRevenue.toFixed(2)}</p>
        </div>
        <div className="kpi-card">
          <h3>Total Profit</h3>
          <p>${dashboardData.sales.totalProfit.toFixed(2)}</p>
        </div>
        <div className="kpi-card">
          <h3>Avg Order Value</h3>
          <p>${dashboardData.sales.avgOrderValue.toFixed(2)}</p>
        </div>
      </div>

      {/* Product Performance Table */}
      <div className="section">
        <h3>Top Products by Revenue</h3>
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Revenue</th>
              <th>Profit</th>
              <th>Quantity Sold</th>
              <th>Margin %</th>
            </tr>
          </thead>
          <tbody>
            {dashboardData.productPerformance.map((product) => (
              <tr key={product.productId}>
                <td>{product.productName}</td>
                <td>${product.revenue.toFixed(2)}</td>
                <td>${product.profit.toFixed(2)}</td>
                <td>{product.quantitySold}</td>
                <td>{product.marginPercent}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Fast-Moving Products */}
      <div className="section">
        <h3>Fast-Moving Products</h3>
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Quantity Sold</th>
              <th>Sale Count</th>
              <th>Revenue</th>
              <th>Last Sold</th>
            </tr>
          </thead>
          <tbody>
            {dashboardData.fastMovingProducts.map((product) => (
              <tr key={product.productId}>
                <td>{product.productName}</td>
                <td>{product.quantitySold}</td>
                <td>{product.saleCount}</td>
                <td>${product.revenue.toFixed(2)}</td>
                <td>{new Date(product.lastSold).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Low-Stock Products */}
      <div className="section">
        <h3>Low-Stock Products</h3>
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Stock</th>
              <th>Min Stock</th>
              <th>Status</th>
              <th>Last Sold</th>
            </tr>
          </thead>
          <tbody>
            {dashboardData.lowStockProducts.map((product) => (
              <tr key={product.productId}>
                <td>{product.name}</td>
                <td>{product.stockQuantity}</td>
                <td>{product.minimumStock}</td>
                <td>{product.stockStatus}</td>
                <td>
                  {product.lastSold
                    ? new Date(product.lastSold).toLocaleDateString()
                    : 'Never'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
```

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

## Future Enhancements

1. **Caching**: Add caching for dashboard data (30-60 seconds)
2. **Real-time Updates**: WebSocket support for live updates
3. **Export**: Add export functionality for dashboard data
4. **Charts**: Add visualizations for trends
5. **Comparisons**: Compare with previous periods
6. **Alerts**: Highlight significant changes
7. **Custom Metrics**: Allow custom KPI definitions
8. **Drill-down**: Click on metrics to see details

## Testing Checklist

- [ ] Get dashboard for valid franchise
- [ ] Test with invalid franchise ID
- [ ] Test access control (non-admin user)
- [ ] Test period filter (7d, 30d, 90d, 1y, all)
- [ ] Test custom date range filter
- [ ] Verify sales statistics accuracy
- [ ] Verify product performance data
- [ ] Verify fast-moving products calculation
- [ ] Verify low-stock products list
- [ ] Test with no sales data
- [ ] Test with no products
- [ ] Verify franchise filtering
- [ ] Test with shared products
- [ ] Verify inventory value calculation
