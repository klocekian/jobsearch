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
  renderCell?: (row: T) => ReactNode;
}

export type TableSortState<K extends string = string> = { sortKey: K; direction: "ascending" | "descending" }[];

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

  const onSort = (key: string) => {
    if (!sortable) return;
    const direction = current?.sortKey === key && current.direction === "ascending" ? "descending" : "ascending";
    sortable.onSortChange([{ sortKey: key, direction }]);
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
                    <button type="button" className={styles.sortButton} data-active={active} onClick={() => onSort(c.key)}>
                      {c.header}
                      <Icon name={active && current.direction === "descending" ? "chevron-down" : "chevron-up"} size={11} style={{ opacity: active ? 1 : 0.35 }} />
                    </button>
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
