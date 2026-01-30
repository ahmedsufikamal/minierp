"use server";

import { prisma } from "@/lib/prisma";
import { createSession, deleteSession } from "@/lib/session";
import bcrypt from "bcryptjs"; // Consider 'bcrypt' or 'bcryptjs' depending on what installed. Installed 'bcryptjs'.
import { redirect } from "next/navigation";
import { z } from "zod";

const SignUpSchema = z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function signup(prevState: any, formData: FormData) {
    const parsed = SignUpSchema.safeParse(Object.fromEntries(formData));

    if (!parsed.success) {
        return { error: parsed.error.issues[0].message };
    }

    const { name, email, password } = parsed.data;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
        return { error: "User already exists with this email." };
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
        data: {
            name,
            email,
            passwordHash,
            orgId: "default-org-" + Date.now(), // Generate a unique org ID for the user
        },
    });

    await createSession(user.id, user.orgId, user.email, user.name);
    redirect("/dashboard");
}

const SignInSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
});

export async function signin(prevState: any, formData: FormData) {
    const parsed = SignInSchema.safeParse(Object.fromEntries(formData));

    if (!parsed.success) {
        return { error: "Invalid input" };
    }

    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
        return { error: "Invalid email or password." };
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
        return { error: "Invalid email or password." };
    }

    await createSession(user.id, user.orgId, user.email, user.name);
    redirect("/dashboard");
}

export async function logout() {
    await deleteSession();
    redirect("/sign-in");
}
