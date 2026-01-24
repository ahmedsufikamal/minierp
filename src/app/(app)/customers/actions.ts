"use server";

import { prisma } from "@/lib/prisma";
import { getOrgIdOrUserId } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const CustomerSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
});

export async function createCustomer(formData: FormData) {
  const orgId = await getOrgIdOrUserId();

  const parsed = CustomerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    address: formData.get("address"),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.flatten().fieldErrors };
  }

  const { name, email, phone, address } = parsed.data;

  await prisma.customer.create({
    data: {
      orgId,
      name,
      email: email || null,
      phone: phone || null,
      address: address || null,
    },
  });

  revalidatePath("/customers");
  return { ok: true };
}

export async function deleteCustomer(id: string) {
  const orgId = await getOrgIdOrUserId();
  await prisma.customer.deleteMany({ where: { id, orgId } });
  revalidatePath("/customers");
  return { ok: true };
}
