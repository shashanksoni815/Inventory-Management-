import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(
  amount: number,
  currency: string = 'INR',
  locale: string = 'en-IN'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(
  date: Date | string,
  format: 'short' | 'medium' | 'long' | 'relative' = 'medium'
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  switch (format) {
    case 'short':
      return dateObj.toLocaleDateString('en-IN', {
        month: 'short',
        day: 'numeric',
      });
    case 'medium':
      return dateObj.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    case 'long':
        return dateObj.toLocaleDateString('en-IN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    case 'relative':
      const now = new Date();
      const diffMs = now.getTime() - dateObj.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays} days ago`;
      if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
      if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
      return `${Math.floor(diffDays / 365)} years ago`;
    default:
      return dateObj.toISOString();
  }
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function generateSKU(category: string): string {
  const prefix = category.slice(0, 3).toUpperCase();
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

/** Order status badge colors (light theme): Pending=Yellow, Confirmed=Blue, Delivered=Green, Cancelled=Red */
export function orderStatusBadgeClass(status: string): string {
  switch (status) {
    case 'Pending':
      return 'bg-yellow-100 text-yellow-800';
    case 'Confirmed':
    case 'Packed':
    case 'Shipped':
      return 'bg-blue-100 text-blue-800';
    case 'Delivered':
      return 'bg-green-100 text-green-800';
    case 'Cancelled':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

export function calculateProfit(
  buyingPrice: number,
  sellingPrice: number,
  quantity: number = 1
): {
  profit: number;
  profitMargin: number;
  revenue: number;
} {
  const revenue = sellingPrice * quantity;
  const cost = buyingPrice * quantity;
  const profit = revenue - cost;
  const profitMargin = cost > 0 ? (profit / cost) * 100 : 0;
  
  return { profit, profitMargin, revenue };
}

export function getStockStatus(
  quantity: number,
  minimumStock: number
): 'out-of-stock' | 'low-stock' | 'in-stock' {
  if (quantity === 0) return 'out-of-stock';
  if (quantity <= minimumStock) return 'low-stock';
  return 'in-stock';
}