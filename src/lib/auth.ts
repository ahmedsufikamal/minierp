import { verifySession } from "@/lib/session";
import { redirect } from "next/navigation";

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
