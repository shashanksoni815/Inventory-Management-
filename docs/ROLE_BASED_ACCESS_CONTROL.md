# Role-Based Access Control (RBAC) Implementation

## Overview

This document describes the role-based access control system implemented for export functionality and franchise access across the inventory management system.

## Roles

### 1. Admin / SuperAdmin
- **Access Level**: Full access to all franchises
- **Permissions**:
  - Can export products from any franchise
  - Can export sales from any franchise
  - Can export P&L reports from any franchise
  - Can view all franchise data
  - No access restrictions

### 2. Franchise Manager
- **Access Level**: Limited to assigned franchise(s) only
- **Permissions**:
  - Can only export products from their assigned franchise(s)
  - Can only export sales from their assigned franchise(s)
  - Can only export P&L reports from their assigned franchise(s)
  - Cannot access data from other franchises
  - Must have at least one franchise assigned to their account

## Implementation Details

### User Model

The `User` model includes:
- `role`: Enum ['superAdmin', 'admin', 'franchise_manager']
- `franchises`: Array of ObjectIds referencing Franchise documents

```javascript
{
  role: 'franchise_manager',
  franchises: [ObjectId('...'), ObjectId('...')]
}
```

### Access Control Middleware

**File**: `server/middleware/franchiseAccess.middleware.js`

Provides helper functions:
- `hasFranchiseAccess(user, franchiseId)`: Check if user has access to a franchise
- `checkFranchiseAccess(req, res, next)`: Middleware to validate franchise access
- `requireFranchiseAccess(franchiseParamName)`: Create middleware for specific franchise parameter
- `getFranchiseFilter(user)`: Generate MongoDB query filter based on user role

### Export Endpoints Access Control

#### 1. Product Export (`GET /api/products/export`)

**Access Rules**:
- **Admin/SuperAdmin**: Can export from any franchise or all franchises
- **Franchise Manager**: 
  - If `franchise` parameter provided: Must be in user's `franchises` array
  - If no `franchise` parameter: Exports filtered to user's assigned franchises only
  - Returns 403 if attempting to access unauthorized franchise

**Implementation**:
```javascript
// Check franchise access
if (franchise && franchise !== 'all') {
  if (user.role === 'franchise_manager') {
    if (!user.franchises.some(f => f.toString() === franchise.toString())) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You do not have access to this franchise',
      });
    }
  }
}
```

#### 2. Sales Export (`GET /api/sales/export`)

**Access Rules**:
- **Admin/SuperAdmin**: Can export sales from any franchise
- **Franchise Manager**:
  - If `franchise` parameter provided: Must be in user's `franchises` array
  - If no `franchise` parameter: Exports filtered to user's assigned franchises only
  - Returns 403 if attempting to access unauthorized franchise

**Implementation**:
```javascript
// Check franchise access
if (franchise) {
  if (user.role === 'franchise_manager') {
    if (!user.franchises.some(f => f.toString() === franchise.toString())) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You do not have access to this franchise',
      });
    }
  }
}
```

#### 3. Profit & Loss Export (`GET /api/reports/profit-loss`)

**Access Rules**:
- **Admin/SuperAdmin**: Can export P&L from any franchise
- **Franchise Manager**:
  - If `franchise` parameter provided: Must be in user's `franchises` array
  - If no `franchise` parameter: Must have at least one franchise assigned
  - Returns 403 if attempting to access unauthorized franchise

**Implementation**:
```javascript
// Check franchise access
if (franchise) {
  if (user.role === 'franchise_manager') {
    const userFranchises = (user.franchises || []).map(f => f.toString());
    if (!userFranchises.includes(franchise.toString())) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You do not have access to this franchise',
      });
    }
  }
}
```

### Frontend Error Handling

All export functions handle 403 (Forbidden) errors gracefully:

```typescript
if (!response.ok) {
  if (response.status === 403) {
    const errorData = await response.json().catch(() => ({}));
    alert(errorData.message || 'Access denied: You do not have permission...');
    return;
  }
  throw new Error('Export failed');
}
```

## Security Features

### 1. Server-Side Validation
- All access checks are performed on the server
- Frontend cannot bypass access control
- Franchise IDs are validated before processing

### 2. Query Filtering
- Franchise managers' queries are automatically filtered to their franchises
- Admin queries return all data
- No data leakage between franchises

### 3. Error Messages
- Clear error messages for unauthorized access
- No sensitive information leaked in error responses
- Consistent error format across all endpoints

## Usage Examples

### Admin Exporting All Products
```javascript
GET /api/products/export?format=excel
// Returns: All products from all franchises
```

### Franchise Manager Exporting Their Products
```javascript
GET /api/products/export?format=excel
// Returns: Only products from user's assigned franchises
```

### Franchise Manager Attempting Unauthorized Access
```javascript
GET /api/products/export?franchise=507f1f77bcf86cd799439011&format=excel
// Returns: 403 Forbidden
// Message: "Access denied: You do not have access to this franchise"
```

### Admin Exporting Specific Franchise
```javascript
GET /api/sales/export?franchise=507f1f77bcf86cd799439011&format=excel
// Returns: Sales from specified franchise (admin has access)
```

## Testing Scenarios

### Test Case 1: Franchise Manager Accessing Own Franchise
1. User with role `franchise_manager` and `franchises: [ObjectId('A')]`
2. Request: `GET /api/products/export?franchise=A`
3. Expected: Success (200) - Products exported

### Test Case 2: Franchise Manager Accessing Other Franchise
1. User with role `franchise_manager` and `franchises: [ObjectId('A')]`
2. Request: `GET /api/products/export?franchise=B`
3. Expected: 403 Forbidden - Access denied

### Test Case 3: Admin Accessing Any Franchise
1. User with role `admin`
2. Request: `GET /api/products/export?franchise=ANY_ID`
3. Expected: Success (200) - Products exported

### Test Case 4: Franchise Manager Without Franchises
1. User with role `franchise_manager` and `franchises: []`
2. Request: `GET /api/products/export`
3. Expected: 403 Forbidden - No franchises assigned

## Best Practices

1. **Always validate on server**: Never trust client-side checks
2. **Use consistent error messages**: Helps with debugging and user experience
3. **Log access attempts**: Consider logging unauthorized access attempts for security monitoring
4. **Test all roles**: Ensure both admin and franchise manager scenarios work correctly
5. **Handle edge cases**: Empty franchises array, invalid franchise IDs, etc.

## Future Enhancements

1. **Audit Logging**: Log all export attempts with user ID, franchise ID, timestamp
2. **Rate Limiting**: Limit export frequency per user/franchise
3. **Export Permissions**: Granular permissions (e.g., can export products but not sales)
4. **Multi-Franchise Support**: Allow franchise managers to manage multiple franchises with different permissions
5. **IP Whitelisting**: Restrict exports to specific IP addresses for sensitive data
