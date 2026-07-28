"use client";

import { useEffect, useRef, useState } from "react";

export interface SelectOption {
  value: string;
  label: string;
}

/** Design-system dropdown — native <select> popups can't be themed, so this
    renders its own listbox: keyboard navigable (arrows/Enter/Escape/Home/End),
    outside-click close, check-marked selection. Empty value = placeholder. */
export function Select({
  value,
  onChange,
  options,
  placeholder,
  width,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  /** Label for the empty ("all") choice, shown muted on the trigger. */
  placeholder: string;
  width?: number | string;
  ariaLabel?: string;
}) {
  const all: SelectOption[] = [{ value: "", label: placeholder }, ...options];
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const pop = useRef<HTMLDivElement>(null);

  const selected = all.find((o) => o.value === value) ?? all[0];

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    if (open) {
      setActive(Math.max(0, all.findIndex((o) => o.value === value)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    pop.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function pick(v: string) {
    onChange(v);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(e.key)) {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    switch (e.key) {
      case "Escape":
        setOpen(false);
        break;
      case "ArrowDown":
        e.preventDefault();
        setActive((i) => Math.min(all.length - 1, i + 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActive((i) => Math.max(0, i - 1));
        break;
      case "Home":
        e.preventDefault();
        setActive(0);
        break;
      case "End":
        e.preventDefault();
        setActive(all.length - 1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        pick(all[active].value);
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  }

  return (
    <div ref={root} className={`sel ${open ? "open" : ""}`} style={{ width }} onKeyDown={onKeyDown}>
      <button
        type="button"
        className="sel-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel ?? placeholder}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={value ? "" : "muted-val"}>{selected.label}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div ref={pop} className="sel-pop" role="listbox" aria-label={ariaLabel ?? placeholder}>
          {all.map((o, i) => (
            <button
              key={o.value || "__all"}
              type="button"
              role="option"
              aria-selected={o.value === value}
              className={`sel-opt ${i === active ? "is-active" : ""} ${o.value === value ? "on" : ""}`}
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(o.value)}
            >
              {o.label}
              {o.value === value && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
