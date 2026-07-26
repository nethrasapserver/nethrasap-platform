"use client";

import { useEffect, useRef } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Right-side task panel — the dashboard's single overlay primitive.
 *
 * Chosen over a centred modal because ops work is *contextual*: the record you
 * are acting on stays visible on the left while you fill the form. Sticky
 * header + footer keep the primary action reachable however long the body gets.
 */
export function Drawer({
  title,
  subtitle,
  onClose,
  footer,
  wide,
  children,
}: {
  title: string;
  subtitle?: React.ReactNode;
  onClose: () => void;
  /** Sticky action row. Omit for read-only panels. */
  footer?: React.ReactNode;
  /** Roomier panel for multi-line forms (e.g. quoting an enquiry). */
  wide?: boolean;
  children: React.ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      // Keep Tab inside the panel while it is open.
      if (e.key !== "Tab" || !panel.current) return;
      const items = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    const bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = bodyOverflow;
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="drawer-scrim" onClick={onClose}>
      <aside
        ref={panel}
        className={`drawer ${wide ? "is-wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="drawer-head">
          <div style={{ minWidth: 0 }}>
            <h3>{title}</h3>
            {subtitle && <p className="muted small">{subtitle}</p>}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close panel">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>

        <div className="drawer-body">{children}</div>

        {footer && <footer className="drawer-foot">{footer}</footer>}
      </aside>
    </div>
  );
}
