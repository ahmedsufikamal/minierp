import { prisma } from "@/lib/prisma";

/**
 * Returns current stock (quantity on hand) per product for an org.
 * Stock = sum(IN moves) - sum(OUT moves) - sum(ADJUST moves).
 */
export async function getStockByProduct(
  companyId: string,
): Promise<Map<string, number>> {
  let moves;
  try {
    moves = await prisma.inventoryMove.findMany({
      where: { companyId },
      select: { productId: true, type: true, qty: true },
    });
  } catch (error: any) {
    if (error?.message?.includes("Unknown argument `companyId`")) {
      moves = await prisma.inventoryMove.findMany({
        where: { orgId: companyId },
        select: { productId: true, type: true, qty: true },
      });
    } else {
      throw error;
    }
  }

  const map = new Map<string, number>();
  for (const m of moves) {
    const current = map.get(m.productId) ?? 0;
    const delta = m.type === "IN" ? m.qty : -m.qty;
    map.set(m.productId, current + delta);
  }
  return map;
}
