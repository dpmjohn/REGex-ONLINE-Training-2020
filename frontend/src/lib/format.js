export function fmtINR(n, digits = 2) {
  if (n === null || n === undefined || isNaN(n)) return "—";
  const v = Number(n);
  return `₹${v.toLocaleString("en-IN", { maximumFractionDigits: digits, minimumFractionDigits: digits })}`;
}

export function fmtNum(n, digits = 2) {
  if (n === null || n === undefined || isNaN(n)) return "—";
  return Number(n).toLocaleString("en-IN", { maximumFractionDigits: digits });
}

export function fmtPct(n, digits = 2) {
  if (n === null || n === undefined || isNaN(n)) return "—";
  const v = Number(n);
  const s = v > 0 ? "+" : "";
  return `${s}${v.toFixed(digits)}%`;
}

export function pnlClass(n) {
  if (n > 0) return "text-success";
  if (n < 0) return "text-destructive";
  return "text-muted-foreground";
}
