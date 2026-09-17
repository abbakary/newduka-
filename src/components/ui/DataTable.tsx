/**
 * DataTable — universal responsive table built on @tanstack/react-table v8.
 *
 * Features:
 *  - Horizontal scroll on overflow (never wraps or overflows the page)
 *  - Single-line rows (whitespace-nowrap on all cells)
 *  - Optional sticky first column (for product name, customer name, etc.)
 *  - Compact / normal density switch
 *  - Empty state with custom message
 *  - Column definitions accept either a `cell` render function or a plain `accessorKey`
 *  - Columns can have `align: 'left' | 'center' | 'right'`
 *  - Columns can have `minWidth` / `width` strings (e.g. '120px', '10%')
 *  - Works correctly on 400 px mobile viewports and 1920 px desktop screens
 */

import React from 'react';
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';

// ─── Public column-definition type ───────────────────────────────────────────

export type DtColumn<TRow extends object> = ColumnDef<TRow> & {
  /** Text alignment for both header and cells. Default: 'left'. */
  align?: 'left' | 'center' | 'right';
  /** CSS min-width string, e.g. '120px'. Applied to the <col> element. */
  minWidth?: string;
  /** CSS fixed width, e.g. '80px'. */
  width?: string;
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface DataTableProps<TRow extends object> {
  columns: DtColumn<TRow>[];
  data: TRow[];
  /** Row key extractor. Defaults to row index. */
  getRowId?: (row: TRow, index: number) => string;
  /** Show sticky first column (useful for product/customer name). */
  stickyFirst?: boolean;
  /** Compact row height. Default: false (normal). */
  compact?: boolean;
  /** Message shown when data is empty. */
  emptyMessage?: string;
  /** Extra class applied to the outermost wrapper. */
  className?: string;
  /** Called when a row is clicked. */
  onRowClick?: (row: TRow) => void;
  /** Whether rows are hoverable / clickable. */
  hoverable?: boolean;
  /** Enable column sorting. */
  sortable?: boolean;
}

// ─── Alignment helpers ────────────────────────────────────────────────────────

function alignClass(align?: 'left' | 'center' | 'right'): string {
  if (align === 'right') return 'text-right';
  if (align === 'center') return 'text-center';
  return 'text-left';
}

// ─── Component ────────────────────────────────────────────────────────────────

function DataTableInner<TRow extends object>(
  {
    columns,
    data,
    getRowId,
    stickyFirst = false,
    compact = false,
    emptyMessage = 'No data available.',
    className = '',
    onRowClick,
    hoverable,
    sortable = false,
  }: DataTableProps<TRow>,
  _ref: React.ForwardedRef<HTMLDivElement>,
) {
  const [sorting, setSorting] = React.useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: sortable ? setSorting : undefined,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: sortable ? getSortedRowModel() : undefined,
    getRowId: getRowId
      ? (row, index) => getRowId(row, index)
      : (_row, index) => String(index),
  });

  const cellPadding = compact ? 'py-2 px-3' : 'py-3 px-4';
  const headPadding = compact ? 'py-2 px-3' : 'py-3 px-4';
  const fontSize    = compact ? 'text-[11px]' : 'text-xs';

  return (
    <div
      ref={_ref}
      className={`w-full overflow-x-auto overflow-y-visible rounded-xl border border-[#E1DFDD] bg-white shadow-xs ${className}`}
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      <table
        className="w-full border-collapse"
        style={{ minWidth: 'max-content', tableLayout: 'auto' }}
      >
        {/* Column widths */}
        <colgroup>
          {table.getAllColumns().map((col, ci) => {
            const def = columns[ci] as DtColumn<TRow> | undefined;
            const w   = def?.width;
            const mw  = def?.minWidth;
            return (
              <col
                key={col.id}
                style={{
                  ...(w  ? { width:    w  } : {}),
                  ...(mw ? { minWidth: mw } : {}),
                }}
              />
            );
          })}
        </colgroup>

        {/* Head */}
        <thead className="bg-[#F8F8F8] border-b border-[#EDEBE9]">
          {table.getHeaderGroups().map(hg => (
            <tr key={hg.id}>
              {hg.headers.map((header, ci) => {
                const def   = columns[ci] as DtColumn<TRow> | undefined;
                const align = def?.align;
                const canSort = sortable && header.column.getCanSort();

                return (
                  <th
                    key={header.id}
                    scope="col"
                    className={[
                      headPadding,
                      fontSize,
                      'font-bold uppercase tracking-wider text-[#605E5C]',
                      'whitespace-nowrap select-none',
                      alignClass(align),
                      stickyFirst && ci === 0
                        ? 'sticky left-0 z-10 bg-[#F8F8F8] shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]'
                        : '',
                      canSort ? 'cursor-pointer hover:text-[#323130]' : '',
                    ].join(' ')}
                    onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                  >
                    <span className="inline-flex items-center gap-1">
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                      {canSort && (
                        <span className="opacity-50 shrink-0">
                          {header.column.getIsSorted() === 'asc'  ? <ChevronUp   className="w-3 h-3" /> :
                           header.column.getIsSorted() === 'desc' ? <ChevronDown className="w-3 h-3" /> :
                                                                     <ChevronsUpDown className="w-3 h-3" />}
                        </span>
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>

        {/* Body */}
        <tbody className="divide-y divide-[#F3F2F1]">
          {table.getRowModel().rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className={`${cellPadding} ${fontSize} text-center text-[#8A8886] py-10`}
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            table.getRowModel().rows.map(row => (
              <tr
                key={row.id}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                className={[
                  'transition-colors',
                  hoverable !== false && onRowClick ? 'cursor-pointer' : '',
                  onRowClick || hoverable ? 'hover:bg-[#FAF9F8]' : '',
                ].join(' ')}
              >
                {row.getVisibleCells().map((cell, ci) => {
                  const def   = columns[ci] as DtColumn<TRow> | undefined;
                  const align = def?.align;

                  return (
                    <td
                      key={cell.id}
                      className={[
                        cellPadding,
                        fontSize,
                        'whitespace-nowrap',
                        'text-[#323130]',
                        alignClass(align),
                        stickyFirst && ci === 0
                          ? 'sticky left-0 z-10 bg-white shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]'
                          : '',
                      ].join(' ')}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// Forward-ref wrapper so consumers can ref the scroll container
export const DataTable = React.forwardRef(DataTableInner) as <TRow extends object>(
  props: DataTableProps<TRow> & { ref?: React.Ref<HTMLDivElement> },
) => React.ReactElement;

export type { ColumnDef };
