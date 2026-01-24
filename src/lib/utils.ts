import { clsx } from "clsx";

export function cn(...inputs: Array<string | undefined | false | null>) {
  return clsx(inputs);
}

export function formatMoney(cents: number, currency = "BDT") {
  const amount = (cents ?? 0) / 100;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}
