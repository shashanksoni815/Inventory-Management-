import React, { createContext, useContext, useState, useCallback } from "react";
import type { ReactNode } from "react";

interface RefreshContextType {
  refreshKey: number;
  triggerRefresh: () => void;
}

const RefreshContext = createContext<RefreshContextType | undefined>(
  undefined
);

export const RefreshProvider = ({ children }: { children: ReactNode }) => {
  const [refreshKey, setRefreshKey] = useState(0);
  const isRefreshingRef = React.useRef(false);

  const triggerRefresh = useCallback(() => {
    // Prevent rapid successive calls (debounce)
    if (isRefreshingRef.current) {
      return;
    }

    try {
      isRefreshingRef.current = true;
      setRefreshKey((prev) => {
        const newKey = prev + 1;
        // Reset refreshing flag after a short delay to allow queries to start
        setTimeout(() => {
          isRefreshingRef.current = false;
        }, 500);
        return newKey;
      });
    } catch (error) {
      isRefreshingRef.current = false;
      throw error;
    }
  }, []);

  return (
    <RefreshContext.Provider value={{ refreshKey, triggerRefresh }}>
      {children}
    </RefreshContext.Provider>
  );
};

export const useRefresh = () => {
  const context = useContext(RefreshContext);
  if (!context) {
    throw new Error("useRefresh must be used inside RefreshProvider");
  }
  return context;
};
