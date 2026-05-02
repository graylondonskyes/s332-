import { z } from "zod";

export const signupSchema = z.object({
  fullName: z.string().min(2),
  businessName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const onboardingSchema = z.object({
  businessName: z.string().min(2),
  niche: z.string().min(2),
  businessPhone: z.string().min(7),
  replyEmail: z.string().email(),
  reviewUrl: z.string().url(),
  serviceArea: z.string().min(2),
  timezone: z.string().min(2),
  templatePackId: z.string().optional(),
});

export const leadCreateSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  serviceType: z.string().optional(),
  source: z.string().optional(),
  notes: z.string().optional(),
  smsConsent: z.boolean().optional(),
  emailConsent: z.boolean().optional(),
}).refine((data) => !!(data.phone || data.email), {
  message: "Phone or email is required",
});

export const leadStatusSchema = z.object({
  status: z.enum(["new", "contacted", "quoted", "booked", "completed", "lost"]),
});

export const noteSchema = z.object({
  body: z.string().min(1),
});

export const templateUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  body: z.string().min(1).optional(),
  subject: z.string().optional(),
  isEnabled: z.boolean().optional(),
  channel: z.string().min(1).optional(),
});

export const automationUpdateSchema = z.object({
  isEnabled: z.boolean().optional(),
  delayMinutes: z.number().int().nonnegative().optional(),
  sequenceOrder: z.number().int().nonnegative().optional(),
  templateId: z.string().nullable().optional(),
});
