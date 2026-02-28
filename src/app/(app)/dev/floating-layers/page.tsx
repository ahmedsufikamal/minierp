import { notFound } from "next/navigation";
import { requireAuthPage } from "@/modules/iam";
import { FloatingLayersShowcase } from "./showcase";

export default async function FloatingLayersPage() {
  if (process.env.NODE_ENV === "production" && process.env.PLAYWRIGHT_TEST !== "1") {
    notFound();
  }

  await requireAuthPage("/dev/floating-layers");

  return <FloatingLayersShowcase />;
}
