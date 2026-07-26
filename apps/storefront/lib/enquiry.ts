/** Customer-facing labels for the enquiry (RFQ) status machine. */
export const STATUS_META: Record<string, { label: string; cls: string; hint: string }> = {
  pending: { label: "Awaiting quote", cls: "pill-low", hint: "Our team is pricing your request" },
  quoted: { label: "Quote ready", cls: "pill-info", hint: "Review and accept or negotiate" },
  confirmed: { label: "Accepted", cls: "pill-ok", hint: "We're preparing your order" },
  converted: { label: "Ordered", cls: "pill-ok", hint: "Converted to an order" },
  rejected: { label: "Closed", cls: "pill-out", hint: "This enquiry was closed" },
};
