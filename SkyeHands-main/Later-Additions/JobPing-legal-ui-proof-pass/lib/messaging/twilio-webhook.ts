import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyTwilioRequest(input: { url: string; params: Record<string, string>; signature: string | null; authToken?: string | null }) {
  if (!input.authToken) return { ok: false, reason: "TWILIO_AUTH_TOKEN is missing; webhook verification cannot run." };
  if (!input.signature) return { ok: false, reason: "Missing X-Twilio-Signature header." };

  const data = Object.keys(input.params).sort().reduce((acc, key) => `${acc}${key}${input.params[key]}`, input.url);
  const expected = createHmac("sha1", input.authToken).update(data).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(input.signature);
  if (a.length !== b.length) return { ok: false, reason: "Invalid Twilio signature." };
  return { ok: timingSafeEqual(a, b), reason: timingSafeEqual(a, b) ? null : "Invalid Twilio signature." };
}

export function formDataToRecord(form: FormData) {
  return Object.fromEntries(Array.from(form.entries()).map(([key, value]) => [key, String(value)]));
}
