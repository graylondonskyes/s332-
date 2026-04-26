import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getOptionalEnv } from "@/lib/env";

function adminEmails() {
  const raw = getOptionalEnv("JOBPING_ADMIN_EMAILS") || (process.env.NODE_ENV !== "production" ? "owner@jobping.local" : "");
  return raw.split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
}

export async function requireAdminUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const allowed = adminEmails();
  if (!allowed.includes(user.email.toLowerCase())) redirect("/dashboard");
  return user;
}

export function isAdminEmail(email: string) {
  return adminEmails().includes(email.toLowerCase());
}
