import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { productApi } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { Package, Tag, DollarSign, FileText, Building2, AlertCircle } from 'lucide-react';

interface PublicProductData {
  image: string | null;
  name: string;
  sku: string;
  category: string;
  sellingPrice: number;
  taxPercentage: number;
  description: string;
  brand: string;
  isInStock: boolean; // Changed from stockQuantity - only availability status, not exact quantity
  franchise: { name: string; code: string } | null; // No internal IDs exposed
}

const PublicProduct: React.FC = () => {
  const { sku } = useParams<{ sku: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [product, setProduct] = useState<PublicProductData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  // Check authentication and redirect if logged in
  useEffect(() => {
    // Wait for auth to finish loading
    if (authLoading) return;

    // Check if user is authenticated (has token)
    const token = localStorage.getItem('token');
    const isLoggedIn = isAuthenticated || (token && token.trim() !== '');

    if (isLoggedIn && sku) {
      // User is logged in - redirect to internal products page with SKU filter
      setRedirecting(true);
      // Redirect to products page with search query for the SKU
      navigate(`/products?search=${encodeURIComponent(sku)}`, { replace: true });
      return;
    }
  }, [isAuthenticated, authLoading, sku, navigate]);

  useEffect(() => {
    // Don't fetch if redirecting
    if (redirecting) return;

    const fetchProduct = async () => {
      if (!sku) {
        setError('SKU is required');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await productApi.getPublicBySku(sku);
        if (response.success && response.data) {
          setProduct(response.data);
        } else {
          setError('Product not found');
        }
      } catch (err: any) {
        setError(err?.message || 'Failed to load product');
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [sku, redirecting]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const calculatePriceWithTax = () => {
    if (!product) return 0;
    const taxAmount = (product.sellingPrice * product.taxPercentage) / 100;
    return product.sellingPrice + taxAmount;
  };

  // Show loading or redirecting state
  if (authLoading || redirecting || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">
            {redirecting ? 'Redirecting to app...' : 'Loading product information...'}
          </p>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Product Not Found</h1>
          <p className="text-gray-600">{error || 'The product you are looking for does not exist.'}</p>
        </div>
      </div>
    );
  }

  const totalPrice = calculatePriceWithTax();

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Product Details Table - Structured Format */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-6 sm:p-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6">Product Details</h1>
            
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <tbody className="divide-y divide-gray-200">
                  {/* Product Image */}
                  <tr className="hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-4 sm:px-6 font-semibold text-gray-700 align-top w-1/3 sm:w-1/4">
                      Product Image
                    </td>
                    <td className="py-4 px-4 sm:px-6 text-gray-900">
                      {product.image ? (
                        <img
                          src={product.image}
                          alt={product.name}
                          className="w-32 h-32 sm:w-40 sm:h-40 object-cover rounded-lg border border-gray-200"
                        />
                      ) : (
                        <div className="w-32 h-32 sm:w-40 sm:h-40 bg-gray-100 rounded-lg flex items-center justify-center border border-gray-200">
                          <Package className="h-12 w-12 sm:h-16 sm:w-16 text-gray-400" />
                        </div>
                      )}
                    </td>
                  </tr>

                  {/* Product Name */}
                  <tr className="hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-4 sm:px-6 font-semibold text-gray-700 align-top">
                      Product Name
                    </td>
                    <td className="py-4 px-4 sm:px-6 text-gray-900">
                      <div>
                        <span className="text-lg font-medium">{product.name}</span>
                        {product.brand && (
                          <span className="text-gray-600 ml-2">by {product.brand}</span>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* SKU */}
                  <tr className="hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-4 sm:px-6 font-semibold text-gray-700 align-top">
                      SKU
                    </td>
                    <td className="py-4 px-4 sm:px-6 text-gray-900">
                      <span className="font-mono text-sm bg-gray-50 px-2 py-1 rounded border border-gray-200">
                        {product.sku}
                      </span>
                    </td>
                  </tr>

                  {/* Category */}
                  <tr className="hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-4 sm:px-6 font-semibold text-gray-700 align-top">
                      Category
                    </td>
                    <td className="py-4 px-4 sm:px-6 text-gray-900">
                      {product.category}
                    </td>
                  </tr>

                  {/* Base Price */}
                  <tr className="hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-4 sm:px-6 font-semibold text-gray-700 align-top">
                      Base Price
                    </td>
                    <td className="py-4 px-4 sm:px-6 text-gray-900">
                      <span className="text-lg font-semibold">
                        {formatCurrency(product.sellingPrice)}
                      </span>
                    </td>
                  </tr>

                  {/* Tax Percentage */}
                  <tr className="hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-4 sm:px-6 font-semibold text-gray-700 align-top">
                      Tax Percentage
                    </td>
                    <td className="py-4 px-4 sm:px-6 text-gray-900">
                      {product.taxPercentage > 0 ? (
                        <span className="text-gray-700">{product.taxPercentage}%</span>
                      ) : (
                        <span className="text-gray-500">No tax</span>
                      )}
                    </td>
                  </tr>

                  {/* Total Price (calculated) */}
                  <tr className="hover:bg-gray-50 transition-colors bg-blue-50/30">
                    <td className="py-4 px-4 sm:px-6 font-semibold text-gray-700 align-top">
                      Total Price
                    </td>
                    <td className="py-4 px-4 sm:px-6">
                      <span className="text-2xl font-bold text-blue-600">
                        {formatCurrency(totalPrice)}
                      </span>
                      {product.taxPercentage > 0 && (
                        <span className="text-sm text-gray-600 ml-2">
                          (Base: {formatCurrency(product.sellingPrice)} + Tax: {formatCurrency(totalPrice - product.sellingPrice)})
                        </span>
                      )}
                    </td>
                  </tr>

                  {/* Stock Availability (Security: Only status, not exact quantities) */}
                  <tr className="hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-4 sm:px-6 font-semibold text-gray-700 align-top">
                      Availability
                    </td>
                    <td className="py-4 px-4 sm:px-6">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                          product.isInStock
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {product.isInStock ? 'In Stock' : 'Out of Stock'}
                      </span>
                    </td>
                  </tr>

                  {/* Franchise Name (optional) */}
                  {product.franchise && (
                    <tr className="hover:bg-gray-50 transition-colors">
                      <td className="py-4 px-4 sm:px-6 font-semibold text-gray-700 align-top">
                        Franchise Name
                      </td>
                      <td className="py-4 px-4 sm:px-6 text-gray-900">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-gray-500" />
                          <span>{product.franchise.name}</span>
                          <span className="text-gray-500 text-sm">({product.franchise.code})</span>
                        </div>
                      </td>
                    </tr>
                  )}

                  {/* Description */}
                  <tr className="hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-4 sm:px-6 font-semibold text-gray-700 align-top">
                      Description
                    </td>
                    <td className="py-4 px-4 sm:px-6 text-gray-900">
                      {product.description ? (
                        <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                          {product.description}
                        </p>
                      ) : (
                        <span className="text-gray-400 italic">No description available</span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublicProduct;
