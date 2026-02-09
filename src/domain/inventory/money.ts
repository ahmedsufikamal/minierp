export function toMoneyMinor(value: number | string | null | undefined): number {
  if (value == null) return 0;
  const num = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
  if (!Number.isFinite(num)) return 0;
  return Math.round(num * 100);
}
