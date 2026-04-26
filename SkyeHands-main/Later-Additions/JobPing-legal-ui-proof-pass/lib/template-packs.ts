import type { TemplateType } from "@prisma/client";

export type NicheTemplatePack = {
  id: string;
  name: string;
  description: string;
  serviceExamples: string[];
  templates: Record<TemplateType, string>;
};

export const nicheTemplatePacks: NicheTemplatePack[] = [
  {
    id: "plumbing",
    name: "Plumbing",
    description: "Fast quote, emergency repair, and review follow-up language for plumbing operators.",
    serviceExamples: ["water heater repair", "drain clearing", "leak inspection"],
    templates: {
      welcome_reply: "Hi {{first_name}}, this is {{business_name}}. We received your request for {{service_type}} and can help. Reply with the best time window and any photos if you have them.",
      missed_call_reply: "Sorry we missed your call — this is {{business_name}}. Reply here with what is happening and your address area, and we will help with {{service_type}} as quickly as possible.",
      followup_1: "Hi {{first_name}}, checking in from {{business_name}}. Do you still need help with {{service_type}}? Reply here and we can get the next step moving.",
      followup_2: "One final check-in from {{business_name}} about {{service_type}}. Reply here if you still want help or want us to close this request.",
      quote_followup: "Hi {{first_name}}, following up on your {{service_type}} quote from {{business_name}}. Reply here if you want to approve it or have questions.",
      review_request: "Thanks for choosing {{business_name}}. If the service helped, please leave a quick review here: {{review_url}}"
    }
  },
  {
    id: "hvac",
    name: "HVAC",
    description: "Comfort-first language for AC/heating service calls, tune-ups, and installs.",
    serviceExamples: ["AC repair", "seasonal tune-up", "new unit estimate"],
    templates: {
      welcome_reply: "Hi {{first_name}}, {{business_name}} received your {{service_type}} request. Reply with your preferred time, system issue, and ZIP code so we can help fast.",
      missed_call_reply: "Sorry we missed you — {{business_name}} here. Need help with {{service_type}}? Reply with your system issue and service area and we will follow up.",
      followup_1: "Hi {{first_name}}, do you still need help with {{service_type}}? {{business_name}} can help get your comfort back on track.",
      followup_2: "Final follow-up from {{business_name}} about {{service_type}}. Reply here if you want us to keep this request open.",
      quote_followup: "Hi {{first_name}}, following up on your {{service_type}} estimate. Reply here and {{business_name}} can confirm next steps.",
      review_request: "Thank you for trusting {{business_name}}. Your review helps local customers find reliable HVAC help: {{review_url}}"
    }
  },
  {
    id: "cleaning",
    name: "Cleaning",
    description: "Residential/commercial cleaning templates for quick booking and recurring work.",
    serviceExamples: ["deep clean", "move-out clean", "recurring cleaning"],
    templates: {
      welcome_reply: "Hi {{first_name}}, thanks for contacting {{business_name}} about {{service_type}}. Reply with property size, preferred date, and any special notes.",
      missed_call_reply: "Sorry we missed your call — {{business_name}} here. Reply with what kind of cleaning you need and your preferred date.",
      followup_1: "Hi {{first_name}}, checking in from {{business_name}}. Are you still looking to schedule {{service_type}}?",
      followup_2: "One more follow-up from {{business_name}} about {{service_type}}. Reply here if you want a quote or booking time.",
      quote_followup: "Hi {{first_name}}, following up on your {{service_type}} quote. Reply here if you want to schedule.",
      review_request: "Thanks for choosing {{business_name}}. If everything looked great, please leave a review here: {{review_url}}"
    }
  },
  {
    id: "detailing",
    name: "Mobile Detailing",
    description: "Mobile-service templates for vehicle details, ceramic jobs, and quick estimates.",
    serviceExamples: ["interior detail", "full detail", "ceramic coating quote"],
    templates: {
      welcome_reply: "Hi {{first_name}}, {{business_name}} received your {{service_type}} request. Reply with vehicle type, location area, and preferred day.",
      missed_call_reply: "Sorry we missed you — {{business_name}} here. Need {{service_type}}? Reply with your vehicle type and preferred appointment window.",
      followup_1: "Hi {{first_name}}, checking in from {{business_name}}. Do you still want help with {{service_type}}?",
      followup_2: "Final check-in from {{business_name}} about {{service_type}}. Reply here if you want us to keep the quote open.",
      quote_followup: "Hi {{first_name}}, following up on your {{service_type}} quote. Reply here if you want to book your detail.",
      review_request: "Thanks for booking with {{business_name}}. If your vehicle looks great, please leave a review here: {{review_url}}"
    }
  }
];

export function getTemplatePack(id?: string | null) {
  return nicheTemplatePacks.find((pack) => pack.id === id) || nicheTemplatePacks[0];
}
