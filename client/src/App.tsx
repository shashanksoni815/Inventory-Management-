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
import { Toaster } from 'react-hot-toast';
import { FranchiseProvider } from './contexts/FranchiseContext';

// Lazy load pages
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Layout = lazy(() => import('./components/Layout/Layout'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
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

// Protected route wrapper
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const token = localStorage.getItem('token');
  
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

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
          <Router>
            <ScrollToTop />
            <Suspense fallback={<LoadingSpinner fullScreen />}>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
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
                  <Route index element={<Navigate to="/dashboard" replace />} />
                  <Route path="dashboard" element={<Dashboard />} />
                  <Route path="products" element={<Products />} />
                  <Route path="sales" element={<Sales />} />
                  <Route path="reports" element={<Reports />} />
                  <Route path="settings" element={<Settings />} />
                  <Route path="franchises" element={<NetworkDashboard />} />
                  <Route path="franchise/:franchiseId" element={<FranchiseDashboard />} />
                  <Route path="franchise/:franchiseId/sales" element={<FranchiseSalesDashboard />} />
                  <Route path="franchise/:franchiseId/imports" element={<FranchiseImportsDashboard />} />
                  <Route path="franchise/:franchiseId/profit-loss" element={<FranchiseProfitLoss />} />
                  <Route path="franchise/:franchiseId/settings" element={<FranchiseSettings />} />
                </Route>
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
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