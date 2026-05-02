
import nodemailer from "nodemailer";

export function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_FROM_EMAIL);
}

function getTransport() {
  if (!smtpConfigured()) {
    throw new Error("SMTP is not configured.");
  }
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || "false").toLowerCase() === "true",
    auth: process.env.SMTP_USER ? {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS || ""
    } : undefined
  });
}

export async function sendBatchEmails(leads, { dryRun = false } = {}) {
  const transport = getTransport();
  const from = process.env.SMTP_FROM_NAME
    ? `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM_EMAIL}>`
    : process.env.SMTP_FROM_EMAIL;

  const sent = [];
  for (const lead of leads) {
    const to = lead.contactEmail || lead?.extracted?.contact_email || "";
    const drafts = lead.drafts || {};
    if (!to || !drafts.email_body || !drafts.email_subject) continue;
    const mail = {
      from,
      to,
      subject: drafts.email_subject,
      text: drafts.email_body
    };
    if (!dryRun) {
      await transport.sendMail(mail);
    }
    sent.push({ id: lead.id, to, subject: drafts.email_subject });
  }
  return sent;
}
