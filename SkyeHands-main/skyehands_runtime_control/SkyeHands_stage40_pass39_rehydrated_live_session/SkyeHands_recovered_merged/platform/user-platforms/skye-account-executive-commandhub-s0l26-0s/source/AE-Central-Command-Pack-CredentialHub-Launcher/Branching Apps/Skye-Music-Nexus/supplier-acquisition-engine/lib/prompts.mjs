
function trimLeadText(rawText = "", limit = 3000) {
  return String(rawText || "").slice(0, limit);
}

export function buildBatchExtractionPrompt(promptProfile, leads) {
  const packed = leads.map((lead) => ({
    lead_id: lead.id,
    title: lead.title,
    url: lead.url,
    snippet: lead.snippet || "",
    raw_text: trimLeadText(lead.rawText)
  }));

  return [
    promptProfile,
    "Task: assess each captured lead and return one schema-compliant extraction object per lead.",
    "Rules:",
    "- Use only the supplied lead text.",
    "- Do not invent contact names, production claims, shipping promises, or private information.",
    "- contact_email should be an email string if visible, otherwise empty string.",
    "- fit_score is the overall supplier acquisition priority for this business. 100 is ideal.",
    "- reason_to_contact should be short and direct.",
    "- If the lead looks like a bad fit, say so clearly.",
    "Lead batch:",
    JSON.stringify(packed, null, 2)
  ].join("\n\n");
}

export function buildBatchDraftPrompt(promptProfile, leads) {
  const packed = leads.map((lead) => ({
    lead_id: lead.id,
    title: lead.title,
    url: lead.url,
    source_excerpt: trimLeadText(lead.rawText, 1600),
    extracted: lead.extracted
  }));

  return [
    promptProfile,
    "Task: write one tailored outreach set per lead.",
    "Rules:",
    "- Write commercially serious supplier outreach, not fluffy marketing copy.",
    "- The Alibaba opener must be concise and fast to send.",
    "- The email body can be denser and should present a real partnership offer.",
    "- Ask for per-unit price and per-unit U.S. shipping cost even if the listing shows MOQ pricing only.",
    "- Do not mention any markup percentage.",
    "- Mention that customer support is handled on our side.",
    "- Mention optional U.S. warehousing/storefront expansion only if the lead looks like a good fit.",
    "- Do not invent contact names or claim there is already an agreement.",
    "Lead batch:",
    JSON.stringify(packed, null, 2)
  ].join("\n\n");
}
