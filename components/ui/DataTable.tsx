"use client";

import { useState } from "react";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  align?: "left" | "right";
  sortable?: boolean;
  accessor: (row: T) => number | string | null;
  render?: (row: T) => React.ReactNode;
  /** Shown in the mobile card for this column; omit to skip in the card. */
  cardLabel?: string;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  defaultSortKey?: string;
  defaultSortDir?: "asc" | "desc";
  /** Primary field shown as the card title on mobile (e.g. campaign/CS name). */
  cardTitle: (row: T) => React.ReactNode;
  /** Optional accent value shown top-right of the mobile card (e.g. ROI). */
  cardAccent?: (row: T) => React.ReactNode;
}

/**
 * Sortable table that collapses into a card list below 768px — prototype
 * spec (03-BRIEF-FE-ClaudeDesign.md / docs/labbaika-reporting.html): header
 * click toggles sort, numeric columns are right-aligned and tabular, and
 * the desktop table isn't just squeezed into a horizontal scroll on mobile.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  defaultSortKey,
  defaultSortDir = "desc",
  cardTitle,
  cardAccent,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState(defaultSortKey);
  const [sortDir, setSortDir] = useState(defaultSortDir);

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sorted = [...rows].sort((a, b) => {
    if (!sortKey) return 0;
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return 0;
    const av = col.accessor(a);
    const bv = col.accessor(b);
    if (av === null) return 1;
    if (bv === null) return -1;
    const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
    return sortDir === "asc" ? cmp : -cmp;
  });

  return (
    <>
      <div className="hidden overflow-x-auto rounded-[10px] border border-line bg-card md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-ink-600">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={`p-3 ${c.align === "right" ? "text-right" : ""} ${c.sortable ? "cursor-pointer select-none" : ""}`}
                  onClick={c.sortable ? () => toggleSort(c.key) : undefined}
                >
                  {c.header}
                  {c.sortable && sortKey === c.key && (sortDir === "asc" ? " ↑" : " ↓")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="font-mono">
            {sorted.map((row) => (
              <tr key={rowKey(row)} className="border-b border-line last:border-0">
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`p-3 ${c.align === "right" ? "text-right" : "font-sans font-medium text-ink-900"}`}
                  >
                    {c.render ? c.render(row) : c.accessor(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {sorted.map((row) => (
          <div key={rowKey(row)} className="rounded-[10px] border border-line bg-card p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-medium text-ink-900">{cardTitle(row)}</span>
              {cardAccent && <span className="font-mono font-semibold text-brass">{cardAccent(row)}</span>}
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 font-mono text-sm">
              {columns
                .filter((c) => c.cardLabel)
                .map((c) => (
                  <div key={c.key}>
                    <p className="text-xs text-ink-400">{c.cardLabel}</p>
                    <p className="text-ink-900">{c.render ? c.render(row) : c.accessor(row)}</p>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
