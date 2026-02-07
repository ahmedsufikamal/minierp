"use server";

import { prisma } from "@/lib/prisma";
import { getCompanyIdOrUserId } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const ContactSchema = z.object({
  customerId: z.string(),
  firstName: z.string().min(1),
  lastName: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  jobTitle: z.string().optional(),
});

export async function createContactAction(formData: FormData) {
  const companyId = await getCompanyIdOrUserId();

  const parsed = ContactSchema.safeParse({
    customerId: formData.get("customerId"),
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    jobTitle: formData.get("jobTitle"),
  });

  if (!parsed.success) return { error: "Invalid data" };

  await prisma.contact.create({
    data: {
      companyId,
      ...parsed.data,
    },
  });

  revalidatePath(`/customers/${parsed.data.customerId}`);
  return { ok: true };
}
