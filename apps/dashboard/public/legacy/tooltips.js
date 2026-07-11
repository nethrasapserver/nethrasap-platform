/* ===========================================================
   Auto-tooltips — scans DOM after mount and adds data-tooltip
   to common UI patterns when they're missing one.
   Idempotent: skips elements that already have data-tooltip or data-no-tip.
   =========================================================== */
(function () {
  function decorate(root) {
    if (!root) return;
    root.querySelectorAll(".btn:not([data-tooltip]):not([data-no-tip])").forEach((el) => {
      const text = (el.textContent || "").trim();
      if (text && text.length > 0 && text.length < 60) {
        // skip if its text already gives away the action
        if (el.classList.contains("btn-sm") || el.classList.contains("btn-lg") || el.classList.contains("btn-primary") || el.classList.contains("btn-ink") || el.classList.contains("btn-outline")) {
          el.setAttribute("data-tooltip", text);
        }
      }
    });

    // Quick actions and quick links — repeat their text as tooltip (still useful for truncated)
    root.querySelectorAll(".quick-action:not([data-tooltip]):not([data-no-tip])").forEach((el) => {
      el.setAttribute("data-tooltip", (el.textContent || "").trim());
    });

    // Status pills — describe meaning
    const PILL_MAP = {
      active: "Active · user can sign in and place orders",
      suspended: "Suspended · access revoked",
      pending: "Pending review",
      approved: "Approved",
      rejected: "Rejected",
      processed: "Payroll processed",
      expired: "Expired",
      delivered: "Order delivered to customer",
      dispatched: "Order dispatched from warehouse",
      cancelled: "Order cancelled",
      confirmed: "Confirmed",
      out_for_delivery: "Out for delivery",
      checked_out: "Customer completed checkout",
    };
    root.querySelectorAll(".pill:not([data-tooltip]):not([data-no-tip])").forEach((el) => {
      const cls = [...el.classList].find((c) => c.startsWith("pill-status-"));
      if (cls) {
        const k = cls.replace("pill-status-", "");
        if (PILL_MAP[k]) el.setAttribute("data-tooltip", PILL_MAP[k]);
      } else if (el.classList.contains("pill-emerald")) {
        el.setAttribute("data-tooltip", "Confirmed / in stock");
      } else if (el.classList.contains("pill-amber")) {
        el.setAttribute("data-tooltip", "Needs attention");
      } else if (el.classList.contains("pill-rose")) {
        el.setAttribute("data-tooltip", "Action required");
      } else if (el.classList.contains("pill-brand")) {
        const txt = (el.textContent || "").trim();
        if (txt) el.setAttribute("data-tooltip", txt);
      }
    });

    // Search-pill, lang button, cart icon — common storefront UI
    root.querySelectorAll(".search-pill:not([data-tooltip])").forEach((el) => el.setAttribute("data-tooltip", "Search the catalog · ⌘K"));
    root.querySelectorAll(".lang-btn:not([data-tooltip])").forEach((el) => el.setAttribute("data-tooltip", "Change language"));
    root.querySelectorAll(".nav-cart:not([data-tooltip])").forEach((el) => el.setAttribute("data-tooltip", "Your cart"));
    root.querySelectorAll(".m-top-cart:not([data-tooltip])").forEach((el) => el.setAttribute("data-tooltip", "Your cart"));
    root.querySelectorAll(".chat-fab:not([data-tooltip])").forEach((el) => el.setAttribute("data-tooltip", "Chat with Nethra Assist"));

    // Tab row items — show their full label (useful when truncated)
    root.querySelectorAll(".tab-row-item:not([data-tooltip])").forEach((el) => {
      const text = (el.textContent || "").trim();
      if (text && text.length > 0 && text.length < 60) el.setAttribute("data-tooltip", text);
    });

    // Star rating in cards — show numeric
    root.querySelectorAll(".star-rating[data-tooltip='']").forEach(() => {});
    root.querySelectorAll(".star-rating:not([data-tooltip])").forEach((el) => {
      const v = el.querySelector(".star-rating-v");
      const c = el.querySelector(".star-rating-c");
      const parts = [];
      if (v) parts.push(v.textContent.trim() + " of 5");
      if (c) parts.push(c.textContent.trim().replace(/[()]/g, "") + " reviews");
      if (parts.length) el.setAttribute("data-tooltip", parts.join(" · "));
    });

    // Product card price — show "Tap to add"
    root.querySelectorAll(".prod-price:not([data-tooltip])").forEach((el) => {
      el.setAttribute("data-tooltip", "Unit price · tap Add to put it in your cart");
    });

    // Portal sidebar links — useful when sidebar is collapsed
    root.querySelectorAll(".portal-side-link:not([data-tooltip])").forEach((el) => {
      const label = el.querySelector("span:not(.portal-side-link-ic):not(.portal-side-link-badge)");
      if (label) {
        el.setAttribute("data-tooltip", label.textContent.trim());
        el.setAttribute("data-tip-pos", "right");
      }
    });

    // Toggle switches — show on/off
    root.querySelectorAll(".toggle:not([data-tooltip])").forEach((el) => {
      const input = el.querySelector("input[type='checkbox']");
      const update = () => el.setAttribute("data-tooltip", input && input.checked ? "Enabled · click to disable" : "Disabled · click to enable");
      update();
      if (input) input.addEventListener("change", update);
    });
  }

  function run() {
    decorate(document.body);
    // Watch for React-rendered subtrees and re-decorate
    const obs = new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes.forEach((n) => { if (n.nodeType === 1) decorate(n); });
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(run, 400));
  } else {
    setTimeout(run, 400);
  }
})();
