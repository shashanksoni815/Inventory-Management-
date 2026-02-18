# QR Code System - Testing Guide

## Complete Testing Flow

### Prerequisites
1. Server running on port 5002 (or configured port)
2. Client running on port 5173 (or configured port)
3. Mobile device with QR code scanner
4. Admin/Manager account to create products

---

## Step-by-Step Testing Flow

### STEP 1: Create Product
1. **Login** to the application as Admin or Manager
2. Navigate to **Products** page (`/products`)
3. Click **"Add Product"** button
4. Fill in the product form:
   - **SKU**: `TEST-001` (or any unique SKU)
   - **Product Name**: `Test Product`
   - **Category**: Select any category
   - **Buying Price**: `100`
   - **Selling Price**: `150`
   - **Stock Quantity**: `50`
   - **Description**: `This is a test product for QR code verification`
   - **Franchise**: Select a franchise
5. Complete all form steps and click **"Create Product"**
6. Verify product appears in the products table

**Expected Result**: ✅ Product created successfully

---

### STEP 2: Generate QR Code

#### Option A: From Product Form (Review Step)
1. Click **"Edit"** on the created product
2. Navigate to **Step 4: Review**
3. Scroll to **"Product QR Code"** section
4. Verify QR code is generated automatically
5. QR code should display:
   - Product name
   - SKU
   - QR code image (300x300px, white background)
   - Public URL: `http://yourdomain.com/product/TEST-001`
6. Test **"Download QR"** button - should download PNG file
7. Test **"Print QR"** button - should open print dialog

**Expected Result**: ✅ QR code generated with correct URL

#### Option B: From Product Table
1. In Products page, find the product row
2. Click **"QR Code"** button in Actions column
3. Modal should open with QR code
4. Verify QR code displays correctly
5. Test download functionality

**Expected Result**: ✅ QR code modal opens and displays correctly

#### Option C: Bulk QR Generation
1. In Products page, click **"Generate All QR Codes"** button
2. Modal opens and starts generating QR codes
3. Progress bar shows generation status
4. Once complete, verify all QR codes display in grid
5. Test **"Download All"** - downloads all QR codes
6. Test **"Print All (A4)"** - opens print dialog with formatted layout

**Expected Result**: ✅ Bulk QR codes generated and printable

---

### STEP 3: Scan QR Code from Mobile

1. **Download QR code** or **Print QR code** from Step 2
2. Open **QR code scanner** on mobile device:
   - iPhone: Use Camera app (built-in QR scanner)
   - Android: Use Camera app or Google Lens
   - Or use dedicated QR scanner app
3. **Point camera** at the QR code
4. **Scan the QR code**

**Expected Result**: ✅ Mobile browser opens with URL: `http://yourdomain.com/product/TEST-001`

---

### STEP 4: Website Opens

1. After scanning QR code, mobile browser should open
2. URL should be: `http://yourdomain.com/product/TEST-001`
3. Page should start loading

**Expected Result**: ✅ Website opens at correct product URL

---

### STEP 5: Product Page Loads

1. **Loading State**: Should see spinner with "Loading product information..."
2. **If logged in**: Should redirect to `/products?search=TEST-001` (internal view)
3. **If not logged in**: Should show public product page

**Expected Result**: ✅ Page loads correctly based on authentication status

---

### STEP 6: Structured Table Visible

If viewing public page (not logged in), verify:

1. **Page Header**: "Product Details" title visible
2. **Structured Table** displays with following rows:

   | Field | Expected Value |
   |-------|----------------|
   | Product Image | Product image or placeholder icon |
   | Product Name | "Test Product" |
   | SKU | "TEST-001" (monospace font) |
   | Category | Selected category name |
   | Base Price | ₹150.00 |
   | Tax Percentage | Tax % or "No tax" |
   | Total Price | ₹150.00 + tax (highlighted in blue) |
   | Availability | "In Stock" (green) or "Out of Stock" (red) |
   | Franchise Name | Franchise name and code (if applicable) |
   | Description | Product description text |

**Expected Result**: ✅ All table rows visible and properly formatted

---

### STEP 7: All Fields Display Correctly

Verify each field:

#### ✅ Product Image
- [ ] Image displays if uploaded
- [ ] Placeholder icon shows if no image
- [ ] Image is properly sized (w-32 h-32 sm:w-40 sm:h-40)

#### ✅ Product Name
- [ ] Name displays correctly
- [ ] Brand shows as "by {brand}" if available

#### ✅ SKU
- [ ] SKU displays in monospace font
- [ ] SKU is uppercase
- [ ] SKU has gray background badge

#### ✅ Category
- [ ] Category name displays correctly

#### ✅ Base Price
- [ ] Price displays in INR format (₹)
- [ ] Price formatted with proper decimals

#### ✅ Tax Percentage
- [ ] Tax % displays if > 0
- [ ] "No tax" displays if 0%

#### ✅ Total Price
- [ ] Total price highlighted in blue
- [ ] Shows breakdown if tax > 0
- [ ] Format: "Base: ₹X + Tax: ₹Y"

#### ✅ Availability
- [ ] "In Stock" badge (green) if stock > 0
- [ ] "Out of Stock" badge (red) if stock = 0
- [ ] **Security Check**: Does NOT show exact stock quantity

#### ✅ Franchise Name
- [ ] Franchise name displays if available
- [ ] Franchise code displays in parentheses
- [ ] **Security Check**: Does NOT show franchise ID

#### ✅ Description
- [ ] Description text displays
- [ ] "No description available" if empty
- [ ] Text wraps properly

**Expected Result**: ✅ All fields display correctly with proper formatting

---

## Security Validation Tests

### Test 1: No Sensitive Data Exposed
- [ ] **buyingPrice** NOT visible in public API response
- [ ] **stockQuantity** NOT visible (only `isInStock` boolean)
- [ ] **profitMargin** NOT visible
- [ ] **Product _id** NOT visible
- [ ] **Franchise _id** NOT visible
- [ ] **totalSold/totalRevenue/totalProfit** NOT visible

### Test 2: API Response Validation
1. Open browser DevTools → Network tab
2. Visit `/product/TEST-001`
3. Check API response: `/api/products/public/TEST-001`
4. Verify response contains ONLY:
   ```json
   {
     "success": true,
     "data": {
       "image": "...",
       "name": "...",
       "sku": "...",
       "category": "...",
       "sellingPrice": 150,
       "taxPercentage": 0,
       "description": "...",
       "brand": "...",
       "isInStock": true,
       "franchise": {
         "name": "...",
         "code": "..."
       }
     }
   }
   ```

**Expected Result**: ✅ No sensitive fields in API response

---

## Authentication Redirect Test

### Test: Logged-in User Redirect
1. **Login** to the application
2. Visit `/product/TEST-001` directly (or scan QR while logged in)
3. Should **redirect** to `/products?search=TEST-001`
4. Products page should **filter** by SKU
5. Product should appear in filtered results

**Expected Result**: ✅ Logged-in users redirected to internal view

### Test: Non-logged-in User
1. **Logout** from application
2. Visit `/product/TEST-001` directly (or scan QR)
3. Should show **public product page**
4. Should NOT redirect

**Expected Result**: ✅ Non-authenticated users see public view

---

## QR Code Quality Tests

### Test: QR Code Scanning
- [ ] QR code scans successfully on iPhone
- [ ] QR code scans successfully on Android
- [ ] QR code scans in low light conditions
- [ ] QR code scans when partially obscured (high error correction)

### Test: QR Code Display
- [ ] QR code size: 300x300px
- [ ] White background visible
- [ ] Black QR code pattern clear
- [ ] Margin/border visible around QR code

### Test: QR Code URL
- [ ] URL format: `{origin}/product/{sku}`
- [ ] URL does NOT contain JSON data
- [ ] URL does NOT contain product IDs
- [ ] URL is clean and readable

---

## Error Handling Tests

### Test: Invalid SKU
1. Visit `/product/INVALID-SKU`
2. Should show "Product Not Found" error
3. Error message should be user-friendly
4. Should NOT expose internal error details

**Expected Result**: ✅ Graceful error handling

### Test: Inactive Product
1. Create product with status "inactive"
2. Try to access via `/product/{sku}`
3. Should return 404 (product not found)

**Expected Result**: ✅ Only active products accessible

---

## Print Layout Tests

### Test: Bulk Print (A4)
1. Generate bulk QR codes
2. Click "Print All (A4)"
3. Verify print preview shows:
   - [ ] 3 columns × 4 rows = 12 QR codes per page
   - [ ] Each QR code includes product name
   - [ ] Each QR code includes SKU
   - [ ] Each QR code includes URL
   - [ ] Proper page breaks for multiple pages

**Expected Result**: ✅ A4 print layout formatted correctly

---

## Performance Tests

### Test: QR Code Generation Speed
- [ ] Single QR code generates in < 1 second
- [ ] Bulk QR codes (50 products) generate in < 10 seconds
- [ ] Progress bar updates smoothly during generation

### Test: Public Page Load Speed
- [ ] Public product page loads in < 2 seconds
- [ ] API response time < 500ms
- [ ] No unnecessary data fetching

---

## Browser Compatibility Tests

Test on:
- [ ] Chrome (Desktop & Mobile)
- [ ] Safari (Desktop & Mobile)
- [ ] Firefox (Desktop & Mobile)
- [ ] Edge (Desktop)

---

## Mobile Responsiveness Tests

- [ ] Public product page displays correctly on mobile
- [ ] Table is scrollable horizontally if needed
- [ ] QR code displays at proper size on mobile
- [ ] Text is readable on small screens
- [ ] Buttons are tappable on mobile

---

## Summary Checklist

- [ ] Product creation works
- [ ] QR code generation works (single)
- [ ] QR code generation works (bulk)
- [ ] QR code downloads correctly
- [ ] QR code prints correctly
- [ ] QR code scans successfully
- [ ] Website opens from scanned QR
- [ ] Public product page loads
- [ ] Structured table displays
- [ ] All fields display correctly
- [ ] No sensitive data exposed
- [ ] Authentication redirect works
- [ ] Error handling works
- [ ] Mobile responsive
- [ ] Cross-browser compatible

---

## Troubleshooting

### QR Code Not Scanning
- Check QR code size (should be 300px)
- Verify error correction level is 'H'
- Ensure white background is clear
- Check QR code is not damaged/obscured

### Product Not Found
- Verify product status is 'active'
- Check SKU matches exactly (case-insensitive)
- Verify product exists in database

### Redirect Not Working
- Check authentication token exists
- Verify AuthContext is properly initialized
- Check browser console for errors

### Fields Not Displaying
- Check API response structure
- Verify frontend interface matches API
- Check browser console for errors

---

## Notes

- QR codes contain ONLY URLs (no JSON, images, or invoice data)
- Public API returns ONLY safe fields (no buyingPrice, stockQuantity, IDs)
- Authentication check redirects logged-in users to internal view
- All QR codes use consistent 300px size with high error correction
