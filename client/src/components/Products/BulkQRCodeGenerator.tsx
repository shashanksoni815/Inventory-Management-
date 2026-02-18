import React, { useState, useEffect, useCallback } from 'react';
import QRCode from 'qrcode';
import { X, QrCode, Download, Printer, Loader2 } from 'lucide-react';
import type { Product } from '@/types';

interface BulkQRCodeGeneratorProps {
  products: Product[];
  isOpen: boolean;
  onClose: () => void;
}

interface ProductQRData {
  product: Product;
  qrDataUrl: string | null;
  url: string;
}

const BulkQRCodeGenerator: React.FC<BulkQRCodeGeneratorProps> = ({
  products,
  isOpen,
  onClose,
}) => {
  const [qrData, setQrData] = useState<ProductQRData[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);

  // Generate QR codes for all products
  useEffect(() => {
    if (!isOpen || products.length === 0) {
      setQrData([]);
      return;
    }

    const generateAllQRCodes = async () => {
      setIsGenerating(true);
      setGenerationProgress(0);
      const qrDataArray: ProductQRData[] = [];

      for (let i = 0; i < products.length; i++) {
        const product = products[i];
        if (!product.sku) {
          qrDataArray.push({
            product,
            qrDataUrl: null,
            url: '',
          });
          continue;
        }

        try {
          // Generate QR code with ONLY the public product URL (no JSON, images, or other data)
          const publicUrl = `${window.location.origin}/product/${product.sku}`;
          const qrDataUrl = await QRCode.toDataURL(publicUrl, {
            width: 300, // Medium size: 300px (consistent with other QR codes)
            margin: 2, // Clear white border
            errorCorrectionLevel: 'H', // High error correction for better scanning
            color: {
              dark: '#000000', // Black QR code
              light: '#FFFFFF', // White background (clear)
            },
          });

          qrDataArray.push({
            product,
            qrDataUrl,
            url: publicUrl,
          });
        } catch (error) {
          console.error(`Error generating QR for ${product.sku}:`, error);
          qrDataArray.push({
            product,
            qrDataUrl: null,
            url: `${window.location.origin}/product/${product.sku}`,
          });
        }

        setGenerationProgress(((i + 1) / products.length) * 100);
        setQrData([...qrDataArray]);
      }

      setIsGenerating(false);
    };

    generateAllQRCodes();
  }, [isOpen, products]);

  const handleDownloadAll = useCallback(() => {
    qrData.forEach((item) => {
      if (item.qrDataUrl && item.product.sku) {
        const link = document.createElement('a');
        link.href = item.qrDataUrl;
        link.download = `QR-${item.product.sku}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    });
  }, [qrData]);

  const handlePrintAll = useCallback(() => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const qrCodesWithData = qrData.filter((item) => item.qrDataUrl !== null);
    const itemsPerPage = 12; // 3x4 grid per A4 page
    const pages = Math.ceil(qrCodesWithData.length / itemsPerPage);

    let html = `
      <html>
        <head>
          <title>Bulk QR Codes - All Products</title>
          <style>
            @page {
              size: A4;
              margin: 15mm;
            }
            body {
              margin: 0;
              padding: 0;
              font-family: Arial, sans-serif;
            }
            .page {
              page-break-after: always;
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              grid-template-rows: repeat(4, 1fr);
              gap: 10mm;
              padding: 10mm;
              min-height: 277mm;
              box-sizing: border-box;
            }
            .page:last-child {
              page-break-after: auto;
            }
            .qr-item {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              border: 1px solid #ddd;
              padding: 5mm;
              text-align: center;
              break-inside: avoid;
            }
            .qr-item img {
              max-width: 100%;
              height: auto;
              width: 300px;
              margin-bottom: 3mm;
              background: #FFFFFF;
              padding: 2mm;
            }
            .qr-item .product-name {
              font-size: 10pt;
              font-weight: bold;
              margin-bottom: 2mm;
              word-wrap: break-word;
            }
            .qr-item .product-sku {
              font-size: 8pt;
              color: #666;
              font-family: monospace;
              margin-bottom: 2mm;
            }
            .qr-item .product-url {
              font-size: 7pt;
              color: #999;
              word-break: break-all;
            }
            @media print {
              body {
                margin: 0;
              }
              .page {
                margin: 0;
              }
            }
          </style>
        </head>
        <body>
    `;

    for (let pageIndex = 0; pageIndex < pages; pageIndex++) {
      html += '<div class="page">';
      const startIndex = pageIndex * itemsPerPage;
      const endIndex = Math.min(startIndex + itemsPerPage, qrCodesWithData.length);

      for (let i = startIndex; i < endIndex; i++) {
        const item = qrCodesWithData[i];
        html += `
          <div class="qr-item">
            <div class="product-name">${item.product.name || 'N/A'}</div>
            <div class="product-sku">SKU: ${item.product.sku}</div>
            <img src="${item.qrDataUrl}" alt="QR Code" />
            <div class="product-url">${item.url}</div>
          </div>
        `;
      }

      // Fill remaining slots if needed
      const remainingSlots = itemsPerPage - (endIndex - startIndex);
      for (let i = 0; i < remainingSlots; i++) {
        html += '<div class="qr-item"></div>';
      }

      html += '</div>';
    }

    html += `
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  }, [qrData]);

  if (!isOpen) return null;

  const successfulQRCodes = qrData.filter((item) => item.qrDataUrl !== null).length;
  const failedQRCodes = qrData.length - successfulQRCodes;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <QrCode className="h-6 w-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Generate All QR Codes</h2>
              <p className="text-sm text-gray-500">
                {products.length} product{products.length !== 1 ? 's' : ''} found
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Progress Bar */}
        {isGenerating && (
          <div className="px-6 py-4 bg-blue-50 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
              <div className="flex-1">
                <div className="flex justify-between text-sm text-gray-700 mb-1">
                  <span>Generating QR codes...</span>
                  <span>{Math.round(generationProgress)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${generationProgress}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isGenerating ? (
            <div className="text-center py-12">
              <Loader2 className="h-12 w-12 text-blue-600 animate-spin mx-auto mb-4" />
              <p className="text-gray-600">
                Generating QR codes for {products.length} products...
              </p>
            </div>
          ) : qrData.length > 0 ? (
            <>
              {/* Summary */}
              <div className="mb-6 flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-6">
                  <div>
                    <span className="text-sm text-gray-600">Successful: </span>
                    <span className="font-semibold text-green-600">{successfulQRCodes}</span>
                  </div>
                  {failedQRCodes > 0 && (
                    <div>
                      <span className="text-sm text-gray-600">Failed: </span>
                      <span className="font-semibold text-red-600">{failedQRCodes}</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleDownloadAll}
                    disabled={successfulQRCodes === 0}
                    className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Download className="h-4 w-4" />
                    Download All
                  </button>
                  <button
                    onClick={handlePrintAll}
                    disabled={successfulQRCodes === 0}
                    className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Printer className="h-4 w-4" />
                    Print All (A4)
                  </button>
                </div>
              </div>

              {/* QR Codes Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {qrData.map((item, index) => (
                  <div
                    key={item.product._id || index}
                    className="border border-gray-200 rounded-lg p-4 bg-white hover:shadow-md transition-shadow"
                  >
                    {item.qrDataUrl ? (
                      <>
                        <div className="text-center mb-2">
                          <p className="text-xs font-semibold text-gray-900 truncate mb-1">
                            {item.product.name || 'N/A'}
                          </p>
                          <p className="text-xs text-gray-500 font-mono">
                            {item.product.sku}
                          </p>
                        </div>
                        <img
                          src={item.qrDataUrl}
                          alt={`QR Code for ${item.product.sku}`}
                          className="w-full h-auto border border-gray-200 rounded"
                        />
                        <p className="text-xs text-gray-400 text-center mt-2 truncate">
                          {item.url}
                        </p>
                      </>
                    ) : (
                      <div className="text-center py-8 text-gray-400">
                        <p className="text-sm">No SKU</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <p>No products available</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BulkQRCodeGenerator;
