# MongoDB Indexes Documentation

This document lists all MongoDB indexes defined in the models for optimal query performance.

## Product Model (`Product.model.js`)

- `franchise` (indexed) - Used for franchise-scoped queries
- `status` (indexed) - Used for filtering active/inactive products
- `sku` + `franchise` (compound unique) - Ensures unique SKU per franchise
- `isGlobal` (indexed) - Used for global product queries
- `stockQuantity` (indexed) - Used for low stock queries
- `minimumStock` (indexed) - Used for stock alerts

**Recommended additional indexes:**
- Compound: `{ status: 1, franchise: 1 }` - For franchise-scoped active products
- Compound: `{ isGlobal: 1, status: 1 }` - For global product queries
- Compound: `{ stockQuantity: 1, minimumStock: 1 }` - For low stock queries

## Sale Model (`Sale.model.js`)

- `invoiceNumber` (unique, indexed) - Used for invoice lookups
- `createdAt` (indexed, ascending and descending) - Used for date range queries
- `franchise` (indexed) - Used for franchise-scoped queries
- `status` (indexed) - Used for filtering completed/pending sales
- `saleType` + `status` (compound) - Used for online/offline sales filtering
- `franchise` + `createdAt` (compound, ascending and descending) - Critical for franchise aggregations
- `franchise` + `status` (compound) - For franchise status queries
- `items.product` (indexed) - For product performance queries
- `totalProfit` (indexed, descending) - For profit sorting

**Query optimization notes:**
- All date range queries use `createdAt` index
- Franchise queries use compound `franchise + createdAt` index
- Aggregations benefit from `franchise + createdAt` compound index

## Order Model (`Order.model.js`)

- `orderNumber` (indexed) - Used for order lookups
- `franchise` + `orderNumber` (compound unique) - Ensures unique order per franchise
- `franchise` + `createdAt` (compound, descending) - For franchise order queries
- `orderStatus` + `franchise` (compound) - For status filtering
- `payment.status` (indexed) - For payment queries
- `createdAt` (indexed, descending) - For date sorting

## Notification Model (`Notification.model.js`)

- `user` (indexed) - Used for user-scoped queries
- `isRead` (indexed) - Used for unread filtering
- `user` + `isRead` + `createdAt` (compound) - Critical for notification queries
- `user` + `createdAt` (compound) - For user notification sorting
- `expiresAt` (TTL index) - Auto-deletes expired notifications

## Franchise Model (`Franchise.js`)

- `code` (unique, indexed) - Used for franchise code lookups
- `status` (indexed) - Used for filtering active franchises

## User Model (`User.model.js`)

- `username` (unique, indexed) - Used for authentication
- `role` (indexed) - Used for role-based access control
- `franchises` (indexed) - Used for franchise assignment queries

## Performance Best Practices

1. **Always use indexed fields in $match stages** - Place indexed fields first in aggregation pipelines
2. **Use compound indexes** - For queries that filter by multiple fields
3. **Limit result sets** - Use `limit()` in aggregations to reduce data transfer
4. **Use $project early** - Reduce fields before expensive operations
5. **Parallel queries** - Use `Promise.all()` for independent queries
6. **Avoid $lookup when possible** - Prefer denormalized data or separate queries

## Index Maintenance

Run `db.collection.getIndexes()` to verify indexes exist.
Run `db.collection.explain().find({...})` to verify index usage.
