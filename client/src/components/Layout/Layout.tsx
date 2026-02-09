import React, { useState, useEffect, useRef } from 'react';
import { Outlet, useNavigate, useLocation, useMatch } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  BarChart3,
  Settings,
  Menu,
  X,
  Bell,
  Search,
  User,
  LogOut,
  ChevronDown,
  Store,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFranchise } from '@/contexts/FranchiseContext';

const Layout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const {
    currentFranchise,
    franchises,
    switchFranchise,
    switchToNetworkView,
  } = useFranchise();

  // Sync context with URL: when franchiseId in route changes, update context to prevent stale data
  const franchiseMatch = useMatch('/franchise/:franchiseId/*');
  const franchiseIdFromRoute = franchiseMatch?.params?.franchiseId;
  useEffect(() => {
    if (franchiseIdFromRoute) {
      switchFranchise(franchiseIdFromRoute);
    }
  }, [franchiseIdFromRoute, switchFranchise]);

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Franchises', href: '/franchises', icon: Store },
    { name: 'Products', href: '/products', icon: Package },
    { name: 'Sales', href: '/sales', icon: ShoppingCart },
    { name: 'Reports', href: '/reports', icon: BarChart3 },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  // Close user menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    if (userMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [userMenuOpen]);

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="flex min-h-screen bg-white">
      {/* Mobile sidebar overlay + drawer */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/50 lg:hidden"
              onClick={() => setSidebarOpen(false)}
              aria-hidden="true"
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'tween', duration: 0.2 }}
              className="fixed inset-y-0 left-0 z-50 w-64 max-w-[85vw] bg-white shadow-xl lg:hidden"
            >
              <div className="flex h-16 items-center justify-between border-b border-gray-200 px-4">
                <div className="flex items-center space-x-2">
                  <div className="h-8 w-8 rounded-lg bg-blue-600" />
                  <span className="text-xl font-bold text-gray-900">
                    InventoryPro
                  </span>
                </div>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="p-4">
                {navigation.map((item) => (
                  <button
                    key={item.name}
                    onClick={() => {
                      if (item.href === '/franchises') {
                        switchToNetworkView();
                      }
                      navigate(item.href);
                      setSidebarOpen(false);
                    }}
                    className={`flex w-full items-center space-x-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${isActive(item.href) ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-100'}`}
                  >
                    <item.icon className="h-5 w-5" />
                    <span>{item.name}</span>
                  </button>
                ))}
                {franchises.length > 0 && (
                  <div className="mt-6">
                    <p className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                      Franchises
                    </p>
                    {franchises.map((f) => (
                      <button
                        key={f._id}
                        onClick={() => {
                          // IMPORTANT: Always use franchise._id (MongoDB ObjectId) for routing
                          // NEVER use franchise.code or numeric IDs in routes
                          switchFranchise(f._id);
                          navigate(`/franchise/${f._id}`);
                          setSidebarOpen(false);
                        }}
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                          location.pathname === `/franchise/${f._id}`
                            ? 'bg-blue-50 text-blue-600'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <span className="truncate">{f.name}</span>
                        {/* Display franchise code for UI only - NOT used for routing */}
                        <span className="ml-2 text-xs text-gray-400">{f.code}</span>
                      </button>
                    ))}
                  </div>
                )}
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Desktop sidebar - fixed position */}
      <aside
        className={cn(
          'hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:w-64',
          'border-r border-gray-200 bg-white',
          'flex-shrink-0'
        )}
      >
        <div className="flex h-16 items-center border-b border-gray-200 px-4 sm:px-6">
          <div className="flex items-center space-x-2 min-w-0">
            <div className="h-8 w-8 flex-shrink-0 rounded-lg bg-blue-600" />
            <span className="text-lg font-bold text-gray-900 truncate">
              InventoryPro
            </span>
          </div>
          {currentFranchise && (
            <div className="ml-auto text-right">
              <p className="text-xs text-gray-500">Franchise</p>
              <p className="text-sm font-semibold text-gray-900 truncate" title={currentFranchise.name}>
                {currentFranchise.name}
              </p>
            </div>
          )}
        </div>
        <nav className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            {navigation.map((item) => (
              <button
                key={item.name}
                onClick={() => {
                  if (item.href === '/franchises') {
                    switchToNetworkView();
                  }
                  navigate(item.href);
                }}
                className={cn(
                  'flex w-full items-center space-x-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive(item.href)
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-700 hover:bg-gray-100'
                )}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                <span className="truncate">{item.name}</span>
              </button>
            ))}
          </div>
          {franchises.length > 0 && (
            <div>
              <p className="px-1 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Franchises
              </p>
              <div className="space-y-1">
                {franchises.map((f) => (
                  <button
                    key={f._id}
                    onClick={() => {
                      // IMPORTANT: Always use franchise._id (MongoDB ObjectId) for routing
                      // NEVER use franchise.code or numeric IDs in routes
                      switchFranchise(f._id);
                      navigate(`/franchise/${f._id}`);
                    }}
                    className={cn(
                      'flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      location.pathname === `/franchise/${f._id}`
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-gray-700 hover:bg-gray-100'
                    )}
                  >
                    <span className="truncate">{f.name}</span>
                    {/* Display franchise code for UI only - NOT used for routing */}
                    <span className="ml-2 text-xs text-gray-400">{f.code}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </nav>
      </aside>

      {/* Main content - offset by sidebar on desktop */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        {/* Top navigation */}
        <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
          <div className="flex h-14 sm:h-16 items-center justify-between gap-2 px-3 sm:px-4 lg:px-6">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
              <button
                onClick={() => setSidebarOpen(true)}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 lg:hidden flex-shrink-0"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="relative w-full max-w-xs sm:max-w-md min-w-0">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  type="search"
                  placeholder="Search inventory..."
                  className="w-full rounded-lg border border-gray-300 bg-gray-50 py-2 pl-9 pr-3 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            <div className="flex items-center gap-1 sm:gap-3 flex-shrink-0">
              {/* Notifications */}
              <div className="relative">
                <button className="relative rounded-lg p-2 text-gray-500 hover:bg-gray-100">
                  <Bell className="h-5 w-5" />
                  <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />
                </button>
              </div>

              {/* User menu */}
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center space-x-2 sm:space-x-3 rounded-lg p-2 hover:bg-gray-100"
                  aria-expanded={userMenuOpen}
                  aria-haspopup="true"
                >
                  <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <User className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="hidden text-left lg:block">
                    <p className="text-sm font-medium text-gray-900">
                      Admin User
                    </p>
                    <p className="text-xs text-gray-500">
                      Administrator
                    </p>
                  </div>
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                </button>

                <AnimatePresence>
                  {userMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-2 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg z-50"
                    >
                      <button className="flex w-full items-center space-x-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                        <Settings className="h-4 w-4" />
                        <span>Settings</span>
                      </button>
                      <button
                        onClick={handleLogout}
                        className="flex w-full items-center space-x-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                      >
                        <LogOut className="h-4 w-4" />
                        <span>Logout</span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </header>

        {/* Page content - responsive padding */}
        <main className="flex-1 p-3 sm:p-4 lg:p-6 overflow-x-hidden">
          <Outlet />
        </main>

        {/* Footer - responsive */}
        <footer className="border-t border-gray-200 bg-white px-3 py-3 sm:px-4 sm:py-4 lg:px-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs sm:text-sm text-gray-500">
              © {new Date().getFullYear()} InventoryPro. All rights reserved.
            </p>
            <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm text-gray-500">
              <span className="hidden lg:inline">v1.0.0</span>
              <span>Last updated: Just now</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default Layout;