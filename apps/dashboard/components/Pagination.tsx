"use client";

/** Client-side pager for the dashboard tables. Hidden when everything fits on
    one page. Shows a windowed set of page numbers with ellipses. */
export function Pagination({
  page,
  total,
  pageSize,
  onPage,
}: {
  page: number;
  total: number;
  pageSize: number;
  onPage: (p: number) => void;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;

  const from = (page - 1) * pageSize + 1;
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
