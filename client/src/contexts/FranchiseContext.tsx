// src/contexts/FranchiseContext.tsx
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { franchiseApi } from '@/services/api';
// import { Franchise } from '@/types';    

interface FranchiseContextType {
  // State
  currentFranchise: Franchise | null;
  franchises: Franchise[];
  isLoading: boolean;
  isNetworkView: boolean;
  
  // Actions
  switchFranchise: (franchiseId: string | null) => void;
  switchToNetworkView: () => void;
  refreshFranchises: () => Promise<void>;
  getFranchiseById: (id: string) => Franchise | undefined;
  setCurrentFranchise: (franchise: Franchise | null) => void;
  
  // Derived state
  franchiseStats: {
    totalRevenue: number;
    totalFranchises: number;
    activeFranchises: number;
    averagePerformance: number;
    topPerformingFranchise: Franchise | null;
  };
}

const FranchiseContext = createContext<FranchiseContextType | undefined>(undefined);

interface FranchiseProviderProps {
  children: ReactNode;
}

export const FranchiseProvider: React.FC<FranchiseProviderProps> = ({ children }) => {
  // State
  const [currentFranchise, setCurrentFranchise] = useState<Franchise | null>(null);
  const [isNetworkView, setIsNetworkView] = useState<boolean>(true);
  const [selectedFranchiseId, setSelectedFranchiseId] = useState<string | null>(null);

  // Fetch franchises data
  const { 
    data: franchises = [], 
    isLoading, 
    refetch 
  } = useQuery({
    queryKey: ['franchises'],
    queryFn: async () => {
      try {
        const response = await franchiseApi.getAll();
        // API interceptor unwraps `{ success, data }` and returns the inner payload.
        // That means `response` is already the array in the happy path.
        return Array.isArray(response)
          ? response
          : ((response as { data?: Franchise[] })?.data ?? []);
      } catch (error) {
        console.error('Failed to fetch franchises:', error);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Calculate franchise statistics
  const franchiseStats = React.useMemo(() => {
    const activeFranchises = franchises.filter(f => f.status === 'active');
    const totalRevenue = activeFranchises.reduce((sum, f) => sum + (f.salesToday || 0), 0);
    const averagePerformance = activeFranchises.length > 0 
      ? activeFranchises.reduce((sum, f) => sum + (f.performance || 0), 0) / activeFranchises.length
      : 0;
    
    const topPerformingFranchise = activeFranchises.length > 0
      ? activeFranchises.reduce((prev, current) => 
          (prev.performance || 0) > (current.performance || 0) ? prev : current
        )
      : null;

    return {
      totalRevenue,
      totalFranchises: franchises.length,
      activeFranchises: activeFranchises.length,
      averagePerformance,
      topPerformingFranchise,
    };
  }, [franchises]);

  // Get franchise by ID
  const getFranchiseById = useCallback((id: string): Franchise | undefined => {
    return franchises.find(f => f._id === id || f.id === id);
  }, [franchises]);

  // Switch to a specific franchise
  const switchFranchise = useCallback((franchiseId: string | null) => {
    if (franchiseId === null) {
      setCurrentFranchise(null);
      setIsNetworkView(true);
      setSelectedFranchiseId(null);
      localStorage.removeItem('selectedFranchiseId');
      return;
    }

    const franchise = getFranchiseById(franchiseId);
    if (franchise) {
      setCurrentFranchise(franchise);
      setIsNetworkView(false);
      setSelectedFranchiseId(franchiseId);
      localStorage.setItem('selectedFranchiseId', franchiseId);
    } else {
      console.warn(`Franchise with ID ${franchiseId} not found`);
    }
  }, [getFranchiseById]);

  // Switch to network view
  const switchToNetworkView = useCallback(() => {
    setCurrentFranchise(null);
    setIsNetworkView(true);
    setSelectedFranchiseId(null);
    localStorage.removeItem('selectedFranchiseId');
  }, []);

  // Refresh franchises data
  const refreshFranchises = useCallback(async () => {
    await refetch();
  }, [refetch]);

  // Load previously selected franchise from localStorage on mount
  useEffect(() => {
    const savedFranchiseId = localStorage.getItem('selectedFranchiseId');
    if (savedFranchiseId && franchises.length > 0) {
      const franchise = getFranchiseById(savedFranchiseId);
      if (franchise) {
        setCurrentFranchise(franchise);
        setIsNetworkView(false);
        setSelectedFranchiseId(savedFranchiseId);
      }
    }
  }, [franchises, getFranchiseById]);

  // Update current franchise when franchises data changes
  useEffect(() => {
    if (selectedFranchiseId && franchises.length > 0) {
      const franchise = getFranchiseById(selectedFranchiseId);
      if (franchise) {
        setCurrentFranchise(franchise);
      } else if (selectedFranchiseId) {
        // If selected franchise no longer exists, switch to network view
        switchToNetworkView();
      }
    }
  }, [franchises, selectedFranchiseId, getFranchiseById, switchToNetworkView]);

  // Context value
  const value: FranchiseContextType = {
    // State
    currentFranchise,
    franchises,
    isLoading,
    isNetworkView,
    
    // Actions
    switchFranchise,
    switchToNetworkView,
    refreshFranchises,
    getFranchiseById,
    setCurrentFranchise,
    
    // Derived state
    franchiseStats,
  };

  return (
    <FranchiseContext.Provider value={value}>
      {children}
    </FranchiseContext.Provider>
  );
};

// Custom hook for using the franchise context
export const useFranchise = (): FranchiseContextType => {
  const context = useContext(FranchiseContext);
  if (!context) {
    throw new Error('useFranchise must be used within a FranchiseProvider');
  }
  return context;
};

// Hook for franchise-specific data fetching
export const useCurrentFranchiseData = <T,>(
  fetchFunction: (franchiseId: string) => Promise<T>,
  options?: {
    enabled?: boolean;
    onSuccess?: (data: T) => void;
    onError?: (error: any) => void;
  }
) => {
  const { currentFranchise } = useFranchise();
  
  return useQuery({
    queryKey: ['franchise-data', currentFranchise?._id],
    queryFn: () => {
      if (!currentFranchise) {
        throw new Error('No franchise selected');
      }
      return fetchFunction(currentFranchise._id || currentFranchise.id);
    },
    enabled: Boolean(currentFranchise && (options?.enabled ?? true)),
    ...options,
  });
};

// Hook for checking franchise permissions
export const useFranchisePermissions = () => {
  const { currentFranchise, isNetworkView } = useFranchise();
  
  return {
    // Permission checks
    canViewFranchise: (franchiseId: string): boolean => {
      // For now, all franchises are viewable
      // In a real app, check user permissions
      return true;
    },
    
    canEditFranchise: (franchiseId: string): boolean => {
      // Only allow editing in network view or if it's the current franchise
      return isNetworkView || currentFranchise?._id === franchiseId || currentFranchise?.id === franchiseId;
    },
    
    canDeleteFranchise: (): boolean => {
      // Only in network view
      return isNetworkView;
    },
    
    canAddSale: (): boolean => {
      // Can add sale if we're in a specific franchise view
      return Boolean(currentFranchise && !isNetworkView);
    },
    
    canViewNetworkAnalytics: (): boolean => {
      // Only in network view
      return isNetworkView;
    },
  };
};

// Utility function for franchise data transformation
export const franchiseUtils = {
  // Format franchise for display
  formatFranchiseName: (franchise: Franchise): string => {
    return `${franchise.name} (${franchise.code})`;
  },
  
  // Get franchise color based on performance
  getFranchiseColor: (performance: number): string => {
    if (performance >= 90) return 'text-green-600';
    if (performance >= 70) return 'text-blue-600';
    if (performance >= 50) return 'text-yellow-600';
    return 'text-red-600';
  },
  
  // Get franchise badge color
  getFranchiseBadgeColor: (performance: number): string => {
    if (performance >= 90) return 'bg-green-100 text-green-800';
    if (performance >= 70) return 'bg-blue-100 text-blue-800';
    if (performance >= 50) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  },
  
  // Sort franchises by performance (descending)
  sortByPerformance: (franchises: Franchise[]): Franchise[] => {
    return [...franchises].sort((a, b) => (b.performance || 0) - (a.performance || 0));
  },
  
  // Filter franchises by status
  filterByStatus: (franchises: Franchise[], status: 'active' | 'inactive'): Franchise[] => {
    return franchises.filter(f => f.status === status);
  },
  
  // Calculate franchise health score
  calculateHealthScore: (franchise: Franchise): number => {
    const weights = {
      performance: 0.4,
      inventoryTurnover: 0.3,
      customerSatisfaction: 0.2,
      compliance: 0.1,
    };
    
    // Simplified calculation - in real app, use actual metrics
    const score = (
      (franchise.performance || 0) * weights.performance +
      (franchise.inventoryTurnover || 50) * weights.inventoryTurnover +
      (franchise.customerSatisfaction || 80) * weights.customerSatisfaction +
      (franchise.complianceScore || 100) * weights.compliance
    );
    
    return Math.min(100, Math.max(0, score));
  },
};