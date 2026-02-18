import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { QrCode, Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ProductQRCodeProps {
  sku: string;
  productName?: string;
}

const ProductQRCode: React.FC<ProductQRCodeProps> = ({ sku, productName }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Generate the public product URL - QR code contains ONLY this URL (no JSON, images, or invoice data)
  const publicUrl = `${window.location.origin}/product/${sku}`;

  const handleDownload = () => {
    const qrCodeSvg = document.querySelector('.qr-code-svg') as SVGElement;
    if (!qrCodeSvg) return;

    // Get SVG data
    const svgData = new XMLSerializer().serializeToString(qrCodeSvg);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    // Create image to convert SVG to PNG
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        return;
      }

      // Fill white background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Draw SVG image
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Download as PNG
      canvas.toBlob((blob) => {
        if (blob) {
          const downloadUrl = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = downloadUrl;
          link.download = `QR-${sku}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(downloadUrl);
        }
        URL.revokeObjectURL(url);
      }, 'image/png');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsModalOpen(true)}
        className="flex items-center gap-2"
      >
        <QrCode className="h-4 w-4" />
        QR Code
      </Button>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Product QR Code</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {productName && (
              <p className="text-sm text-gray-600 mb-2">{productName}</p>
            )}
            <p className="text-xs text-gray-500 mb-4 font-mono">SKU: {sku}</p>

            <div className="flex flex-col items-center justify-center p-6 bg-white rounded-lg mb-4 border border-gray-200">
              <QRCodeSVG
                value={publicUrl}
                size={300}
                level="H"
                includeMargin={true}
                bgColor="#FFFFFF"
                fgColor="#000000"
                className="qr-code-svg"
              />
            </div>

            <div className="space-y-2 mb-4">
              <p className="text-xs text-gray-600 text-center">
                Scan this QR code to view product details
              </p>
              <p className="text-xs text-gray-400 text-center font-mono break-all">
                {publicUrl}
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleDownload}
                className="flex-1 flex items-center justify-center gap-2"
              >
                <Download className="h-4 w-4" />
                Download
              </Button>
              <Button
                variant="default"
                onClick={() => setIsModalOpen(false)}
                className="flex-1"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ProductQRCode;
