import { MessageStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { appendTimelineEvent } from "@/lib/timeline";
import { renderTemplate } from "@/lib/template-render";
import { canUseProduct } from "@/lib/subscription";
import { reserveSmsAllowance } from "@/lib/usage";
import { assertAutomationRiskControls } from "@/lib/risk-controls";
import { assertLeadCanReceiveChannel } from "@/lib/consent";

export async function dispatchAutomationForLead(input: {
  accountId: string;
  leadId: string;
  triggerEvent: "lead.created" | "lead.completed";
}) {
  const account = await prisma.account.findUnique({
    where: { id: input.accountId },
    include: {
      subscription: true,
      settings: true,
      automationRules: {
        where: { triggerEvent: input.triggerEvent, isEnabled: true },
        include: { template: true },
        orderBy: { sequenceOrder: "asc" },
      },
    },
  });

  if (!account) throw new Error("Account not found");

  if (!canUseProduct(account.subscription?.status)) {
    await appendTimelineEvent({
      accountId: input.accountId,
      leadId: input.leadId,
      eventType: "message.skipped",
      eventLabel: "Automation skipped because subscription is inactive",
      eventPayloadJson: { triggerEvent: input.triggerEvent, subscriptionStatus: account.subscription?.status ?? "missing" },
    });
    return;
  }

  const lead = await prisma.lead.findUnique({ where: { id: input.leadId } });
  if (!lead) throw new Error("Lead not found");

  if ((lead.status === "lost" || lead.status === "completed") && input.triggerEvent === "lead.created") {
    await appendTimelineEvent({
      accountId: input.accountId,
      leadId: input.leadId,
      eventType: "message.skipped",
      eventLabel: "Automation skipped because lead is no longer active",
      eventPayloadJson: { triggerEvent: input.triggerEvent, leadStatus: lead.status },
    });
    return;
  }

  for (const rule of account.automationRules) {
    if (!rule.template) {
      await appendTimelineEvent({
        accountId: input.accountId,
        leadId: input.leadId,
        eventType: "message.skipped",
        eventLabel: "Automation skipped because rule has no template",
        eventPayloadJson: { ruleId: rule.id },
      });
      continue;
    }

    const queueKey = `${input.accountId}:${input.leadId}:${input.triggerEvent}:${rule.id}`;

    const existingEvent = await prisma.messageEvent.findUnique({
      where: { queueKey },
      select: { id: true, status: true, scheduledFor: true },
    });
    if (existingEvent) {
      await appendTimelineEvent({
        accountId: input.accountId,
        leadId: input.leadId,
        eventType: "message.skipped",
        eventLabel: "Automation skipped because this rule already created an event for this lead",
        eventPayloadJson: { ruleId: rule.id, existingMessageEventId: existingEvent.id, existingStatus: existingEvent.status, scheduledFor: existingEvent.scheduledFor },
      });
      continue;
    }

    if (!rule.template.isEnabled || !rule.template.body.trim()) {
      await appendTimelineEvent({
        accountId: input.accountId,
        leadId: input.leadId,
        eventType: "message.skipped",
        eventLabel: "Automation skipped because template is disabled or empty",
        eventPayloadJson: { ruleId: rule.id, templateId: rule.templateId },
      });
      continue;
    }

    const destination = rule.template.channel === "email" ? lead.email : lead.phone;
    if (!destination) {
      await prisma.messageEvent.create({
        data: {
          accountId: input.accountId,
          leadId: input.leadId,
          templateId: rule.templateId,
          ruleId: rule.id,
          queueKey,
          channel: rule.template.channel,
          status: MessageStatus.skipped,
          bodySnapshot: "",
          subject: rule.template.subject,
          failureReason: `Lead has no ${rule.template.channel === "email" ? "email" : "phone"} destination.`,
        },
      });
      await appendTimelineEvent({
        accountId: input.accountId,
        leadId: input.leadId,
        eventType: "message.skipped",
        eventLabel: "Automation skipped because lead has no sendable destination",
        eventPayloadJson: { ruleId: rule.id, channel: rule.template.channel },
      });
      continue;
    }

    const bodySnapshot = renderTemplate(rule.template.body, {
      first_name: lead.firstName ?? "there",
      business_name: account.businessName,
      service_type: lead.serviceType ?? "your request",
      review_url: account.reviewUrl ?? "",
      business_phone: account.businessPhone ?? "",
    });

    if (rule.template.channel === "sms") {
      const consent = await assertLeadCanReceiveChannel({ accountId: input.accountId, leadId: input.leadId, channel: "sms" });
      if (!consent.allowed) {
        await prisma.messageEvent.create({
          data: { accountId: input.accountId, leadId: input.leadId, templateId: rule.templateId, ruleId: rule.id, queueKey, channel: "sms", status: MessageStatus.skipped, bodySnapshot, subject: rule.template.subject, failureReason: consent.reason || "SMS consent/contact rules blocked automation." },
        });
        await appendTimelineEvent({ accountId: input.accountId, leadId: input.leadId, eventType: "message.skipped", eventLabel: "SMS automation skipped before queue because consent/contact rules blocked it", eventPayloadJson: { ruleId: rule.id, reason: consent.reason } });
        continue;
      }

      const risk = await assertAutomationRiskControls({ accountId: input.accountId, leadId: input.leadId, channel: "sms", automated: true });
      if (!risk.allowed) {
        await prisma.messageEvent.create({
          data: { accountId: input.accountId, leadId: input.leadId, templateId: rule.templateId, ruleId: rule.id, queueKey, channel: "sms", status: MessageStatus.skipped, bodySnapshot, subject: rule.template.subject, failureReason: risk.reason },
        });
        await appendTimelineEvent({ accountId: input.accountId, leadId: input.leadId, eventType: "message.skipped", eventLabel: "SMS automation skipped by safety controls", eventPayloadJson: { ruleId: rule.id, reason: risk.reason } });
        continue;
      }

    }

    const status = rule.delayMinutes > 0 ? MessageStatus.scheduled : MessageStatus.queued;
    const scheduledFor = rule.delayMinutes > 0 ? new Date(Date.now() + rule.delayMinutes * 60 * 1000) : null;

    const messageEvent = await prisma.messageEvent.create({
      data: {
        accountId: input.accountId,
        leadId: input.leadId,
        templateId: rule.templateId,
        ruleId: rule.id,
        queueKey,
        channel: rule.template.channel,
        status,
        bodySnapshot,
        subject: rule.template.subject,
        scheduledFor,
      },
    });

    if (rule.template.channel === "sms") {
      const reservation = await reserveSmsAllowance({
        accountId: input.accountId,
        leadId: input.leadId,
        messageEventId: messageEvent.id,
        body: bodySnapshot,
        automated: true,
        note: "reserved_at_queue_time",
      });
      if (!reservation.allowed) {
        await prisma.messageEvent.update({
          where: { id: messageEvent.id },
          data: { status: MessageStatus.skipped, failureReason: reservation.reason || "SMS guardrail blocked reservation." },
        });
        await appendTimelineEvent({
          accountId: input.accountId,
          leadId: input.leadId,
          eventType: "message.skipped",
          eventLabel: "SMS automation blocked before queue by strict fair-use guardrail",
          eventPayloadJson: { ruleId: rule.id, messageEventId: messageEvent.id, reason: reservation.reason },
        });
        continue;
      }
    }

    await appendTimelineEvent({
      accountId: input.accountId,
      leadId: input.leadId,
      eventType: status === MessageStatus.scheduled ? "message.scheduled" : "message.queued",
      eventLabel: status === MessageStatus.scheduled ? `Scheduled ${rule.template.name}` : `Queued ${rule.template.name}`,
      eventPayloadJson: { ruleId: rule.id, templateId: rule.templateId, messageEventId: messageEvent.id, scheduledFor },
    });
  }
}
