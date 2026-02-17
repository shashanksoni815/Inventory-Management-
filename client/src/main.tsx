import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import App from './App';
import './index.css';

// Suppress browser extension errors (React DevTools, etc.)
if (typeof window !== 'undefined') {
  const originalError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    const errorMessage = String(args[0] || '');
    // Suppress known browser extension errors
    if (
      errorMessage.includes('disconnected port object') ||
      errorMessage.includes('proxy.js') ||
      errorMessage.includes('Extension context invalidated') ||
      errorMessage.includes('Message port closed') ||
      errorMessage.includes('react_devtools_backend')
    ) {
      return; // Silently ignore extension-related errors
    }
    originalError(...args);
  };

  // Global error handler to catch and suppress extension errors
  window.addEventListener('error', (event) => {
    const errorMessage = event.message || '';
    if (
      errorMessage.includes('disconnected port object') ||
      errorMessage.includes('proxy.js') ||
      errorMessage.includes('Extension context invalidated') ||
      errorMessage.includes('Message port closed') ||
      errorMessage.includes('react_devtools_backend')
    ) {
      event.preventDefault(); // Suppress the error
      return false;
    }
  }, true);

  // Handle unhandled promise rejections from extensions
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const errorMessage = reason?.message || String(reason || '');
    if (
      errorMessage.includes('disconnected port object') ||
      errorMessage.includes('proxy.js') ||
      errorMessage.includes('Extension context invalidated') ||
      errorMessage.includes('Message port closed') ||
      errorMessage.includes('react_devtools_backend')
    ) {
      event.preventDefault(); // Suppress the error
    }
  });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000, // 30 seconds
      gcTime: 600000, // 10 minutes (formerly cacheTime in v4)
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      {import.meta.env.DEV && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  </React.StrictMode>
);