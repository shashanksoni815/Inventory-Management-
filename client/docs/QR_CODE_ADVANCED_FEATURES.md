# QR Code System - Advanced Features (Future Enhancements)

This document outlines optional advanced features that can be added to enhance the QR code system. These features are **not currently implemented** but are documented for future development.

---

## 1. QR Scan Analytics Tracking

### Purpose
Track how many times each product's QR code has been scanned to gain insights into product popularity and customer engagement.

### Implementation Plan

#### Backend Changes

**1. Update Product Model** (`server/models/Product.model.js`)
```javascript
const productSchema = new mongoose.Schema({
  // ... existing fields ...
  
  qrScanAnalytics: {
    totalScans: {
      type: Number,
      default: 0,
      min: 0
    },
    lastScanned: {
      type: Date
    },
    scanHistory: [{
      scannedAt: {
        type: Date,
        default: Date.now
      },
      ipAddress: String,
      userAgent: String,
      referrer: String,
      location: {
        country: String,
        city: String
      }
    }]
  }
});
```

**2. Create Analytics Endpoint** (`server/routes/product.routes.js`)
```javascript
// Public endpoint - track scan without authentication
router.post('/public/:sku/scan', trackQRScan);
```

**3. Create Scan Tracking Controller** (`server/controllers/product.controller.js`)
```javascript
export const trackQRScan = async (req, res) => {
  try {
    const { sku } = req.params;
    const product = await Product.findOne({ sku: sku.toUpperCase() });
    
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    
    // Increment scan count
    product.qrScanAnalytics.totalScans = (product.qrScanAnalytics.totalScans || 0) + 1;
    product.qrScanAnalytics.lastScanned = new Date();
    
    // Optional: Store scan history (limit to last 100 scans)
    if (!product.qrScanAnalytics.scanHistory) {
      product.qrScanAnalytics.scanHistory = [];
    }
    
    product.qrScanAnalytics.scanHistory.push({
      scannedAt: new Date(),
      ipAddress: req.ip || req.headers['x-forwarded-for'],
      userAgent: req.headers['user-agent'],
      referrer: req.headers['referer']
    });
    
    // Keep only last 100 scans
    if (product.qrScanAnalytics.scanHistory.length > 100) {
      product.qrScanAnalytics.scanHistory = product.qrScanAnalytics.scanHistory.slice(-100);
    }
    
    await product.save();
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error tracking QR scan:', error);
    res.status(500).json({ success: false, message: 'Error tracking scan' });
  }
};
```

#### Frontend Changes

**1. Track Scan on Page Load** (`client/src/pages/PublicProduct.tsx`)
```typescript
useEffect(() => {
  // Track QR scan when page loads
  const trackScan = async () => {
    if (sku && product) {
      try {
        await axios.post(`/api/products/public/${sku}/scan`, {}, {
          baseURL: '/api'
        });
      } catch (error) {
        // Silently fail - analytics shouldn't break user experience
        console.error('Failed to track scan:', error);
      }
    }
  };
  
  if (product) {
    trackScan();
  }
}, [sku, product]);
```

**2. Display Analytics in Product Management** (`client/src/pages/Products.tsx`)
- Add scan count column in product table
- Show scan analytics in product detail view
- Add analytics dashboard for top scanned products

### Benefits
- Understand product popularity
- Track customer engagement
- Identify trending products
- Measure marketing campaign effectiveness

---

## 2. Scan Count Field in Product Model

### Purpose
Simple counter for total QR code scans without detailed history (lightweight alternative to full analytics).

### Implementation Plan

**Update Product Model** (`server/models/Product.model.js`)
```javascript
const productSchema = new mongoose.Schema({
  // ... existing fields ...
  
  qrScanCount: {
    type: Number,
    default: 0,
    min: 0,
    index: true // For sorting/filtering by popularity
  }
});
```

**Update Public API** (`server/controllers/product.controller.js`)
```javascript
// Increment scan count when product is viewed
export const getPublicProductBySku = async (req, res) => {
  // ... existing code ...
  
  // Increment scan count (async, don't wait)
  Product.updateOne(
    { _id: product._id },
    { $inc: { qrScanCount: 1 } }
  ).catch(err => console.error('Error updating scan count:', err));
  
  // ... rest of code ...
};
```

**Display in Frontend**
- Add scan count badge in product cards
- Sort products by scan count
- Show "Most Scanned" products section

### Benefits
- Lightweight tracking
- No additional storage overhead
- Simple popularity metric

---

## 3. Invoice QR System

### Purpose
Generate QR codes for invoices that link directly to invoice details, payment pages, or digital receipts.

### Implementation Plan

**1. Create Invoice QR Endpoint** (`server/routes/invoice.routes.js`)
```javascript
router.get('/invoice/:invoiceId/qr', generateInvoiceQR);
```

**2. Invoice QR Controller** (`server/controllers/invoice.controller.js`)
```javascript
export const generateInvoiceQR = async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const invoice = await Invoice.findById(invoiceId);
    
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }
    
    // Generate QR code URL
    const qrUrl = `${process.env.FRONTEND_URL}/invoice/${invoiceId}`;
    
    // Generate QR code image
    const qrCodeDataUrl = await QRCode.toDataURL(qrUrl, {
      width: 300,
      margin: 2,
      errorCorrectionLevel: 'H',
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    
    res.json({
      success: true,
      data: {
        qrCode: qrCodeDataUrl,
        url: qrUrl,
        invoiceNumber: invoice.invoiceNumber
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error generating invoice QR' });
  }
};
```

**3. Invoice Public Page** (`client/src/pages/PublicInvoice.tsx`)
- Display invoice details
- Payment options
- Download PDF receipt
- Share invoice

**4. Add QR Code to Invoice PDF**
- Embed QR code in invoice PDF generation
- Link to digital invoice page
- Enable easy access to invoice details

### Benefits
- Easy invoice sharing
- Digital receipt access
- Payment link integration
- Reduced paper usage

---

## 4. POS Auto-Detect Mode

### Purpose
Enable Point of Sale systems to automatically detect products by scanning QR codes, eliminating manual SKU entry.

### Implementation Plan

**1. POS API Endpoint** (`server/routes/product.routes.js`)
```javascript
// Fast lookup endpoint for POS systems
router.get('/pos/lookup/:sku', getProductForPOS);
```

**2. POS Product Lookup** (`server/controllers/product.controller.js`)
```javascript
export const getProductForPOS = async (req, res) => {
  try {
    const { sku } = req.params;
    const { franchiseId } = req.query; // Optional franchise filter
    
    const product = await Product.findOne({
      sku: sku.toUpperCase(),
      status: 'active',
      ...(franchiseId && { franchise: franchiseId })
    })
    .select('sku name sellingPrice stockQuantity category images')
    .lean();
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    // Return minimal data for POS
    res.json({
      success: true,
      data: {
        sku: product.sku,
        name: product.name,
        price: product.sellingPrice,
        available: product.stockQuantity > 0,
        category: product.category,
        image: product.images?.[0]?.url || null
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error looking up product' });
  }
};
```

**3. POS Integration Page** (`client/src/pages/POS.tsx`)
- QR code scanner component
- Auto-add to cart on scan
- Fast product lookup
- Barcode scanner support

**4. QR Code Format for POS**
- Use same URL format: `/product/{sku}`
- POS system can parse SKU from URL
- Fallback to direct SKU lookup API

### Benefits
- Faster checkout process
- Reduced manual entry errors
- Better customer experience
- Inventory accuracy

---

## 5. Expiring QR Tokens for Security

### Purpose
Add time-limited QR codes for sensitive products or temporary access, enhancing security.

### Implementation Plan

**1. Create QR Token Model** (`server/models/QRToken.model.js`)
```javascript
const qrTokenSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  token: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expireAfterSeconds: 0 } // Auto-delete expired tokens
  },
  maxScans: {
    type: Number,
    default: 1 // Limit number of times QR can be scanned
  },
  scanCount: {
    type: Number,
    default: 0
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});
```

**2. Generate Tokenized QR** (`server/controllers/product.controller.js`)
```javascript
export const generateTokenizedQR = async (req, res) => {
  try {
    const { productId } = req.params;
    const { expiresInHours = 24, maxScans = 1 } = req.body;
    const user = req.user;
    
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    
    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);
    
    const qrToken = await QRToken.create({
      product: productId,
      token,
      expiresAt,
      maxScans,
      createdBy: user._id
    });
    
    // Generate QR code with tokenized URL
    const qrUrl = `${process.env.FRONTEND_URL}/product/${product.sku}?token=${token}`;
    const qrCodeDataUrl = await QRCode.toDataURL(qrUrl, {
      width: 300,
      margin: 2,
      errorCorrectionLevel: 'H',
      color: { dark: '#000000', light: '#FFFFFF' }
    });
    
    res.json({
      success: true,
      data: {
        qrCode: qrCodeDataUrl,
        url: qrUrl,
        expiresAt,
        maxScans
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error generating tokenized QR' });
  }
};
```

**3. Validate Token on Public Page** (`client/src/pages/PublicProduct.tsx`)
```typescript
useEffect(() => {
  const validateToken = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    
    if (token) {
      try {
        const response = await axios.get(`/api/products/public/${sku}/validate-token`, {
          params: { token }
        });
        
        if (!response.data.valid) {
          setError('This QR code has expired or reached its scan limit');
          return;
        }
      } catch (error) {
        setError('Invalid QR code token');
        return;
      }
    }
    
    // Continue with normal product fetch
    fetchProduct();
  };
  
  validateToken();
}, [sku]);
```

**4. Token Validation Endpoint** (`server/controllers/product.controller.js`)
```javascript
export const validateQRToken = async (req, res) => {
  try {
    const { sku } = req.params;
    const { token } = req.query;
    
    const product = await Product.findOne({ sku: sku.toUpperCase() });
    if (!product) {
      return res.json({ valid: false, reason: 'Product not found' });
    }
    
    const qrToken = await QRToken.findOne({
      product: product._id,
      token,
      expiresAt: { $gt: new Date() },
      scanCount: { $lt: { $maxScans } }
    });
    
    if (!qrToken) {
      return res.json({ valid: false, reason: 'Token expired or invalid' });
    }
    
    // Increment scan count
    qrToken.scanCount += 1;
    await qrToken.save();
    
    res.json({ valid: true });
  } catch (error) {
    res.json({ valid: false, reason: 'Validation error' });
  }
};
```

### Benefits
- Enhanced security for sensitive products
- Time-limited access
- Scan limit control
- Audit trail

---

## 6. Batch QR Printing Layout (PDF)

### Purpose
Generate professional PDF documents with multiple QR codes for batch printing, suitable for product labels or inventory sheets.

### Implementation Plan

**1. Install PDF Library**
```bash
npm install pdfkit
```

**2. Create PDF Generation Endpoint** (`server/routes/product.routes.js`)
```javascript
router.get('/qr/batch-pdf', protect, authorize('admin', 'manager'), generateBatchQRPDF);
```

**3. PDF Generation Controller** (`server/controllers/product.controller.js`)
```javascript
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';

export const generateBatchQRPDF = async (req, res) => {
  try {
    const { productIds, layout = 'labels', pageSize = 'A4' } = req.query;
    
    const products = await Product.find({
      _id: { $in: productIds.split(',') }
    }).select('sku name sellingPrice images');
    
    // Create PDF
    const doc = new PDFDocument({
      size: pageSize,
      margins: { top: 20, bottom: 20, left: 20, right: 20 }
    });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=product-qr-codes.pdf');
    
    doc.pipe(res);
    
    // Generate QR codes and add to PDF
    for (const product of products) {
      const qrUrl = `${process.env.FRONTEND_URL}/product/${product.sku}`;
      const qrDataUrl = await QRCode.toDataURL(qrUrl, {
        width: 200,
        margin: 1,
        errorCorrectionLevel: 'H',
        color: { dark: '#000000', light: '#FFFFFF' }
      });
      
      // Convert data URL to buffer
      const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');
      
      // Add QR code to PDF
      doc.image(qrBuffer, {
        fit: [150, 150],
        align: 'center'
      });
      
      // Add product info
      doc.fontSize(10)
         .text(product.name, { align: 'center' })
         .fontSize(8)
         .text(`SKU: ${product.sku}`, { align: 'center' })
         .text(`Price: ₹${product.sellingPrice}`, { align: 'center' })
         .moveDown(0.5);
      
      // Page break if needed
      if (doc.y > doc.page.height - 100) {
        doc.addPage();
      }
    }
    
    doc.end();
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({ success: false, message: 'Error generating PDF' });
  }
};
```

**4. Frontend PDF Download** (`client/src/components/Products/BulkQRCodeGenerator.tsx`)
```typescript
const handleDownloadPDF = async () => {
  try {
    const productIds = qrData
      .filter(item => item.qrDataUrl !== null)
      .map(item => item.product._id)
      .join(',');
    
    const response = await fetch(`/api/products/qr/batch-pdf?productIds=${productIds}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `product-qr-codes-${new Date().toISOString()}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error downloading PDF:', error);
  }
};
```

**5. Layout Options**
- **Labels**: Small QR codes with product info (for product labels)
- **Sheet**: Multiple QR codes per page (for inventory sheets)
- **Catalog**: Large QR codes with detailed product info (for catalogs)

### Benefits
- Professional printed materials
- Batch processing
- Customizable layouts
- Easy distribution

---

## Implementation Priority

### High Priority
1. **Scan Count Field** - Simple, lightweight, immediate value
2. **QR Scan Analytics** - Valuable insights, moderate complexity

### Medium Priority
3. **Batch QR Printing (PDF)** - Useful for operations, moderate complexity
4. **Invoice QR System** - Business value, requires invoice system integration

### Low Priority
5. **POS Auto-Detect Mode** - Requires POS system integration
6. **Expiring QR Tokens** - Advanced security feature, niche use case

---

## Technical Considerations

### Database Impact
- Scan analytics: Additional storage for scan history
- QR tokens: New collection, auto-expiring documents
- Scan count: Minimal impact (single field)

### Performance
- Analytics tracking: Async operations to avoid blocking
- PDF generation: Background job for large batches
- Token validation: Indexed queries for fast lookup

### Security
- Token generation: Cryptographically secure random tokens
- Token expiration: Automatic cleanup via MongoDB TTL
- Rate limiting: Prevent abuse of scan tracking

---

## Future Enhancements

- **QR Code Customization**: Brand colors, logos, custom designs
- **Dynamic QR Codes**: Update QR content without regenerating
- **QR Code Analytics Dashboard**: Visual insights and reports
- **Multi-language Support**: QR codes with language-specific URLs
- **QR Code Templates**: Pre-designed layouts for different use cases
- **Integration APIs**: Third-party QR code service integration

---

## Notes

- All features are **optional** and can be implemented incrementally
- Each feature is **independent** and can be added separately
- Consider **performance impact** before implementing analytics features
- **Security** should be prioritized for token-based features
- **User experience** should not be compromised by tracking/analytics
