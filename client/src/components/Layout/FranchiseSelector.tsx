// components/Layout/FranchiseSelector.tsx
import React, { useState } from 'react';
import { 
  Store, 
  Plus, 
  ChevronDown, 
  Globe,
  Check,
  TrendingUp,
  DollarSign
} from 'lucide-react';
import { useFranchise } from '../../contexts/FranchiseContext';
import { useQuery } from '@tanstack/react-query';
import { franchiseApi } from '../../services/api';

const FranchiseSelector: React.FC = () => {
  const {
    currentFranchise,
    franchises,
    isNetworkView,
    switchFranchise,
    switchToNetworkView,
    getFranchiseColor,
    getFranchiseIcon
  } = useFranchise();

  const [isOpen, setIsOpen] = useState(false);

  // Fetch franchise performance data
  const { data: performanceData } = useQuery({
    queryKey: ['franchises-performance'],
    queryFn: () => franchiseApi.getNetworkStats(),
    enabled: !isNetworkView,
  });

  // Get franchise performance from network stats
  const getFranchisePerformance = (franchiseId: string): number => {
    if (!performanceData?.data?.franchisePerformance) return 0;
    const franchise = performanceData.data.franchisePerformance.find(
      (fp: any) => fp._id === franchiseId
    );
    if (!franchise) return 0;
    
    // Calculate performance as percentage of max revenue
    const maxRevenue = Math.max(
      ...performanceData.data.franchisePerformance.map((fp: any) => fp.totalRevenue || 0)
    );
    return maxRevenue > 0 ? (franchise.totalRevenue / maxRevenue) * 100 : 0;
  };

  return (
    <div className="relative">
      {/* Current Selection */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-gray-200 hover:border-gray-300 bg-white transition-colors"
      >
        <div className="flex items-center space-x-3">
          {isNetworkView ? (
            <>
              <div className="p-2 bg-blue-100 rounded-lg">
                <Globe className="h-5 w-5 text-blue-600" />
              </div>
              <div className="text-left">
                <div className="font-medium text-gray-900">Network Dashboard</div>
                <div className="text-sm text-gray-500">All Franchises</div>
              </div>
            </>
          ) : currentFranchise ? (
            <>
              <div 
                className="p-2 rounded-lg"
                style={{ backgroundColor: `${getFranchiseColor(currentFranchise._id)}20` }}
              >
                <span className="text-lg">{getFranchiseIcon(currentFranchise._id)}</span>
              </div>
              <div className="text-left">
                <div className="font-medium text-gray-900">{currentFranchise.name}</div>
                <div className="text-sm text-gray-500">{currentFranchise.code}</div>
              </div>
            </>
          ) : null}
        </div>
        <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl border border-gray-200 shadow-lg z-50 max-h-96 overflow-y-auto">
          {/* Network View Option */}
          <div
            onClick={() => {
              switchToNetworkView();
              setIsOpen(false);
            }}
            className={`flex items-center justify-between px-4 py-3 cursor-pointer transition-colors
              ${isNetworkView 
                ? 'bg-blue-50 border-l-4 border-blue-500' 
                : 'hover:bg-gray-50'
              }`}
          >
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Globe className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="font-medium text-gray-900">Network Dashboard</div>
                <div className="text-sm text-gray-500">View all franchises</div>
              </div>
            </div>
            {isNetworkView && <Check className="h-5 w-5 text-blue-600" />}
          </div>

          <div className="px-4 py-2">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Franchises ({franchises.length})
            </div>
          </div>

          {/* Franchise List */}
          <div className="px-2 pb-2">
            {franchises.map((franchise) => {
              const performance = getFranchisePerformance(franchise._id);
              const isActive = franchise.status === 'active';
              const isSelected = currentFranchise?._id === franchise._id;

              return (
                <div
                  key={franchise._id}
                  onClick={() => {
                    // IMPORTANT: Always use franchise._id (MongoDB ObjectId) for routing
                    // NEVER use franchise.code or numeric IDs in routes
                    switchFranchise(franchise._id);
                    setIsOpen(false);
                  }}
                  className={`flex items-center justify-between px-3 py-3 rounded-lg cursor-pointer transition-colors mb-1
                    ${isSelected 
                      ? 'bg-blue-50 border-l-4 border-blue-500' 
                      : 'hover:bg-gray-50'
                    }`}
                >
                  <div className="flex items-center space-x-3">
                    <div 
                      className="p-2 rounded-lg relative"
                      style={{ backgroundColor: `${getFranchiseColor(franchise._id)}20` }}
                    >
                      <span className="text-lg">{getFranchiseIcon(franchise._id)}</span>
                      <div className={`absolute -top-1 -right-1 h-3 w-3 rounded-full border-2 border-white
                        ${isActive ? 'bg-green-500' : 'bg-gray-400'}`}
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-2">
                        <div className="font-medium text-gray-900 truncate">
                          {franchise.name}
                        </div>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full
                          ${isActive 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                          }`}>
                          {franchise.status}
                        </span>
                      </div>
                      <div className="text-sm text-gray-500 truncate">
                        {franchise.code} • {franchise.location}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    {/* Performance indicator */}
                    {performance > 0 && (
                      <div className="flex items-center space-x-1">
                        <TrendingUp className={`h-4 w-4
                          ${performance >= 80 ? 'text-green-600' :
                            performance >= 50 ? 'text-yellow-600' :
                            'text-red-600'
                          }`}
                        />
                        <span className="text-sm font-medium text-gray-900">
                          {Math.round(performance)}%
                        </span>
                      </div>
                    )}

                    {/* Today's sales indicator */}
                    {franchise.stats?.todayRevenue > 0 && (
                      <div className="flex items-center space-x-1">
                        <DollarSign className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium text-gray-900">
                          {franchise.stats.todayRevenue.toLocaleString('en-US', {
                            style: 'currency',
                            currency: 'USD',
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0
                          })}
                        </span>
                      </div>
                    )}

                    {isSelected && <Check className="h-5 w-5 text-blue-600" />}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add New Franchise Button (Admin only) */}
          <div className="border-t border-gray-200 p-3">
            <button className="w-full flex items-center justify-center space-x-2 px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
              <Plus className="h-4 w-4" />
              <span>Add New Franchise</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FranchiseSelector;