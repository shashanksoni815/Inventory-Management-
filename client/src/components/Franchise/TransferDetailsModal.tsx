import React from 'react';
import {
  X,
  Truck,
  Package,
  MapPin,
  CheckCircle,
  Clock,
  AlertCircle,
  Download,
  Printer
} from 'lucide-react';
import { format } from 'date-fns';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface TransferDetailsModalProps {
  transfer: any;
  isOpen: boolean;
  onClose: () => void;
}

const TransferDetailsModal: React.FC<TransferDetailsModalProps> = ({
  transfer,
  isOpen,
  onClose
}) => {
  if (!isOpen) return null;

  const getStatusIcon = (status: string) => {
    const icons: Record<string, any> = {
      'pending': Clock,
      'approved': CheckCircle,
      'in_transit': Truck,
      'completed': CheckCircle,
      'rejected': AlertCircle,
      'cancelled': X
    };
    return icons[status] || AlertCircle;
  };

  const StatusIcon = getStatusIcon(transfer.status);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative bg-white rounded-xl shadow-xl w-full max-w-4xl">
          {/* Header */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Truck className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Transfer Details
                  </h3>
                  <p className="text-sm text-gray-600">
                    TRF-{transfer._id.toString().slice(-6).toUpperCase()}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <Badge variant={
                  transfer.status === 'completed' ? 'success' :
                  transfer.status === 'pending' ? 'warning' :
                  transfer.status === 'rejected' ? 'danger' :
                  transfer.status === 'in_transit' ? 'purple' : 'gray'
                }>
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {transfer.status.replace('_', ' ')}
                </Badge>
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column - Transfer Info */}
              <div className="lg:col-span-2 space-y-6">
                {/* Product Info */}
                <Card className="p-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Product Information</h4>
                  <div className="flex items-start space-x-4">
                    <div className="p-3 bg-blue-100 rounded-lg">
                      <Package className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 text-lg">
                        {transfer.product?.name || 'Unknown Product'}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        SKU: {transfer.product?.sku || 'N/A'}
                      </div>
                      <div className="grid grid-cols-2 gap-4 mt-4">
                        <div>
                          <div className="text-sm text-gray-500">Category</div>
                          <div className="font-medium">{transfer.product?.category || 'N/A'}</div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-500">Brand</div>
                          <div className="font-medium">{transfer.product?.brand || 'N/A'}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Transfer Details */}
                <Card className="p-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Transfer Details</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <div>
                      <h5 className="text-sm font-medium text-gray-700 mb-3">From Franchise</h5>
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <MapPin className="h-4 w-4 text-gray-400" />
                          <span className="font-medium">{transfer.fromFranchise?.name}</span>
                        </div>
                        <div className="text-sm text-gray-600">
                          {transfer.fromFranchise?.code}
                        </div>
                        <div className="text-sm text-gray-600">
                          {transfer.fromFranchise?.location}
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h5 className="text-sm font-medium text-gray-700 mb-3">To Franchise</h5>
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <MapPin className="h-4 w-4 text-gray-400" />
                          <span className="font-medium">{transfer.toFranchise?.name}</span>
                        </div>
                        <div className="text-sm text-gray-600">
                          {transfer.toFranchise?.code}
                        </div>
                        <div className="text-sm text-gray-600">
                          {transfer.toFranchise?.location}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                      <div>
                        <div className="text-sm text-gray-500">Quantity</div>
                        <div className="text-2xl font-bold text-gray-900">
                          {transfer.quantity}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">Unit Price</div>
                        <div className="text-2xl font-bold text-gray-900">
                          ${transfer.unitPrice?.toFixed(2) || '0.00'}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">Total Value</div>
                        <div className="text-2xl font-bold text-green-600">
                          ${transfer.totalValue?.toFixed(2) || '0.00'}
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Notes */}
                {transfer.notes && (
                  <Card className="p-6">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">Notes</h4>
                    <p className="text-gray-600">{transfer.notes}</p>
                  </Card>
                )}
              </div>

              {/* Right Column - Timeline & Actions */}
              <div className="space-y-6">
                {/* Timeline */}
                <Card className="p-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Transfer Timeline</h4>
                  <div className="space-y-4">
                    {transfer.history?.map((event: any, index: number) => (
                      <div key={index} className="flex items-start space-x-3">
                        <div className={`mt-1 flex-shrink-0 w-2 h-2 rounded-full
                          ${event.status === 'completed' ? 'bg-green-500' :
                            event.status === 'pending' ? 'bg-yellow-500' :
                            event.status === 'rejected' ? 'bg-red-500' :
                            'bg-gray-500'
                          }`}
                        />
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">
                            {event.status.replace('_', ' ')}
                          </div>
                          <div className="text-sm text-gray-600">
                            {event.note}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {format(new Date(event.date), 'MMM d, yyyy HH:mm')}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Actions */}
                <Card className="p-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Actions</h4>
                  <div className="space-y-3">
                    {transfer.status === 'pending' && (
                      <>
                        <Button className="w-full" variant="success">
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Approve Transfer
                        </Button>
                        <Button className="w-full" variant="danger">
                          <X className="h-4 w-4 mr-2" />
                          Reject Transfer
                        </Button>
                      </>
                    )}
                    
                    {transfer.status === 'approved' && (
                      <Button className="w-full" variant="purple">
                        <Truck className="h-4 w-4 mr-2" />
                        Mark as In Transit
                      </Button>
                    )}
                    
                    {transfer.status === 'in_transit' && (
                      <Button className="w-full" variant="success">
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Mark as Completed
                      </Button>
                    )}

                    <div className="pt-4 border-t border-gray-200">
                      <div className="space-y-2">
                        <Button variant="outline" className="w-full">
                          <Download className="h-4 w-4 mr-2" />
                          Download Documents
                        </Button>
                        <Button variant="outline" className="w-full">
                          <Printer className="h-4 w-4 mr-2" />
                          Print Transfer Sheet
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Key Dates */}
                <Card className="p-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Key Dates</h4>
                  <div className="space-y-3">
                    <div>
                      <div className="text-sm text-gray-500">Transfer Date</div>
                      <div className="font-medium">
                        {format(new Date(transfer.transferDate), 'MMM d, yyyy')}
                      </div>
                    </div>
                    {transfer.expectedDelivery && (
                      <div>
                        <div className="text-sm text-gray-500">Expected Delivery</div>
                        <div className="font-medium">
                          {format(new Date(transfer.expectedDelivery), 'MMM d, yyyy')}
                        </div>
                      </div>
                    )}
                    {transfer.actualDelivery && (
                      <div>
                        <div className="text-sm text-gray-500">Actual Delivery</div>
                        <div className="font-medium">
                          {format(new Date(transfer.actualDelivery), 'MMM d, yyyy')}
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-4 sm:px-6 py-4 bg-gray-50 rounded-b-xl border-t border-gray-200">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-0">
              <div className="text-sm text-gray-600">
                Initiated by: {transfer.initiatedBy?.name || 'Unknown User'}
              </div>
              <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">
                Close
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransferDetailsModal;