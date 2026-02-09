import React from 'react';
import { useVirtualizer, type VirtualItem } from '@tanstack/react-virtual';
import { motion } from 'framer-motion';

interface VirtualizedTableProps {
  data: any[];
  columns: {
    key: string;
    header: string;
    width?: number;
    render?: (value: any, row: any) => React.ReactNode;
  }[];
  rowHeight?: number;
  loading?: boolean;
}

export const VirtualizedTable: React.FC<VirtualizedTableProps> = ({
  data,
  columns,
  rowHeight = 64,
  loading = false,
}) => {
  const parentRef = React.useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 5,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const totalWidth = columns.reduce((sum, col) => sum + (col.width || 150), 0);

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 w-full bg-gray-200  rounded animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className="relative h-[600px] w-full overflow-auto rounded-lg border border-gray-200 "
      style={{ scrollBehavior: 'smooth' }}
    >
      <div
        style={{
          height: virtualizer.getTotalSize(),
          width: totalWidth,
          position: 'relative',
        }}
      >
        {/* Header */}
        <div
          className="sticky top-0 z-10 flex border-b border-gray-200 bg-gray-50 "
          style={{ width: totalWidth }}
        >
          {columns.map((col) => (
            <div
              key={col.key}
              className="flex-shrink-0 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 "
              style={{ width: col.width || 150 }}
            >
              {col.header}
            </div>
          ))}
        </div>

        {/* Virtualized rows */}
        {virtualItems.map((virtualRow: VirtualItem) => {
          const row = data[virtualRow.index];
          
          return (
            <motion.div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
                className="absolute left-0 top-0 flex w-full border-b border-gray-100 bg-white hover:bg-gray-50 "
              style={{
                height: rowHeight,
                transform: `translateY(${virtualRow.start}px)`,
                width: totalWidth,
              }}
            >
              {columns.map((col) => (
                <div
                  key={`${virtualRow.key}-${col.key}`}
                  className="flex-shrink-0 px-4 py-3"
                  style={{ width: col.width || 150 }}
                >
                  {col.render
                    ? col.render(row[col.key], row)
                    : row[col.key]}
                </div>
              ))}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};