import { api } from './api';
import type { ApiResponse } from '@/types';

/**
 * Report API Service
 * 
 * Handles all report-related API calls including profit & loss reports
 */
export interface FranchiseProfitLossParams {
  franchise: string;
  startDate?: string;
  endDate?: string;
}

export interface ProfitLossSummary {
  totalRevenue: number;
  cogs: number;
  grossProfit: number;
  operatingExpenses: number;
  netProfit: number;
  grossMargin: number;
  netMargin: number;
}

export interface CategoryBreakdown {
  category: string;
  revenue: number;
  cogs: number;
  grossProfit: number;
  netProfit: number;
  quantitySold: number;
  grossMargin: number;
  netMargin: number;
}

export interface FranchiseProfitLossResponse {
  summary: ProfitLossSummary;
  categoryBreakdown: CategoryBreakdown[];
  period: {
    startDate: string;
    endDate: string;
  };
  franchise: string | null;
}

export const reportApi = {
  /**
   * Get franchise-specific profit & loss report
   * 
   * @param params - Query parameters including franchise ID and date range
   * @returns Profit & loss data with summary and category breakdown
   */
  getFranchiseProfitLoss: async (params: FranchiseProfitLossParams): Promise<FranchiseProfitLossResponse> => {
    const response = await api.get<ApiResponse<FranchiseProfitLossResponse>>('/reports/profit-loss', {
      params: {
        franchise: params.franchise,
        startDate: params.startDate,
        endDate: params.endDate,
      },
    });
    // Extract .data (API may return { success, data }); avoid casting AxiosResponse directly
    const data = (response as unknown as { data?: FranchiseProfitLossResponse })?.data ?? response;
    return data as unknown as FranchiseProfitLossResponse;
  },
};

export default reportApi;
