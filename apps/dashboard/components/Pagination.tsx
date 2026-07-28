"use client";

import { Select } from "./Select";

export const PAGE_SIZES = [10, 25, 50, 100];

/** Pager for the dashboard tables: range info, rows-per-page chooser
    (when onPageSize is wired), windowed page numbers, prev/next. Hidden only
    when the smallest page size already fits everything. */
export function Pagination({
  page,
  total,
  pageSize,
  onPage,
  onPageSize,
}: {
  page: number;
  total: number;
  pageSize: number;
  onPage: (p: number) => void;
  /** Enables the 10/25/50/100 rows-per-page chooser; resets to page 1 on change. */
  onPageSize?: (n: number) => void;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const chooserUseful = Boolean(onPageSize) && total > PAGE_SIZES[0];
  if (total <= pageSize && !chooserUseful) return null;

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  const nums: (number | "dots")[] = [];
  for (let i = 1; i <= pageCount; i++) {
    if (i === 1 || i === pageCount || (i >= page - 1 && i <= page + 1)) {
      nums.push(i);
    } else if (nums[nums.length - 1] !== "dots") {
      nums.push("dots");
    }
  }

  return (
    <div className="pager">
      <span className="pager-info">
        {from}–{to} of {total}
      </span>
      {onPageSize && (
        <Select
          value={String(pageSize)}
          onChange={(v) => {
            onPageSize(Number(v));
            onPage(1);
          }}
          options={PAGE_SIZES.map((n) => ({ value: String(n), label: `${n} / page` }))}
          placeholder="Rows"
          ariaLabel="Rows per page"
          width={112}
          up
        />
      )}
      <div className="pager-btns">
        <button className="pager-btn" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          ‹ Prev
        </button>
        {nums.map((n, i) =>
          n === "dots" ? (
            <span key={`d${i}`} className="pager-dots">…</span>
          ) : (
            <button key={n} className={`pager-btn ${n === page ? "on" : ""}`} onClick={() => onPage(n)}>
              {n}
            </button>
          ),
        )}
        <button className="pager-btn" disabled={page >= pageCount} onClick={() => onPage(page + 1)}>
          Next ›
        </button>
      </div>
    </div>
  );
}

/** Slice a list to the current page. */
export function paginate<T>(items: T[], page: number, pageSize: number): T[] {
  return items.slice((page - 1) * pageSize, page * pageSize);
}
