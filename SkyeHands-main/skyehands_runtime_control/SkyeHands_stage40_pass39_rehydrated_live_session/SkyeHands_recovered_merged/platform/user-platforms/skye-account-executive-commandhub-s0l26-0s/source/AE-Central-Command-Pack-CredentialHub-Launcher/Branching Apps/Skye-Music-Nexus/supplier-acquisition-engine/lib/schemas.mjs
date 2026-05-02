
import { z } from "zod";

const FitEnum = z.enum(["strong", "moderate", "weak", "bad_fit"]);
const UnitQuoteEnum = z.enum(["likely", "possible", "unclear", "unlikely"]);

export const LeadExtractionSchema = z.object({
  lead_id: z.string(),
  supplier_name: z.string(),
  company_type: z.string(),
  product_focus: z.string(),
  visible_moq: z.string(),
  visible_price_range: z.string(),
  unit_quote_possible: UnitQuoteEnum,
  oem_odm_signals: z.array(z.string()),
  style_fit: FitEnum,
  warehouse_fit: FitEnum,
  storefront_fit: FitEnum,
  risk_flags: z.array(z.string()),
  contact_email: z.string(),
  reason_to_contact: z.string(),
  concise_summary: z.string(),
  fit_score: z.number().min(0).max(100),
  confidence: z.number().min(0).max(100)
});

export const LeadBatchExtractionSchema = z.object({
  results: z.array(LeadExtractionSchema)
});

export const DraftSchema = z.object({
  lead_id: z.string(),
  alibaba_opener: z.string(),
  email_subject: z.string(),
  email_body: z.string(),
  followup_1: z.string(),
  moq_reply: z.string(),
  short_reason: z.string()
});

export const DraftBatchSchema = z.object({
  results: z.array(DraftSchema)
});
