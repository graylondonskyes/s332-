import { getOptionalEnv } from "@/lib/env";

export type SendMessageInput = {
  accountId: string;
  leadId: string;
  channel: string;
  to?: string | null;
  subject?: string | null;
  body: string;
};

export type SendMessageResult = {
  success: boolean;
  providerMessageId?: string;
  errorCode?: string;
  errorMessage?: string;
  deliveryMetadata?: Record<string, unknown>;
};

export interface MessagingProvider {
  send(input: SendMessageInput): Promise<SendMessageResult>;
}

export class ProviderConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderConfigurationError";
  }
}

function normalizePhone(value?: string | null) {
  if (!value) return null;
  return value.replace(/[^+\d]/g, "");
}

export class TwilioSmsProvider implements MessagingProvider {
  private accountSid = getOptionalEnv("TWILIO_ACCOUNT_SID");
  private authToken = getOptionalEnv("TWILIO_AUTH_TOKEN");
  private fromNumber = getOptionalEnv("TWILIO_FROM_NUMBER");

  assertConfigured() {
    if (!this.accountSid || !this.authToken || !this.fromNumber) {
      throw new ProviderConfigurationError("Twilio SMS is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER.");
    }
  }

  async send(input: SendMessageInput): Promise<SendMessageResult> {
    try {
      this.assertConfigured();
    } catch (error) {
      return { success: false, errorCode: "PROVIDER_NOT_CONFIGURED", errorMessage: error instanceof Error ? error.message : "Twilio is not configured." };
    }

    const to = normalizePhone(input.to);
    if (!to) {
      return { success: false, errorCode: "MISSING_RECIPIENT", errorMessage: "Lead does not have a sendable phone number." };
    }

    const params = new URLSearchParams({ To: to, From: this.fromNumber!, Body: input.body });
    const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64");

    try {
      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        return {
          success: false,
          errorCode: String(json.code || response.status),
          errorMessage: String(json.message || `Twilio send failed with HTTP ${response.status}.`),
          deliveryMetadata: { twilio: json },
        };
      }
      return { success: true, providerMessageId: json.sid, deliveryMetadata: { twilioStatus: json.status, channel: "sms" } };
    } catch (error) {
      return { success: false, errorCode: "PROVIDER_REQUEST_FAILED", errorMessage: error instanceof Error ? error.message : "Twilio request failed." };
    }
  }
}

export class ResendEmailProvider implements MessagingProvider {
  private apiKey = getOptionalEnv("RESEND_API_KEY");
  private fromEmail = getOptionalEnv("RESEND_FROM_EMAIL");

  assertConfigured() {
    if (!this.apiKey || !this.fromEmail) {
      throw new ProviderConfigurationError("Resend email is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL.");
    }
  }

  async send(input: SendMessageInput): Promise<SendMessageResult> {
    try {
      this.assertConfigured();
    } catch (error) {
      return { success: false, errorCode: "PROVIDER_NOT_CONFIGURED", errorMessage: error instanceof Error ? error.message : "Resend is not configured." };
    }

    if (!input.to || !input.to.includes("@")) {
      return { success: false, errorCode: "MISSING_RECIPIENT", errorMessage: "Lead does not have a sendable email address." };
    }

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: this.fromEmail, to: input.to, subject: input.subject || "Quick follow-up", text: input.body }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        return { success: false, errorCode: String(json.name || response.status), errorMessage: String(json.message || `Resend failed with HTTP ${response.status}.`), deliveryMetadata: { resend: json } };
      }
      return { success: true, providerMessageId: json.id, deliveryMetadata: { channel: "email" } };
    } catch (error) {
      return { success: false, errorCode: "PROVIDER_REQUEST_FAILED", errorMessage: error instanceof Error ? error.message : "Resend request failed." };
    }
  }
}

export class NullMessagingProvider implements MessagingProvider {
  async send(input: SendMessageInput): Promise<SendMessageResult> {
    if (!input.to) {
      return { success: false, errorCode: "MISSING_RECIPIENT", errorMessage: "Lead does not have a sendable destination." };
    }
    return {
      success: false,
      errorCode: "PROVIDER_NOT_CONFIGURED",
      errorMessage: "No live messaging provider is configured for this channel. Configure Twilio for SMS or Resend for email.",
    };
  }
}
