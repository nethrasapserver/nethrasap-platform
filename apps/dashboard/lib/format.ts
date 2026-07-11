export function inr(paise: number | null | undefined): string {
  if (paise == null) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

export function inrExact(paise: number | null | undefined): string {
  if (paise == null) return "—";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(paise / 100);
}

export function dateShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function dateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

const STATUS_PILL: Record<string, string> = {
  active: "pill-ok",
  approved: "pill-ok",
  confirmed: "pill-ok",
  delivered: "pill-ok",
  captured: "pill-ok",
  processed: "pill-ok",
  pending: "pill-warn",
  pending_kyc: "pill-warn",
  quoted: "pill-info",
  placed: "pill-warn",
  dispatched: "pill-info",
  out_for_delivery: "pill-info",
  open: "pill-info",
  rejected: "pill-err",
  cancelled: "pill-err",
  payment_failed: "pill-err",
  suspended: "pill-err",
  closed: "pill-muted",
  converted: "pill-ok",
};

export function statusPill(status: string): string {
  return STATUS_PILL[status] ?? "pill-muted";
}
