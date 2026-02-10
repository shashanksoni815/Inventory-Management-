import React, { useState } from 'react';
import { 
  X, 
  ArrowRightLeft, 
  Package,
  AlertCircle,
  Check
} from 'lucide-react';
import { useFranchise } from '../../contexts/FranchiseContext';
import { useMutation, useQuery } from '@tanstack/react-query';
import { productApi, franchiseApi } from '../../services/api';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Badge } from '../ui/Badge';

interface ProductTransferModalProps {
  product: {
    _id: string;
    name: string;
    sku: string;
    stockQuantity: number;
    franchise: {
      _id: string;
      name: string;
      code: string;
    };
  };
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const ProductTransferModal: React.FC<ProductTransferModalProps> = ({
  product,
  isOpen,
  onClose,
  onSuccess
}) => {
  const { franchises } = useFranchise();
  const [transferData, setTransferData] = useState({
    toFranchiseId: '',
    quantity: 1,
    note: ''
  });

  // Get available franchises (exclude current franchise)
  const availableFranchises = franchises.filter(f => 
    f._id !== product.franchise._id && f.status === 'active'
  );

  // Transfer mutation
  const transferMutation = useMutation({
    mutationFn: () => 
      productApi.transferStock(product._id, {
        toFranchiseId: transferData.toFranchiseId,
        quantity: parseInt(transferData.quantity as any),
        note: transferData.note
      }),
    onSuccess: () => {
      onSuccess();
      onClose();
      setTransferData({
        toFranchiseId: '',
        quantity: 1,
        note: ''
      });
    }
  });

  if (!isOpen) return null;

  const targetFranchise = availableFranchises.find(
    f => f._id === transferData.toFranchiseId
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md">
          {/* Header */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <ArrowRightLeft className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Transfer Stock
                  </h3>
                  <p className="text-sm text-gray-600">
                    Move inventory between franchises
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Product Info */}
          <div className="p-6 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-white rounded-lg border border-gray-200">
                <Package className="h-5 w-5 text-gray-600" />
              </div>
              <div className="flex-1">
                <div className="font-medium text-gray-900">{product.name}</div>
                <div className="text-sm text-gray-600">SKU: {product.sku}</div>
              </div>
              <Badge variant="outline" className="border-blue-300 text-blue-700">
                {product.franchise.code}
              </Badge>
            </div>
            
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-500">Available Stock</div>
                <div className="text-2xl font-bold text-gray-900">
                  {product.stockQuantity.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Current Franchise</div>
                <div className="font-medium text-gray-900">
                  {product.franchise.name}
                </div>
              </div>
            </div>
          </div>

          {/* Transfer Form */}
          <div className="p-6 space-y-4">
            {/* Target Franchise */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Transfer To
              </label>
              <Select
                value={transferData.toFranchiseId}
                onChange={(value) => setTransferData(prev => ({ 
                  ...prev, 
                  toFranchiseId: value 
                }))}
                options={[
                  { value: '', label: 'Select a franchise', disabled: true },
                  ...availableFranchises.map(f => ({
                    value: f._id,
                    label: `${f.name} (${f.code})`,
                    subLabel: f.location
                  }))
                ]}
              />
            </div>

            {/* Quantity */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quantity
              </label>
              <Input
                type="number"
                min="1"
                max={product.stockQuantity}
                value={transferData.quantity}
                onChange={(e) => setTransferData(prev => ({ 
                  ...prev, 
                  quantity: parseInt(e.target.value) || 1 
                }))}
              />
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-gray-500">
                  Max: {product.stockQuantity}
                </span>
                <button
                  type="button"
                  onClick={() => setTransferData(prev => ({ 
                    ...prev, 
                    quantity: product.stockQuantity 
                  }))}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Use all available
                </button>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes (Optional)
              </label>
              <Input
                type="text"
                placeholder="Reason for transfer..."
                value={transferData.note}
                onChange={(e) => setTransferData(prev => ({ 
                  ...prev, 
                  note: e.target.value 
                }))}
              />
            </div>

            {/* Summary */}
            {targetFranchise && transferData.quantity > 0 && (
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium text-gray-900">
                    Transfer Summary
                  </div>
                  <Badge variant="success" size="sm">
                    Ready
                  </Badge>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">From:</span>
                    <span className="font-medium">{product.franchise.name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">To:</span>
                    <span className="font-medium">{targetFranchise.name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Quantity:</span>
                    <span className="font-medium">{transferData.quantity}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Remaining Stock:</span>
                    <span className="font-medium">
                      {product.stockQuantity - transferData.quantity}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Error Message */}
            {transferData.quantity > product.stockQuantity && (
              <div className="p-3 bg-red-50 rounded-lg border border-red-200 flex items-start space-x-2">
                <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-red-700">
                  Cannot transfer more than available stock. 
                  Available: {product.stockQuantity}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 rounded-b-xl border-t border-gray-200">
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={transferMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={() => transferMutation.mutate()}
                disabled={
                  !transferData.toFranchiseId ||
                  transferData.quantity <= 0 ||
                  transferData.quantity > product.stockQuantity ||
                  transferMutation.isPending
                }
                loading={transferMutation.isPending}
              >
                <ArrowRightLeft className="h-4 w-4 mr-2" />
                Confirm Transfer
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductTransferModal;