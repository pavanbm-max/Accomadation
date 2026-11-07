import React, { useState } from 'react';
import { Search, ChevronLeft, ChevronRight, Inbox } from 'lucide-react';

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  searchPlaceholder?: string;
  searchFilter?: (item: T, query: string) => boolean;
  actions?: (item: T) => React.ReactNode;
  pageSize?: number;
  emptyMessage?: string;
  extraHeaderActions?: React.ReactNode;
}

export function DataTable<T extends { id: string | number }>({
  columns,
  data,
  searchPlaceholder = 'Search...',
  searchFilter,
  actions,
  pageSize = 10,
  emptyMessage = 'No records found.',
  extraHeaderActions,
}: DataTableProps<T>) {
  const [query, setQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const filteredData = searchFilter && query.trim()
    ? data.filter((item) => searchFilter(item, query.trim()))
    : data;

  const totalPages = Math.ceil(filteredData.length / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedData = filteredData.slice(startIndex, startIndex + pageSize);

  return (
    <div className="rounded-lg bg-[#1B1D20] border border-[#2B2E32] shadow-[0_4px_24px_rgba(0,0,0,0.4)] overflow-hidden text-[#F7FAFC]">
      {/* Table toolbar */}
      <div className="p-4 border-b border-[#2B2E32] flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#151618]">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-2.5" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder={searchPlaceholder}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-md border border-[#2B2E32] bg-[#1B1D20] text-[#F7FAFC] placeholder:text-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#5EE5BC] focus:border-[#5EE5BC]"
          />
        </div>

        {extraHeaderActions && (
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {extraHeaderActions}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-[#2B2E32] bg-[#151618] text-[#94A3B8] text-xs font-medium">
              {columns.map((col) => (
                <th key={col.key} className={`py-3 px-4 ${col.className || ''}`}>
                  {col.header}
                </th>
              ))}
              {actions && <th className="py-3 px-4 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2B2E32] text-[#F7FAFC] text-xs">
            {paginatedData.length > 0 ? (
              paginatedData.map((item) => (
                <tr
                  key={item.id}
                  className="hover:bg-[#24262A] transition-colors"
                >
                  {columns.map((col) => (
                    <td key={col.key} className={`py-3 px-4 ${col.className || ''}`}>
                      {col.render ? col.render(item) : (item as any)[col.key]}
                    </td>
                  ))}
                  {actions && <td className="py-3 px-4 text-right">{actions(item)}</td>}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={columns.length + (actions ? 1 : 0)}
                  className="py-12 text-center text-[#94A3B8]"
                >
                  <Inbox className="w-8 h-8 mx-auto text-[#64748B] mb-2" />
                  <span>{emptyMessage}</span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="p-3 border-t border-[#2B2E32] flex items-center justify-between text-xs text-[#94A3B8] bg-[#151618]">
          <div>
            Showing <span className="font-semibold text-[#F7FAFC]">{startIndex + 1}</span> to{' '}
            <span className="font-semibold text-[#F7FAFC]">{Math.min(startIndex + pageSize, filteredData.length)}</span> of{' '}
            <span className="font-semibold text-[#F7FAFC]">{filteredData.length}</span> results
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-md border border-[#2B2E32] bg-[#24262A] text-[#F7FAFC] hover:border-[#5EE5BC]/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-medium">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-md border border-[#2B2E32] bg-[#24262A] text-[#F7FAFC] hover:border-[#5EE5BC]/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
