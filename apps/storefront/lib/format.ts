/** All money is integer paise from the backend. Render as INR. */
export function inr(paise: number | null | undefined): string {
  if (paise == null) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: paise % 100 === 0 ? 0 : 2,
  }).format(paise / 100);
}

export function stockLabel(status: string): { text: string; cls: string } {
  switch (status) {
    case "in_stock":
      return { text: "In stock", cls: "pill-ok" };
    case "low_stock":
      return { text: "Low stock", cls: "pill-low" };
    case "out_of_stock":
      return { text: "Out of stock", cls: "pill-out" };
    default:
      return { text: status, cls: "pill-out" };
  }
}
