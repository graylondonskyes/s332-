import { NullMessagingProvider, ResendEmailProvider, TwilioSmsProvider } from "@/lib/messaging/providers";

export function getMessagingProvider(channel = "sms") {
  if (channel === "email") return new ResendEmailProvider();
  if (channel === "sms") return new TwilioSmsProvider();
  return new NullMessagingProvider();
}
