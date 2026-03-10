import { ChevronLeft, ChevronRight, Search, Download, Plus, Loader2 } from "lucide-react";
import { useState } from "react";

interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
}

interface Props<T> {
  columns: Column<T>[];
  data: T[];
  pagination?: { page: number; limit: number; total: number; totalPages: number };
  isLoading?: boolean;
  onPageChange?: (page: number) => void;
  onSearch?: (q: string) => void;
  onAdd?: () => void;
  onRowClick?: (row: T) => void;
  addLabel?: string;
  title?: string;
  searchPlaceholder?: string;
  actions?: React.ReactNode;
}

export default function DataTable<T extends Record<string, any>>({
  columns,
  data,
  pagination,
  isLoading,
  onPageChange,
  onSearch,
  onAdd,
  onRowClick,
  addLabel = "Add New",
  searchPlaceholder = "Search...",
  actions,
}: Props<T>) {
  const [searchVal, setSearchVal] = useState("");

  const handleSearch = (v: string) => {
    setSearchVal(v);
    onSearch?.(v);
  };

  return (
    <div className="card">
      <div className="p-4 border-b flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {onSearch && (
          <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 flex-1 w-full sm:max-w-sm">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchVal}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="bg-transparent text-sm flex-1 outline-none"
            />
          </div>
        )}
        <div className="flex items-center gap-2 ml-auto">
          {actions}
          {onAdd && (
            <button onClick={onAdd} className="btn-primary btn-sm">
              <Plus className="w-3.5 h-3.5" /> {addLabel}
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50/50">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider ${col.className || ""}`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-gray-500">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                  Loading...
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-gray-400">
                  No records found
                </td>
              </tr>
            ) : (
              data.map((row, i) => (
                <tr
                  key={row.id || i}
                  onClick={() => onRowClick?.(row)}
                  className={`hover:bg-gray-50 transition-colors ${onRowClick ? "cursor-pointer" : ""}`}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={`px-4 py-3 ${col.className || ""}`}>
                      {col.render ? col.render(row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="px-4 py-3 border-t flex items-center justify-between text-sm text-gray-500">
          <span>
            Showing {(pagination.page - 1) * pagination.limit + 1}–
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
            {pagination.total}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange?.(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="btn-icon disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
              let pageNum: number;
              if (pagination.totalPages <= 5) {
                pageNum = i + 1;
              } else if (pagination.page <= 3) {
                pageNum = i + 1;
              } else if (pagination.page >= pagination.totalPages - 2) {
                pageNum = pagination.totalPages - 4 + i;
              } else {
                pageNum = pagination.page - 2 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => onPageChange?.(pageNum)}
                  className={`w-8 h-8 rounded-lg text-xs font-medium ${
                    pageNum === pagination.page
                      ? "bg-primary-600 text-white"
                      : "hover:bg-gray-100"
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              onClick={() => onPageChange?.(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="btn-icon disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
