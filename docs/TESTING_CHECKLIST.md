# Role-Based Authentication & Authorization Testing Checklist

## Prerequisites

1. Create test users for each role:
   - Admin user (role: `admin`, no franchise required)
   - Manager user (role: `manager`, franchise required)
   - Sales user (role: `sales`, franchise required)

2. Ensure test franchise exists in database

3. Have API testing tool ready (Postman, curl, or browser DevTools)

---

## ✅ Test 1: Admin Access - Can Access Everything

### Test Cases:

#### 1.1 Admin Dashboard Access
- [ ] **Action**: Login as admin user
- [ ] **Expected**: Can access `/dashboard` (Admin Dashboard)
- [ ] **Verify**: Dashboard shows global metrics across all franchises
- [ ] **Route**: `GET /api/dashboard/admin` should return 200

#### 1.2 Admin Routes Access
- [ ] **Action**: Access admin-only routes
- [ ] **Expected**: All admin routes accessible:
  - `/api/dashboard/admin` ✅
  - `/api/franchises/admin/kpis` ✅
  - `/api/franchises/admin/charts` ✅
  - `/api/franchises/admin/performance` ✅
  - `/api/franchises/admin/insights` ✅
  - `/api/franchises` (POST, PUT) ✅
  - `/api/transfers/admin/overview` ✅

#### 1.3 Admin Can See All Data
- [ ] **Action**: Query products, sales, orders as admin
- [ ] **Expected**: Can see data from ALL franchises (no franchise filter applied)
- [ ] **Verify**: 
  - `GET /api/products?franchise=all` returns all products
  - `GET /api/sales` returns sales from all franchises
  - `GET /api/orders` returns orders from all franchises

#### 1.4 Admin Can Manage Everything
- [ ] **Action**: Perform CRUD operations as admin
- [ ] **Expected**: Can create, update, delete:
  - Products ✅
  - Sales (create, refund) ✅
  - Orders (create, update, delete) ✅
  - Reports (generate) ✅
  - Transfers (all operations) ✅

---

## ✅ Test 2: Manager Restrictions

### Test Cases:

#### 2.1 Cannot Access Master Dashboard
- [ ] **Action**: Login as manager user
- [ ] **Action**: Try to access `/dashboard` (Admin Dashboard)
- [ ] **Expected**: 
  - Frontend: Redirects to `/unauthorized`
  - Backend: `GET /api/dashboard/admin` returns 403 Forbidden
- [ ] **Verify**: Error message: "Access denied. Required roles: admin"

#### 2.2 Cannot Access Admin Routes
- [ ] **Action**: Try to access admin-only routes as manager
- [ ] **Expected**: All admin routes return 403:
  - `/api/dashboard/admin` → 403 ✅
  - `/api/franchises/admin/kpis` → 403 ✅
  - `/api/franchises/admin/charts` → 403 ✅
  - `/api/franchises/admin/performance` → 403 ✅
  - `/api/franchises/admin/insights` → 403 ✅
  - `POST /api/franchises` → 403 ✅
  - `PUT /api/franchises/:id` → 403 ✅

#### 2.3 Sees Only Assigned Franchise Data
- [ ] **Action**: Query products as manager
- [ ] **Expected**: Only sees products from their assigned franchise + global products
- [ ] **Verify**: 
  - `GET /api/products` returns only manager's franchise products + global products
  - Cannot see products from other franchises

- [ ] **Action**: Query sales as manager
- [ ] **Expected**: Only sees sales from their assigned franchise
- [ ] **Verify**: 
  - `GET /api/sales` returns only manager's franchise sales
  - Cannot see sales from other franchises

- [ ] **Action**: Query orders as manager
- [ ] **Expected**: Only sees orders from their assigned franchise
- [ ] **Verify**: 
  - `GET /api/orders` returns only manager's franchise orders
  - Cannot see orders from other franchises

#### 2.4 Manager Can Access Manager Routes
- [ ] **Action**: Access manager-allowed routes
- [ ] **Expected**: Can access:
  - `/api/products` (GET, POST, PUT, DELETE) ✅
  - `/api/sales` (GET, POST) ✅
  - `/api/sales/:id/refund` ✅
  - `/api/orders` (GET, POST, PUT, DELETE) ✅
  - `/api/reports` (all report types) ✅
  - `/api/transfers` (all operations) ✅
  - `/api/franchise/:franchiseId/dashboard` (their franchise only) ✅

#### 2.5 Manager Cannot Access Other Franchises
- [ ] **Action**: Try to access another franchise's dashboard
- [ ] **Expected**: 
  - If trying to access different franchise: Should only see their own franchise data
  - Backend filters by `req.user.franchise` automatically
- [ ] **Verify**: Cannot see data from other franchises even if franchise ID is provided

---

## ✅ Test 3: Sales Restrictions

### Test Cases:

#### 3.1 Cannot Access Reports
- [ ] **Action**: Login as sales user
- [ ] **Action**: Try to access `/reports` page
- [ ] **Expected**: 
  - Frontend: Redirects to `/unauthorized`
  - Backend: `GET /api/reports/*` returns 403 Forbidden
- [ ] **Verify**: Error message: "Access denied. Required roles: admin, manager"

#### 3.2 Cannot Delete Data
- [ ] **Action**: Try to delete products as sales user
- [ ] **Expected**: 
  - Frontend: Delete buttons should not be visible (sidebar doesn't show Products)
  - Backend: `DELETE /api/products/:id` returns 403 Forbidden
- [ ] **Verify**: Error message: "Access denied. Required roles: admin, manager"

- [ ] **Action**: Try to delete orders as sales user
- [ ] **Expected**: 
  - Backend: `DELETE /api/orders/:id` returns 403 Forbidden
- [ ] **Verify**: Error message: "Access denied. Required roles: admin, manager"

- [ ] **Action**: Try to refund sales as sales user
- [ ] **Expected**: 
  - Backend: `POST /api/sales/:id/refund` returns 403 Forbidden
- [ ] **Verify**: Error message: "Access denied. Required roles: admin, manager"

#### 3.3 Cannot Create/Update Products
- [ ] **Action**: Try to create product as sales user
- [ ] **Expected**: 
  - Backend: `POST /api/products` returns 403 Forbidden
- [ ] **Verify**: Error message: "Access denied. Required roles: admin, manager"

- [ ] **Action**: Try to update product as sales user
- [ ] **Expected**: 
  - Backend: `PUT /api/products/:id` returns 403 Forbidden
- [ ] **Verify**: Error message: "Access denied. Required roles: admin, manager"

#### 3.4 Cannot Create/Update Orders
- [ ] **Action**: Try to create order as sales user
- [ ] **Expected**: 
  - Backend: `POST /api/orders` returns 403 Forbidden
- [ ] **Verify**: Error message: "Access denied. Required roles: admin, manager"

- [ ] **Action**: Try to update order as sales user
- [ ] **Expected**: 
  - Backend: `PUT /api/orders/:id` returns 403 Forbidden
- [ ] **Verify**: Error message: "Access denied. Required roles: admin, manager"

#### 3.5 Sales Can View Data
- [ ] **Action**: View products, sales, orders as sales user
- [ ] **Expected**: Can view (read-only):
  - `GET /api/products` ✅ (view only)
  - `GET /api/sales` ✅ (view only)
  - `GET /api/sales/:id` ✅ (view only)
  - `GET /api/orders` ✅ (view only)
  - `GET /api/orders/:id` ✅ (view only)
  - `POST /api/sales` ✅ (can create sales)

#### 3.6 Sales Sees Only Assigned Franchise Data
- [ ] **Action**: Query products, sales, orders as sales user
- [ ] **Expected**: Only sees data from their assigned franchise
- [ ] **Verify**: 
  - `GET /api/products` returns only sales user's franchise products + global products
  - `GET /api/sales` returns only sales user's franchise sales
  - `GET /api/orders` returns only sales user's franchise orders

---

## ✅ Test 4: Token Removal → Redirect to Login

### Test Cases:

#### 4.1 Remove Token from localStorage
- [ ] **Action**: Login as any user
- [ ] **Action**: Open browser DevTools → Application → Local Storage
- [ ] **Action**: Delete `token` key from localStorage
- [ ] **Action**: Try to navigate to any protected route
- [ ] **Expected**: 
  - Frontend: Redirects to `/login`
  - Backend: API calls return 401 Unauthorized
- [ ] **Verify**: User is logged out and redirected to login page

#### 4.2 Remove User from localStorage
- [ ] **Action**: Login as any user
- [ ] **Action**: Delete `user` key from localStorage
- [ ] **Action**: Try to navigate to any protected route
- [ ] **Expected**: 
  - Frontend: Redirects to `/login`
  - AuthContext: `isAuthenticated` becomes `false`
- [ ] **Verify**: User is logged out and redirected to login page

#### 4.3 Expired Token
- [ ] **Action**: Login as any user
- [ ] **Action**: Wait for token to expire (or manually expire it)
- [ ] **Action**: Try to make API call
- [ ] **Expected**: 
  - Backend: Returns 401 with message "Token has expired"
  - Frontend: Redirects to `/login`
- [ ] **Verify**: Expired tokens are rejected

#### 4.4 Invalid Token
- [ ] **Action**: Set invalid token in localStorage
- [ ] **Action**: Try to make API call
- [ ] **Expected**: 
  - Backend: Returns 401 with message "Invalid token"
  - Frontend: Redirects to `/login`
- [ ] **Verify**: Invalid tokens are rejected

#### 4.5 No Token
- [ ] **Action**: Clear all localStorage
- [ ] **Action**: Try to access protected route
- [ ] **Expected**: 
  - Frontend: Immediately redirects to `/login`
  - Backend: Returns 401 if API called directly
- [ ] **Verify**: No token = no access

---

## ✅ Test 5: Sidebar Visibility

### Test Cases:

#### 5.1 Admin Sidebar
- [ ] **Action**: Login as admin
- [ ] **Expected**: Sidebar shows:
  - Dashboard ✅
  - Franchises ✅
  - Users ✅
  - Reports ✅
  - Settings ✅
- [ ] **Verify**: All admin menu items visible

#### 5.2 Manager Sidebar
- [ ] **Action**: Login as manager
- [ ] **Expected**: Sidebar shows:
  - Franchise Dashboard ✅ (their franchise)
  - Products ✅
  - Sales ✅
  - Orders ✅
  - Settings ✅
- [ ] **Verify**: Dashboard, Users, Reports NOT visible

#### 5.3 Sales Sidebar
- [ ] **Action**: Login as sales user
- [ ] **Expected**: Sidebar shows:
  - Sales ✅
  - Orders ✅
  - Settings ✅
- [ ] **Verify**: Dashboard, Franchises, Users, Reports, Products NOT visible

---

## ✅ Test 6: Backend Role Validation

### Test Cases:

#### 6.1 Direct API Access Without Token
- [ ] **Action**: Make API call without Authorization header
- [ ] **Expected**: Returns 401 Unauthorized
- [ ] **Verify**: All protected routes require authentication

#### 6.2 Direct API Access With Wrong Role
- [ ] **Action**: Login as sales user
- [ ] **Action**: Try to access admin route directly via API
- [ ] **Expected**: Returns 403 Forbidden
- [ ] **Verify**: Backend validates role, not just frontend

#### 6.3 Token Manipulation
- [ ] **Action**: Login as sales user
- [ ] **Action**: Manually modify token to change role (if possible)
- [ ] **Expected**: 
  - Backend validates role from database, not just token
  - Returns 401 if token role doesn't match database role
- [ ] **Verify**: Token role mismatch detection works

---

## ✅ Test 7: Franchise Data Isolation

### Test Cases:

#### 7.1 Manager Cannot See Other Franchise Data
- [ ] **Action**: Login as manager from Franchise A
- [ ] **Action**: Try to query products/sales/orders
- [ ] **Expected**: Only sees Franchise A data
- [ ] **Verify**: Cannot see Franchise B data even if franchise ID provided

#### 7.2 Sales Cannot See Other Franchise Data
- [ ] **Action**: Login as sales user from Franchise A
- [ ] **Action**: Try to query products/sales/orders
- [ ] **Expected**: Only sees Franchise A data
- [ ] **Verify**: Cannot see Franchise B data

#### 7.3 Admin Can See All Franchise Data
- [ ] **Action**: Login as admin
- [ ] **Action**: Query products/sales/orders
- [ ] **Expected**: Sees data from all franchises
- [ ] **Verify**: No franchise filter applied for admin

---

## Test Execution Notes

### How to Test:

1. **Create Test Users** (via register endpoint or database):
   ```json
   // Admin
   POST /api/auth/register
   {
     "name": "Admin User",
     "email": "admin@test.com",
     "password": "admin123",
     "role": "admin"
   }

   // Manager
   POST /api/auth/register
   {
     "name": "Manager User",
     "email": "manager@test.com",
     "password": "manager123",
     "role": "manager",
     "franchise": "<franchise_id>"
   }

   // Sales
   POST /api/auth/register
   {
     "name": "Sales User",
     "email": "sales@test.com",
     "password": "sales123",
     "role": "sales",
     "franchise": "<franchise_id>"
   }
   ```

2. **Test Frontend**: Use browser to test UI access and redirects

3. **Test Backend**: Use Postman/curl to test API endpoints directly

4. **Test Token Removal**: Use browser DevTools to manipulate localStorage

### Expected Results Summary:

| User Role | Admin Dashboard | Reports | Delete Data | All Franchises | Own Franchise Only |
|-----------|----------------|---------|-------------|----------------|-------------------|
| Admin     | ✅ Yes         | ✅ Yes  | ✅ Yes      | ✅ Yes         | N/A               |
| Manager   | ❌ No          | ✅ Yes  | ✅ Yes      | ❌ No          | ✅ Yes            |
| Sales     | ❌ No          | ❌ No   | ❌ No       | ❌ No          | ✅ Yes            |

---

## Security Verification

- [ ] Passwords are hashed (check database - should be bcrypt hash)
- [ ] JWT tokens expire after 1 day
- [ ] Passwords never returned in API responses
- [ ] Backend validates roles on every request
- [ ] Frontend protection is supplementary only
- [ ] Token removal immediately logs out user
- [ ] Expired tokens are rejected

---

## Notes

- All tests should be performed in a test environment
- Use different browsers/incognito windows for different user roles
- Document any failures or unexpected behavior
- Verify both frontend UI and backend API responses
