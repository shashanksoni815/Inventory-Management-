# STEP 13: Orders Module – Final Validation

This document confirms that the Orders module meets all validation criteria.

---

## 1. Orders appear in sidebar

**Status: Confirmed**

- **Layout** (`client/src/components/Layout/Layout.tsx`): Navigation array includes `{ name: 'Orders', href: '/orders', icon: ShoppingBag }` between Products and Sales.
- **Active state**: `isActive()` treats `/orders` and `/orders/:orderId` as active for the Orders nav item (`path === '/orders' && location.pathname.startsWith('/orders/')`).
- **Routes** (`client/src/App.tsx`): `orders` → `<Orders />`, `orders/:orderId` → `<OrderDetails />`.

---

## 2. Orders list loads correctly

**Status: Confirmed**

- **Page**: `client/src/pages/Orders.tsx`.
- **API**: `orderApi.getOrders({ page, limit, franchise, startDate, endDate, status, search, sortBy, sortOrder })` → `GET /api/orders` with query params.
- **Data**: Uses `useQuery` with key `['orders', currentFranchise?._id, dateRange, statusFilter, search, page, limit]`; renders `data.orders` and `data.pagination`.
- **UI**: Table columns (Order #, Date, Customer, Payment, Order Status, Total, View); filters (date range, status, search); pagination; loading spinner; empty state (“No orders found”); error state with Retry.

---

## 3. Order details show full info

**Status: Confirmed**

- **Page**: `client/src/pages/OrderDetails.tsx`; data from `orderApi.getById(orderId)` → `GET /api/orders/:id`.
- **Backend** (`server/controllers/order.controller.js` – `getOrderById`): Returns order with `.populate('franchise', 'name code location contact')` and `.populate('items.product', 'name sku category')`.
- **Detail sections**:
  - Header: Order number, placed date, franchise, status badge.
  - Customer & delivery: name, phone, email; delivery address (addressLine, city, state, pincode).
  - Payment: method, status, transactionId, gateway.
  - Products table: productName, quantity, unitPrice, subtotal per line.
  - Totals: item total, tax, delivery fee, discount, grand total.
  - Status timeline (steps) and “Update status” (when role ≠ staff).

---

## 4. Status updates work

**Status: Confirmed**

- **Client**: OrderDetails calls `orderApi.updateStatus(id, orderStatus)` → `PATCH /api/orders/:id/status`; valid next statuses from `getValidNextStatuses(current)`; confirmation dialog before submit; invalidates `['orders']` and order detail query on success.
- **Backend** (`server/controllers/order.controller.js` – `updateOrderStatus`):
  - Validates `orderStatus` against `ALLOWED_STATUSES`.
  - Staff role: 403 “Read-only access: You cannot update order status”.
  - Franchise access: `hasFranchiseAccess(user, order.franchiseId)`; 403 if denied.
  - Transaction: load order, apply status-specific logic, save order, commit.

---

## 5. Inventory & sales update correctly

**Status: Confirmed**

- **Confirmed** (backend, same controller):
  - For each order item: check product exists and `(stockQuantity - reservedQuantity) >= item.quantity`.
  - `Product.findByIdAndUpdate` with `$inc: { reservedQuantity: item.quantity }`.
- **Delivered**:
  - For each item: check `reservedQuantity >= item.quantity`; then `$inc: stockQuantity: -qty, reservedQuantity: -qty, totalSold, totalRevenue, totalProfit`; `lastSold` set.
  - Create one `Sale` document with `order: order._id`, `franchise: order.franchise`, items derived from order, totals, `saleType: 'online'`, `status: 'completed'`.
- **Cancelled** (when previous status was reservation-holding):
  - For each item: `$inc: { reservedQuantity: -item.quantity }`.

All of the above run inside the same MongoDB transaction (commit or abort).

---

## 6. Franchise isolation works

**Status: Confirmed**

- **List** (`getOrders`):
  - `buildFranchiseFilter(req)`:
    - Admin/SuperAdmin: optional `req.query.franchise`; if absent, no franchise filter (all orders).
    - Franchise manager / Staff: must have `user.franchises`; if `req.query.franchise` is set, must `hasFranchiseAccess(user, franchiseParam)` and filter `{ franchise: franchiseParam }`; else filter `{ franchise: { $in: user.franchises } }`.
  - Query is `{ ...franchiseFilter, ...dateFilter, ...statusFilter, ...searchFilter }`.
- **Single order** (`getOrderById`): After loading order, `hasFranchiseAccess(user, order.franchiseId)`; 403 if false.
- **Update status** (`updateOrderStatus`): Same franchise check on the loaded order; 403 if no access.
- **Dashboard**: Franchise Orders Summary and Recent Orders are fetched via `GET /api/franchises/:franchiseId/orders-summary`, scoped to that franchise on the server.

---

## Summary

| Check                         | Result  |
|------------------------------|---------|
| Orders in sidebar            | Yes     |
| Orders list loads            | Yes     |
| Order details full info      | Yes     |
| Status updates work          | Yes     |
| Inventory & sales update     | Yes     |
| Franchise isolation          | Yes     |

**Sidebar fix applied**: “Orders” (ShoppingBag icon) was added to the Layout navigation array so it appears in the sidebar between Products and Sales.
