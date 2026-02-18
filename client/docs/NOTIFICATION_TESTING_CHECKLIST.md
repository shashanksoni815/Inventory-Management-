# Notification System — Testing Checklist

## Prerequisites

- Server and client running
- At least one admin, one manager, and one sales user
- At least one franchise with products

---

## 1. Admin Tests

| # | Test | Steps | Expected Result | ✓ |
|---|------|-------|-----------------|---|
| 1.1 | See all notifications | Log in as admin → Click bell icon → Open Notifications page | Sees notifications from all franchises | |
| 1.2 | Delete any notification | Admin → Notifications → Click Delete on any notification | Notification is deleted | |
| 1.3 | Delete all | Admin → Notifications → Click "Delete all" → Confirm | All notifications deleted | |

---

## 2. Manager Tests

| # | Test | Steps | Expected Result | ✓ |
|---|------|-------|-----------------|---|
| 2.1 | See only franchise notifications | Log in as manager → Click bell → Open Notifications page | Sees only notifications for their assigned franchise | |
| 2.2 | Mark as read | Manager → Notifications → Click Mark as read (check icon) on unread | Notification marked as read | |
| 2.3 | Mark all as read | Manager → Notifications → Click "Mark all as read" | All unread notifications for their franchise marked as read | |
| 2.4 | Delete own franchise notifications | Manager → Notifications → Click Delete on a notification | Notification is deleted | |
| 2.5 | No Delete all button | Manager → Notifications page | "Delete all" button is NOT visible | |

---

## 3. Sales Tests

| # | Test | Steps | Expected Result | ✓ |
|---|------|-------|-----------------|---|
| 3.1 | View notifications only | Log in as sales → Click bell → Open Notifications page | Sees only their franchise notifications | |
| 3.2 | Mark as read | Sales → Notifications → Click Mark as read | Notification marked as read | |
| 3.3 | Cannot delete | Sales → Notifications page | Delete button per notification is NOT visible | |
| 3.4 | No Delete all | Sales → Notifications page | "Delete all" button is NOT visible | |

---

## 4. Auto-Trigger Tests

| # | Test | Steps | Expected Result | ✓ |
|---|------|-------|-----------------|---|
| 4.1 | Low stock notification | Create/update product so stock &lt; minimumStock OR create sale that reduces stock below minimum | "Low Stock Alert" notification appears (type: inventory) | |
| 4.2 | New order notification | Create a new order (Orders → New Order) | "New Order Received" notification appears (type: order) | |
| 4.3 | New sale notification | Create a sale (Sales → New Sale) | "New Sale Created" notification appears (type: sale) | |
| 4.4 | New user notification | Admin creates user (Users → Add User) OR register new user | "New User Added" notification appears (type: user) | |

---

## 5. UI / Behavior

| # | Test | Steps | Expected Result | ✓ |
|---|------|-------|-----------------|---|
| 5.1 | Unread badge | Have unread notifications → Check header bell | Red badge shows unread count | |
| 5.2 | Dropdown shows latest 10 | Click bell → Open dropdown | Shows up to 10 latest notifications | |
| 5.3 | Priority colors | Check notification items | High=red, Medium=amber, Low=blue | |
| 5.4 | Time ago | Check notification list | Shows "2 min ago", "1 hour ago", etc. | |
| 5.5 | Pagination | Go to /notifications with many items | Pagination controls work | |
| 5.6 | Filter by type | Notifications page → Select type filter | List filtered by type | |
| 5.7 | Filter read/unread | Notifications page → Select Unread or Read | List filtered correctly | |

---

## 6. Security

| # | Test | Steps | Expected Result | ✓ |
|---|------|-------|-----------------|---|
| 6.1 | Cross-franchise blocked | Manager A tries to access/delete notification belonging to Franchise B (e.g. via API) | 403 Access denied | |
| 6.2 | No JWT | Call API without Authorization header | 401 Unauthorized | |
| 6.3 | Sales cannot delete via API | Sales user calls DELETE /api/notifications/:id | 403 Forbidden | |

---

## Notes

- Auto-refresh: Bell and dropdown refresh every 30 seconds.
- Route: `/notifications` is protected; admin, manager, and sales can access.
- Franchise filter: Non-admin users only see notifications where `franchise === req.user.franchise`.
