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

export async function updateCustomer(id: string, formData: FormData) {
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

  const existing = await prisma.customer.findFirst({ where: { id, orgId } });
  if (!existing) return { ok: false, error: "Customer not found" };

  const { name, email, phone, address } = parsed.data;

  await prisma.customer.update({
    where: { id },
    data: {
      name,
      email: email || null,
      phone: phone || null,
      address: address || null,
    },
  });

  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  return { ok: true };
}

export async function deleteCustomer(id: string) {
  const orgId = await getOrgIdOrUserId();
  await prisma.customer.deleteMany({ where: { id, orgId } });
  revalidatePath("/customers");
  return { ok: true };
}

// CRM Actions

const OpportunitySchema = z.object({
  customerId: z.string(),
  title: z.string().min(1),
  valueCents: z.coerce.number().min(0),
  stage: z.enum(["NEW", "QUALIFICATION", "PROPOSAL", "NEGOTIATION", "WON", "LOST"]),
  description: z.string().optional(),
});

export async function createOpportunityAction(formData: FormData) {
  const orgId = await getOrgIdOrUserId();

  const parsed = OpportunitySchema.safeParse({
    customerId: formData.get("customerId"),
    title: formData.get("title"),
    valueCents: formData.get("value"),
    stage: formData.get("stage"),
    description: formData.get("description"),
  });

  if (!parsed.success) return { ok: false, error: parsed.error.flatten().fieldErrors };

  await prisma.opportunity.create({
    data: {
      orgId,
      ...parsed.data,
    },
  });

  revalidatePath(`/customers/${parsed.data.customerId}`);
  return { ok: true };
}

const ActivitySchema = z.object({
  customerId: z.string(),
  type: z.enum(["CALL", "EMAIL", "MEETING", "NOTE"]),
  subject: z.string().min(1),
  description: z.string().optional(),
});

export async function logActivityAction(formData: FormData) {
  const orgId = await getOrgIdOrUserId();

  const parsed = ActivitySchema.safeParse({
    customerId: formData.get("customerId"),
    type: formData.get("type"),
    subject: formData.get("subject"),
    description: formData.get("description"),
  });

  if (!parsed.success) return { ok: false, error: parsed.error.flatten().fieldErrors };

  await prisma.activity.create({
    data: {
      orgId,
      ...parsed.data,
    },
  });

  revalidatePath(`/customers/${parsed.data.customerId}`);
  return { ok: true };
}

const TaskSchema = z.object({
  customerId: z.string(),
  title: z.string().min(1),
  dueDate: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
});

export async function createTaskAction(formData: FormData) {
  const orgId = await getOrgIdOrUserId();

  const parsed = TaskSchema.safeParse({
    customerId: formData.get("customerId"),
    title: formData.get("title"),
    dueDate: formData.get("dueDate"),
    priority: formData.get("priority"),
  });

  if (!parsed.success) return { ok: false, error: parsed.error.flatten().fieldErrors };

  await prisma.task.create({
    data: {
      orgId,
      customerId: parsed.data.customerId,
      title: parsed.data.title,
      priority: parsed.data.priority,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : undefined,
    },
  });

  revalidatePath(`/customers/${parsed.data.customerId}`);
  return { ok: true };
}
