import { getOptionalEnv } from "@/lib/env";

export function getSupportEmail() {
  return getOptionalEnv("JOBPING_SUPPORT_EMAIL") || getOptionalEnv("NEXT_PUBLIC_SUPPORT_EMAIL") || "support@example.com";
}

export function getSupportMailto(subject = "JobPing support request") {
  const email = getSupportEmail();
  return `mailto:${email}?subject=${encodeURIComponent(subject)}`;
}
