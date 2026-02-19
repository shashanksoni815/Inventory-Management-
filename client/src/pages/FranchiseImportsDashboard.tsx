/**
 * Franchise Import / Export Dashboard
 * Route: /franchise/:franchiseId/imports
 *
 * Includes:
 * - Import & export summary (counts and values)
 * - Transfer history table (all activity)
 * - Source / destination filtering (All | Imports | Exports)
 *
 * STRICT FRANCHISE SCOPING: All transfers filtered to this franchise only.
 */
import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Store,
  Settings,
  ArrowLeft,
  Globe,
  Download,
  Upload,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { franchiseApi, transferApi } from '../services/api';
import { useFranchise } from '../contexts/FranchiseContext';

type TransferFilter = 'all' | 'imports' | 'exports';

const FranchiseImportsDashboard: React.FC = () => {
  const { franchiseId } = useParams<{ franchiseId: string }>();
  const navigate = useNavigate();
  const { switchToNetworkView } = useFranchise();
  const [transferFilter, setTransferFilter] = useState<TransferFilter>('all');

  const handleNetworkView = () => {
    switchToNetworkView();
    navigate('/franchises');
  };

  // Fetch franchise details
  const { data: franchiseData, isPending: franchiseLoading } = useQuery({
    queryKey: ['franchise', franchiseId],
    queryFn: () => franchiseApi.getById(franchiseId!),
    enabled: !!franchiseId,
  });

  // Fetch transfers (import/export) - STRICTLY SCOPED BY FRANCHISE
  const { data: transfersData } = useQuery({
    queryKey: ['franchise-transfers', franchiseId],
    queryFn: () => transferApi.getAll({ franchise: franchiseId }),
    enabled: !!franchiseId,
  });

  // API interceptor returns franchise object directly (no .data wrapper)
  // Extract data properly - interceptor unwraps but TypeScript doesn't know
  const franchise = (franchiseData as any)?.data ?? franchiseData;
  const transfers = Array.isArray(transfersData) ? transfersData : (transfersData as { data?: any[] })?.data || [];

  // Prepare import/export data
  const importExportData = useMemo(() => {
    const imports = transfers.filter((t: any) => t.toFranchise === franchiseId || t.toFranchise?._id === franchiseId);
    const exports = transfers.filter((t: any) => t.fromFranchise === franchiseId || t.fromFranchise?._id === franchiseId);
    
    const importValue = imports.reduce((sum: number, t: any) => {
      const value = t.totalValue || (t.quantity || 0) * (t.unitPrice || 0);
      return sum + value;
    }, 0);
    
    const exportValue = exports.reduce((sum: number, t: any) => {
      const value = t.totalValue || (t.quantity || 0) * (t.unitPrice || 0);
      return sum + value;
    }, 0);
    
    return {
      imports: imports.length,
      exports: exports.length,
      importValue,
      exportValue,
      recentImports: imports.slice(0, 10),
      recentExports: exports.slice(0, 10),
      allTransfers: transfers,
    };
  }, [transfers, franchiseId]);

  // Filter transfers by source/destination (Imports = into this franchise, Exports = out of this franchise)
  const filteredTransfers = useMemo(() => {
    if (transferFilter === 'imports') {
      return importExportData.allTransfers.filter((t: any) => t.toFranchise === franchiseId || t.toFranchise?._id === franchiseId);
    }
    if (transferFilter === 'exports') {
      return importExportData.allTransfers.filter((t: any) => t.fromFranchise === franchiseId || t.fromFranchise?._id === franchiseId);
    }
    return importExportData.allTransfers;
  }, [importExportData.allTransfers, transferFilter, franchiseId]);

  if (franchiseLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-32 bg-gray-200 rounded mb-6"></div>
        </div>
      </div>
    );
  }

  if (!franchise) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <Store className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">Franchise not found</h3>
          <p className="text-gray-600 mt-1">The requested franchise does not exist or you don't have access.</p>
          <button
            onClick={handleNetworkView}
            className="mt-4 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Network View
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Franchise Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
          <div className="mb-4 lg:mb-0">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => navigate(`/franchise/${franchiseId}`)}
                className="p-2 hover:bg-white rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </button>
              <div className="p-3 bg-white rounded-xl shadow-sm">
                <Store className="h-8 w-8 text-blue-600" />
              </div>
              <div>
                <div className="flex items-center space-x-3">
                  <h1 className="text-2xl font-bold text-gray-900">{franchise.name} - Import/Export</h1>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full
                    ${franchise.status === 'active' 
                      ? 'bg-green-100 text-green-800' 
                      : franchise.status === 'maintenance'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-red-100 text-red-800'
                    }`}>
                    {franchise.status.toUpperCase()}
                  </span>
                </div>
                <p className="text-gray-600 mt-1">
                  {franchise.code} • {franchise.location}
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate(`/franchise/${franchiseId}/settings`)}
              className="flex items-center px-4 py-2 text-gray-700 hover:text-gray-900 hover:bg-white rounded-lg transition-colors"
            >
              <Settings className="h-5 w-5 mr-2" />
              Settings
            </button>
            <button
              onClick={handleNetworkView}
              className="flex items-center px-4 py-2 bg-white text-gray-700 hover:bg-gray-50 rounded-lg border border-gray-300 transition-colors"
            >
              <Globe className="h-5 w-5 mr-2" />
              Network View
            </button>
          </div>
        </div>
      </div>

      {/* Import/Export Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Imports</h3>
            <Download className="h-8 w-8 text-green-600" />
          </div>
          <div className="space-y-4">
            <div>
              <div className="text-sm text-gray-600">Total Imports</div>
              <div className="text-3xl font-bold text-gray-900">{importExportData.imports}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Total Value</div>
              <div className="text-2xl font-semibold text-green-600">
                ${importExportData.importValue.toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Exports</h3>
            <Upload className="h-8 w-8 text-blue-600" />
          </div>
          <div className="space-y-4">
            <div>
              <div className="text-sm text-gray-600">Total Exports</div>
              <div className="text-3xl font-bold text-gray-900">{importExportData.exports}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Total Value</div>
              <div className="text-2xl font-semibold text-blue-600">
                ${importExportData.exportValue.toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Import/Export Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Imports */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Imports</h3>
          <div className="space-y-3">
            {importExportData.recentImports.length > 0 ? (
              importExportData.recentImports.map((transfer: any) => (
                <div key={transfer._id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <div>
                    <div className="font-medium text-gray-900">{transfer.product?.name || 'Product'}</div>
                    <div className="text-sm text-gray-600">
                      From: {transfer.fromFranchise?.name || 'N/A'} • Qty: {transfer.quantity || 0}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-green-600">
                      ${((transfer.totalValue || 0) || (transfer.quantity || 0) * (transfer.unitPrice || 0)).toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500">
                      {transfer.createdAt ? new Date(transfer.createdAt).toLocaleDateString() : 'N/A'}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">No imports found</div>
            )}
          </div>
        </div>

        {/* Recent Exports */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Exports</h3>
          <div className="space-y-3">
            {importExportData.recentExports.length > 0 ? (
              importExportData.recentExports.map((transfer: any) => (
                <div key={transfer._id} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <div>
                    <div className="font-medium text-gray-900">{transfer.product?.name || 'Product'}</div>
                    <div className="text-sm text-gray-600">
                      To: {transfer.toFranchise?.name || 'N/A'} • Qty: {transfer.quantity || 0}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-blue-600">
                      ${((transfer.totalValue || 0) || (transfer.quantity || 0) * (transfer.unitPrice || 0)).toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500">
                      {transfer.createdAt ? new Date(transfer.createdAt).toLocaleDateString() : 'N/A'}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">No exports found</div>
            )}
          </div>
        </div>
      </div>

      {/* Transfer History Table with Source/Destination Filtering */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Transfer History</h3>
          <div className="flex rounded-lg border border-gray-200 p-1 bg-gray-50">
            {(['all', 'imports', 'exports'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setTransferFilter(filter)}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors
                  ${transferFilter === filter
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                  }`}
              >
                {filter === 'all' ? 'All' : filter === 'imports' ? 'Imports' : 'Exports'}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">From/To</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Value</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredTransfers.length > 0 ? (
                filteredTransfers.map((transfer: any) => (
                  <tr key={transfer._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      {transfer.toFranchise === franchiseId || transfer.toFranchise?._id === franchiseId ? (
                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                          <Download className="h-3 w-3 mr-1" />
                          Import
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                          <Upload className="h-3 w-3 mr-1" />
                          Export
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {transfer.product?.name || 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{transfer.quantity || 0}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {transfer.toFranchise === franchiseId || transfer.toFranchise?._id === franchiseId
                        ? `From: ${transfer.fromFranchise?.name || 'N/A'}`
                        : `To: ${transfer.toFranchise?.name || 'N/A'}`
                      }
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                      ${((transfer.totalValue || 0) || (transfer.quantity || 0) * (transfer.unitPrice || 0)).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full capitalize
                        ${transfer.status === 'completed' ? 'bg-green-100 text-green-800' :
                          transfer.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          transfer.status === 'rejected' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                        {transfer.status || 'pending'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {transfer.createdAt ? new Date(transfer.createdAt).toLocaleDateString() : 'N/A'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    {transferFilter === 'all' ? 'No transfer activity found' : `No ${transferFilter} found`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default FranchiseImportsDashboard;
