import { auth } from "@clerk/nextjs/server";

// Clerk auth() is async in recent versions.
export async function getOrgIdOrUserId(): Promise<string> {
  const { orgId, userId } = await auth();
  if (!userId) throw new Error("Unauthenticated");
  return orgId ?? userId;
}
