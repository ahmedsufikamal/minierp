export function normalizeSku(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, " ");
}

export function assertSku(input: string): string {
  const normalized = normalizeSku(input);
  if (!normalized) {
    throw new Error("SKU is required");
  }
  return normalized;
}
