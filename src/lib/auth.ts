import { verifySession } from "@/lib/session";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export async function getOrgIdOrUserId() {
  const session = await verifySession();
  if (!session) {
    redirect("/sign-in");
  }
  return session.orgId || session.userId;
}

export async function getUser() {
  const session = await verifySession();
  return session;
}

export async function getCurrentUser() {
  const session = await verifySession();
  if (!session?.userId) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, name: true, role: true, orgId: true },
  });
  return user;
}

const ADMIN_PERMISSIONS = new Set(["settings:write", "audit:read", "user:manage"]);
const USER_PERMISSIONS = new Set([
  "customer:*", "vendor:*", "product:*", "invoice:*", "bill:*",
  "quote:*", "purchase-order:*", "payment:*", "inventory:*", "accounting:*",
]);

export function can(role: string, permission: string): boolean {
  if (role === "ADMIN") return true;
  if (ADMIN_PERMISSIONS.has(permission)) return role === "ADMIN";
  const [resource] = permission.split(":");
  return USER_PERMISSIONS.has(permission) || USER_PERMISSIONS.has(`${resource}:*`);
}
