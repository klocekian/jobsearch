"use client";

import type { ReactNode } from "react";
import { Icon } from "@/components/iconstack/Icon";
import styles from "./ui.module.css";

export type TableWidth = { px: number } | { fr: number };
export const pixel = (px: number): TableWidth => ({ px });
export const proportional = (fr: number): TableWidth => ({ fr });

export interface TableColumn<T> {
  key: string;
  header: ReactNode;
  width?: TableWidth;
  sortable?: boolean;
  /** The direction of the first click; numbers and dates read best high to low. */
  firstDirection?: SortDirection;
  renderCell?: (row: T) => ReactNode;
}

export type SortDirection = "ascending" | "descending";
export type TableSortState<K extends string = string> = { sortKey: K; direction: SortDirection }[];
export type Sort<K extends string = string> = { key: K; direction: SortDirection };

/** The direction after clicking column `key`: its first direction if it's new, else flipped. */
export function nextSort<K extends string>(current: Sort<K> | null, key: K, first: SortDirection = "ascending"): Sort<K> {
  if (current?.key !== key) return { key, direction: first };
  return { key, direction: current.direction === "ascending" ? "descending" : "ascending" };
}

/**
 * Rows ordered by `value`, as a new array. Text compares case-insensitively and
 * numbers in order; empty values go last either way, and ties keep their order.
 */
export function sortRows<T>(rows: readonly T[], value: (row: T) => string | number | null | undefined, direction: SortDirection): T[] {
  const sign = direction === "ascending" ? 1 : -1;
  const empty = (v: unknown) => v == null || v === "";
  return [...rows].sort((a, b) => {
    const x = value(a), y = value(b);
    if (empty(x) || empty(y)) return Number(empty(x)) - Number(empty(y));
    const order = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), undefined, { sensitivity: "base", numeric: true });
    return order * sign;
  });
}

/** A column header that sorts its column, with an arrow showing the direction when active. */
export function SortButton({ active, direction, onClick, children, label }: { active: boolean; direction?: SortDirection; onClick: () => void; children: ReactNode; label?: string }) {
  return (
    <button type="button" className={styles.sortButton} data-active={active} onClick={onClick} aria-label={label}>
      {children}
      <Icon name={active && direction === "descending" ? "chevron-down" : "chevron-up"} size={11} style={{ opacity: active ? 1 : 0.35 }} />
    </button>
  );
}

interface SortablePlugin {
  sort: TableSortState;
  onSortChange: (sort: TableSortState) => void;
}

/** Controlled sorting: the table reports header clicks; the caller orders `data`. */
export function useTableSortable<T>(plugin: SortablePlugin): SortablePlugin & { _row?: T } {
  return plugin;
}

interface TableProps<T> {
  data: T[];
  columns: TableColumn<T>[];
  idKey: keyof T & string;
  hasHover?: boolean;
  plugins?: { sortable?: SortablePlugin };
  /** Scrolls sideways in its own box; off, the header can stick to the window instead. */
  isScrollable?: boolean;
}

export function Table<T extends Record<string, unknown>>({ data, columns, idKey, hasHover, plugins, isScrollable = true }: TableProps<T>) {
  const sortable = plugins?.sortable;
  const current = sortable?.sort[0];
  const totalFr = columns.reduce((n, c) => n + (c.width && "fr" in c.width ? c.width.fr : 0), 0) || 1;
  const fixedPx = columns.reduce((n, c) => n + (c.width && "px" in c.width ? c.width.px : 0), 0);
  const widthOf = (w?: TableWidth) => !w ? undefined : "px" in w ? `${w.px}px` : `calc((100% - ${fixedPx}px) * ${w.fr / totalFr})`;

  const onSort = (c: TableColumn<T>) => {
    if (!sortable) return;
    const next = nextSort(current ? { key: current.sortKey, direction: current.direction } : null, c.key, c.firstDirection);
    sortable.onSortChange([{ sortKey: next.key, direction: next.direction }]);
  };

  return (
    <div className={isScrollable ? styles.tableScroll : undefined}>
      <table className={`${styles.table} ${hasHover ? styles.hover : ""}`}>
        <colgroup>{columns.map((c) => <col key={c.key} style={{ width: widthOf(c.width) }} />)}</colgroup>
        <thead>
          <tr>
            {columns.map((c) => {
              const active = current?.sortKey === c.key;
              return (
                <th key={c.key} scope="col" aria-sort={active ? current.direction : undefined}>
                  {c.sortable && sortable ? (
                    <SortButton active={active} direction={current?.direction} onClick={() => onSort(c)}>{c.header}</SortButton>
                  ) : c.header}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={String(row[idKey])}>
              {columns.map((c) => <td key={c.key}>{c.renderCell ? c.renderCell(row) : String(row[c.key] ?? "")}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
