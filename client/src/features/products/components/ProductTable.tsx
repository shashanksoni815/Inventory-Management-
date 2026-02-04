import React, { useState, useMemo, useCallback } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type Row,
  type HeaderGroup,
  type Header,
  type Cell,
} from '@tanstack/react-table';
import { motion } from 'framer-motion';
import {
  Search,
  Edit,
  Trash2,
  ChevronUp,
  ChevronDown,
  Package,
  AlertTriangle,
} from 'lucide-react';
import type { Product } from '@/types';
import { cn } from '@/lib/utils';

interface ProductTableProps {
  products: Product[];
  loading?: boolean;
  onEdit: (product: Product) => void;
  onDelete: (productId: string) => void;
}

const ProductTable: React.FC<ProductTableProps> = ({
  products,
  loading = false,
  onEdit,
  onDelete,
}) => {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [rowSelection, setRowSelection] = useState({});

  const columns = useMemo<ColumnDef<Product>[]>(
    () => [
      {
        id: 'select',
        header: ({ table }) => (
          <input
            type="checkbox"
            checked={table.getIsAllRowsSelected()}
            onChange={table.getToggleAllRowsSelectedHandler()}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
        ),
        cell: ({ row }: { row: Row<Product> }) => (
          <input
            type="checkbox"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
        ),
      },
      {
        accessorKey: 'sku',
        header: 'SKU',
        cell: ({ row }: { row: Row<Product> }) => (
          <div className="font-mono text-sm font-medium text-gray-900">
            {row.original.sku}
          </div>
        ),
      },
      {
        accessorKey: 'name',
        header: 'Product Name',
        cell: ({ row }: { row: Row<Product> }) => (
          <div className="flex items-center space-x-3">
            {row.original.images?.[0]?.url ? (
              <img
                src={row.original.images[0].url}
                alt={row.original.name}
                className="h-10 w-10 rounded-lg object-cover"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
                <Package className="h-5 w-5 text-gray-400" />
              </div>
            )}
            <div>
              <p className="font-medium text-gray-900">
                {row.original.name}
              </p>
              <p className="text-sm text-gray-500">
                {row.original.category}
              </p>
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'stockQuantity',
        header: 'Stock',
        cell: ({ row }: { row: Row<Product> }) => {
          const product = row.original;
          const stockStatus = product.stockStatus;
          const progress = Math.min(
            (product.stockQuantity / (product.minimumStock * 3)) * 100,
            100
          );

          return (
            <div className="w-32">
              <div className="flex justify-between text-sm">
                <span className="font-medium text-gray-700">
                  {product.stockQuantity}
                </span>
                <span className="text-gray-500">
                  Min: {product.minimumStock}
                </span>
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-200">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-300',
                    stockStatus === 'out-of-stock'
                      ? 'bg-red-500'
                      : stockStatus === 'low-stock'
                      ? 'bg-amber-500'
                      : 'bg-green-500'
                  )}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="mt-1 flex items-center space-x-1">
                {stockStatus === 'low-stock' && (
                  <AlertTriangle className="h-3 w-3 text-amber-500" />
                )}
                <span
                  className={cn(
                    'text-xs font-medium capitalize',
                    stockStatus === 'out-of-stock'
                      ? 'text-red-600'
                      : stockStatus === 'low-stock'
                      ? 'text-amber-600'
                      : 'text-green-600text-green-400'
                  )}
                >
                  {stockStatus?.replace('-', ' ')}
                </span>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: 'buyingPrice',
        header: 'Cost',
        cell: ({ row }: { row: Row<Product> }) => (
          <div className="text-right">
            <p className="font-medium text-gray-900">
              ${row.original.buyingPrice.toFixed(2)}
            </p>
            <p className="text-sm text-gray-500">Cost</p>
          </div>
        ),
      },
      {
        accessorKey: 'sellingPrice',
        header: 'Price',
        cell: ({ row }: { row: Row<Product> }) => (
          <div className="text-right">
            <p className="font-medium text-gray-900">
              ${row.original.sellingPrice.toFixed(2)}
            </p>
            <p className="text-sm text-gray-500">Selling</p>
          </div>
        ),
      },
      {
        accessorKey: 'profitMargin',
        header: 'Margin',
        cell: ({ row }: { row: Row<Product> }) => (
          <div className="text-right">
            <p
              className={cn(
                'font-bold',
                row.original.profitMargin >= 30
                  ? 'text-green-600text-green-400'
                  : row.original.profitMargin >= 10
                  ? 'text-blue-600'
                  : 'text-amber-600'
              )}
            >
              {row.original.profitMargin.toFixed(1)}%
            </p>
            <p className="text-sm text-gray-500">Margin</p>
          </div>
        ),
      },
      {
        accessorKey: 'inventoryValue',
        header: 'Inventory Value',
        cell: ({ row }: { row: Row<Product> }) => (
          <div className="text-right">
            <p className="font-medium text-gray-900">
              ${((row.original.inventoryValue || 0) / 1000).toFixed(1)}k
            </p>
            <p className="text-sm text-gray-500">Value</p>
          </div>
        ),
      },
      {
        id: 'actions',
        cell: ({ row }: { row: Row<Product> }) => (
          <div className="flex items-center justify-end space-x-2">
            <button
              onClick={() => onEdit(row.original)}
              className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"
            >
              <Edit className="h-4 w-4" />
            </button>
            <button
              onClick={() => onDelete(row.original._id)}
              className="rounded-lg p-2 text-red-600 hover:bg-red-50text-red-400hover:bg-red-900/20"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ),
      },
    ],
    [onEdit, onDelete]
  );

  const table = useReactTable({
    data: products,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      rowSelection,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const handleBulkDelete = useCallback(() => {
    const selectedIds = Object.keys(rowSelection);
    if (selectedIds.length > 0) {
      if (confirm(`Delete ${selectedIds.length} selected products?`)) {
        selectedIds.forEach(id => onDelete(id));
      }
    }
  }, [rowSelection, onDelete]);

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="h-16 w-full bg-gray-100 rounded-lg animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            placeholder="Search products..."
            value={globalFilter}
            onChange={e => setGlobalFilter(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <div className="flex items-center space-x-3">
          {Object.keys(rowSelection).length > 0 && (
            <button
              onClick={handleBulkDelete}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Delete Selected ({Object.keys(rowSelection).length})
            </button>
          )}
          <select className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm">
            <option>All Categories</option>
            <option>Electronics</option>
            <option>Clothing</option>
            <option>Books</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 -mx-2 sm:mx-0">
        <div className="overflow-x-auto min-w-0" style={{ WebkitOverflowScrolling: 'touch' }}>
          <table className="w-full min-w-[640px]">
            <thead className="bg-gray-50">
              {table.getHeaderGroups().map((headerGroup: HeaderGroup<Product>) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header: Header<Product, unknown>) => (
                    <th
                      key={header.id}
                      className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                    >
                      {header.isPlaceholder ? null : (
                        <div
                          className={cn(
                            'flex items-center',
                            header.column.getCanSort() && 'cursor-pointer select-none'
                          )}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                          {header.column.getCanSort() && (
                            <span className="ml-1">
                              {(
                                {
                                  asc: <ChevronUp className="h-4 w-4" />,
                                  desc: <ChevronDown className="h-4 w-4" />,
                                } as Record<string, React.ReactNode>
                              )[header.column.getIsSorted() as string] ?? null}
                            </span>
                          )}
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-gray-200">
              {table.getRowModel().rows.map((row: Row<Product>) => (
                <motion.tr
                  key={row.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="hover:bg-gray-50"
                >
                  {row.getVisibleCells().map((cell: Cell<Product, unknown>) => (
                    <td key={cell.id} className="whitespace-nowrap px-6 py-4">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">
          {table.getFilteredRowModel().rows.length} products
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="rounded-lg border border-gray-300 px-3 py-1 text-sm disabled:opacity-50border-gray-600"
          >
            Previous
          </button>
          <span className="text-sm">
            Page {table.getState().pagination.pageIndex + 1} of{' '}
            {table.getPageCount()}
          </span>
          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="rounded-lg border border-gray-300 px-3 py-1 text-sm disabled:opacity-50border-gray-600"
          >
            Next
          </button>
          <select
            value={table.getState().pagination.pageSize}
            onChange={e => table.setPageSize(Number(e.target.value))}
            className="rounded-lg border border-gray-300 px-3 py-1 text-sm"
          >
            {[10, 20, 30, 40, 50].map(pageSize => (
              <option key={pageSize} value={pageSize}>
                Show {pageSize}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

export default ProductTable;