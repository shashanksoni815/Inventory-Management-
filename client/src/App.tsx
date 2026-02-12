import React, { Suspense, lazy, useEffect } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from './lib/queryClient';
import { ThemeProvider } from './components/Common/ThemeProvider';
import ErrorBoundary from './components/Common/ErrorBoundary';
import LoadingSpinner from './components/Common/LoadingSpinner';
import toast, { Toaster } from 'react-hot-toast';
import { FranchiseProvider } from './contexts/FranchiseContext';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/Common/ProtectedRoute';
import type { UserRole } from './types';

// Lazy load pages
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Layout = lazy(() => import('./components/Layout/Layout'));
const Products = lazy(() => import('./pages/Products'));
const Sales = lazy(() => import('./pages/Sales'));
const Reports = lazy(() => import('./pages/Reports'));
const Settings = lazy(() => import('./pages/Settings'));
const FranchiseDashboard = lazy(() => import('./pages/FranchiseDashboard'));
const FranchiseSalesDashboard = lazy(() => import('./pages/FranchiseSalesDashboard'));
const FranchiseImportsDashboard = lazy(() => import('./pages/FranchiseImportsDashboard'));
const FranchiseProfitLoss = lazy(() => import('./pages/FranchiseProfitLoss'));
const NetworkDashboard = lazy(() => import('./pages/NetworkDashboard'));
const FranchiseSettings = lazy(() => import('./components/Franchise/FranchiseSettings'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const Orders = lazy(() => import('./pages/Orders'));
const OrderDetails = lazy(() => import('./pages/OrderDetails'));
const CreateOrder = lazy(() => import('./pages/CreateOrder'));
const OrderEdit = lazy(() => import('./pages/OrderEdit'));
const Unauthorized = lazy(() => import('./pages/Unauthorized'));

// Scroll to top on route change
const ScrollToTop = () => {
  const { pathname } = useLocation();
  
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  
  return null;
};

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <Router>
              <ScrollToTop />
              <Suspense fallback={<LoadingSpinner fullScreen />}>
                <Routes>
                  {/* Public routes */}
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/unauthorized" element={<Unauthorized />} />
                  
                  {/* Protected routes */}
                  <Route
                    path="/"
                    element={
                      <ProtectedRoute>
                        <FranchiseProvider>
                          <Layout />
                        </FranchiseProvider>
                      </ProtectedRoute>
                    }
                  >
                    {/* Default redirect based on role */}
                    <Route 
                      index 
                      element={
                        <ProtectedRoute>
                          <Navigate 
                            to={
                              (() => {
                                try {
                                  const raw = localStorage.getItem('user');
                                  const user = raw ? (JSON.parse(raw) as { role?: UserRole }) : null;
                                  return user?.role === 'admin' ? '/dashboard' : '/products';
                                } catch {
                                  return '/products';
                                }
                              })()
                            } 
                            replace 
                          />
                        </ProtectedRoute>
                      } 
                    />
                    
                    {/* Admin-only routes */}
                    <Route
                      path="dashboard"
                      element={
                        <ProtectedRoute roles={['admin']}>
                          <AdminDashboard />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="admin/dashboard"
                      element={
                        <ProtectedRoute roles={['admin']}>
                          <AdminDashboard />
                        </ProtectedRoute>
                      }
                    />
                    
                    {/* Admin and Manager routes */}
                    <Route path="reports" element={
                      <ProtectedRoute roles={['admin', 'manager']}>
                        <Reports />
                      </ProtectedRoute>
                    } />
                    
                    {/* All authenticated users (admin, manager, sales) */}
                    <Route path="products" element={
                      <ProtectedRoute roles={['admin', 'manager', 'sales']}>
                        <Products />
                      </ProtectedRoute>
                    } />
                    <Route path="sales" element={
                      <ProtectedRoute roles={['admin', 'manager', 'sales']}>
                        <Sales />
                      </ProtectedRoute>
                    } />
                    <Route path="orders" element={
                      <ProtectedRoute roles={['admin', 'manager', 'sales']}>
                        <Orders />
                      </ProtectedRoute>
                    } />
                    <Route path="orders/new" element={
                      <ProtectedRoute roles={['admin', 'manager', 'sales']}>
                        <CreateOrder />
                      </ProtectedRoute>
                    } />
                    <Route path="orders/:orderId" element={
                      <ProtectedRoute roles={['admin', 'manager', 'sales']}>
                        <OrderDetails />
                      </ProtectedRoute>
                    } />
                    <Route path="orders/:orderId/edit" element={
                      <ProtectedRoute roles={['admin', 'manager', 'sales']}>
                        <OrderEdit />
                      </ProtectedRoute>
                    } />
                    <Route path="settings" element={
                      <ProtectedRoute>
                        <Settings />
                      </ProtectedRoute>
                    } />
                    <Route path="franchises" element={
                      <ProtectedRoute roles={['admin', 'manager', 'sales']}>
                        <NetworkDashboard />
                      </ProtectedRoute>
                    } />
                    
                    {/* Franchise routes - accessible to all authenticated users */}
                    <Route path="franchise/:franchiseId/sales" element={
                      <ProtectedRoute roles={['admin', 'manager', 'sales']}>
                        <FranchiseSalesDashboard />
                      </ProtectedRoute>
                    } />
                    <Route path="franchise/:franchiseId/imports" element={
                      <ProtectedRoute roles={['admin', 'manager', 'sales']}>
                        <FranchiseImportsDashboard />
                      </ProtectedRoute>
                    } />
                    <Route path="franchise/:franchiseId/profit-loss" element={
                      <ProtectedRoute roles={['admin', 'manager', 'sales']}>
                        <FranchiseProfitLoss />
                      </ProtectedRoute>
                    } />
                    <Route path="franchise/:franchiseId/settings" element={
                      <ProtectedRoute roles={['admin', 'manager']}>
                        <FranchiseSettings />
                      </ProtectedRoute>
                    } />
                    <Route path="franchise/:franchiseId" element={
                      <ProtectedRoute roles={['admin', 'manager', 'sales']}>
                        <FranchiseDashboard />
                      </ProtectedRoute>
                    } />
                  </Route>
                  
                  {/* 404 - redirect based on authentication */}
                  <Route 
                    path="*" 
                    element={
                      <Navigate 
                        to={
                          (() => {
                            try {
                              const raw = localStorage.getItem('user');
                              const user = raw ? (JSON.parse(raw) as { role?: UserRole }) : null;
                              if (!user) return '/login';
                              return user?.role === 'admin' ? '/dashboard' : '/products';
                            } catch {
                              return '/login';
                            }
                          })()
                        } 
                        replace 
                      />
                    } 
                  />
                </Routes>
              </Suspense>
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: '#363636',
                  color: '#fff',
                },
                success: {
                  duration: 3000,
                  iconTheme: {
                    primary: '#10B981',
                    secondary: '#fff',
                  },
                },
                error: {
                  duration: 4000,
                  iconTheme: {
                    primary: '#EF4444',
                    secondary: '#fff',
                  },
                },
              }}
            />
            <ReactQueryDevtools initialIsOpen={false} />
          </Router>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;