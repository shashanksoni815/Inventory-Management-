import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import type { UserRole } from '@/types';
import LoadingSpinner from './LoadingSpinner';

interface ProtectedRouteProps {
  children: React.ReactNode;
  roles?: UserRole[];
}

/**
 * ProtectedRoute Component
 * 
 * Protects routes by checking authentication and optionally role-based authorization.
 * 
 * @param children - The component(s) to render if access is granted
 * @param roles - Optional array of allowed roles. If provided, user role must be in this array.
 * 
 * Behavior:
 * - If no user is authenticated: redirects to /login
 * - If roles are provided and user role is not in the array: redirects to /unauthorized
 * - If user is authenticated and (no roles specified OR user role is allowed): renders children
 * 
 * Usage examples:
 * ```tsx
 * // Require authentication only
 * <ProtectedRoute>
 *   <Dashboard />
 * </ProtectedRoute>
 * 
 * // Require admin role
 * <ProtectedRoute roles={['admin']}>
 *   <AdminDashboard />
 * </ProtectedRoute>
 * 
 * // Require admin or manager role
 * <ProtectedRoute roles={['admin', 'manager']}>
 *   <ManagerDashboard />
 * </ProtectedRoute>
 * ```
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, roles }) => {
  const { user, isLoading, isAuthenticated } = useAuth();

  // Show loading spinner while checking authentication
  if (isLoading) {
    return <LoadingSpinner fullScreen />;
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  // If roles are specified, check if user role is allowed
  if (roles && roles.length > 0) {
    const userRole = user.role;
    
    if (!roles.includes(userRole)) {
      // User role is not in the allowed roles list
      return <Navigate to="/unauthorized" replace />;
    }
  }

  // User is authenticated and (no roles specified OR role is allowed)
  return <>{children}</>;
};

export default ProtectedRoute;
